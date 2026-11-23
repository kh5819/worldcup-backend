// =========================
// 플듀 인생게임 REBORN — '직접 쓴 말'을 이야기로 엮기 (2026-11-22)
// 목록("2살 졸리다 · 직접 쓴 말")이 아니라, 마지막 순간에서 시작해 어릴 적 말·꿈·성공·후회·편지로 거슬러 가는 글.
// · 질문마다 무엇을 물었는지 살린 문장 + 실제 기록(꿈 이룸·직업·남은 돈·마지막 해 행복)과 엮음
// · 반환: 문단 배열, 문단 = 조각 배열 [{t:"보통 글"} | {u:"직접 쓴 말"}] — 화면은 u 조각만 따옴표·색으로 표시(HTML 안 섞음)
// · 사실을 지어내지 않음: 해석이 들어가는 곳은 질문형("무슨 의미였을까")으로만
// =========================

// ---- 한국어 조사 (따옴표 안 말의 마지막 글자 기준) ----
function batchim(w) {
  const s = String(w || "").replace(/[\s'"「」“”‘’.!?~…,·\-–—)(\]\[]+$/u, "");
  const c = s[s.length - 1]; if (!c) return 0;
  const code = c.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) { const jong = (code - 0xac00) % 28; return jong === 0 ? 0 : jong === 8 ? 2 : 1; } // 2 = ㄹ받침
  if (/[0-9]/.test(c)) return "013678".includes(c) ? 1 : 0;
  if (/[a-zA-Z]/.test(c)) return /[lmnrbkpt]/i.test(c) ? 1 : 0;
  return 0;
}
const J = { "은": ["은", "는"], "이": ["이", "가"], "을": ["을", "를"], "과": ["과", "와"], "이라는": ["이라는", "라는"], "이라고": ["이라고", "라고"], "이었": ["이었", "였"], "이다": ["이다", "다"] };
function josa(w, j) { const b = batchim(w); if (j === "으로") return b === 1 ? "으로" : "로"; const p = J[j]; return p ? (b ? p[0] : p[1]) : j; }
const hash = (s) => { let h = 2166136261 >>> 0; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };

/** 틀 → 조각: {x} {x|은} = 보통 값, «k» «k|이라고» = 직접 쓴 말(따옴표) + 조사 */
function seg(tpl, v, U, lang) {
  const out = []; let last = 0;
  const plain = (s) => s.replace(/\{(\w+)(?:\|([가-힣]+))?\}/g, (_, k, j) => { const x = v[k] == null ? "" : String(v[k]); return j && lang === "ko" ? x + josa(x, j) : x; });
  tpl.replace(/«(\w+)(?:\|([가-힣]+))?»/g, (m, k, j, i) => { if (i > last) out.push({ t: plain(tpl.slice(last, i)) }); const u = U[k] || ""; out.push({ u }); if (j && lang === "ko") out.push({ t: josa(u, j) }); last = i + m.length; return m; });
  if (last < tpl.length) out.push({ t: plain(tpl.slice(last)) });
  // 같은 종류 이웃 조각 합치기
  return out.reduce((a, x) => { const p = a[a.length - 1]; if (p && x.t != null && p.t != null) p.t += x.t; else a.push(x); return a; }, []);
}
const pick = (arr, seed, key) => arr[hash(seed + "|" + key) % arr.length];

// ---- 문장 틀 (ko/ja/en, 같은 수의 갈래) ----
const T = {
  how: { ko: ["웃으며", "조용히", "조금은 쓸쓸하게"], ja: ["笑顔で", "静かに", "少し寂しげに"], en: ["with a smile", "quietly", "a little lonely"] },
  open: {
    ko: ["{name|은} {age}살에 {how} 눈을 감았다. 마지막으로 남긴 말은 «last|이었»다.", "{age}살, {name|은} {how} 세상을 떠났다. 마지막 한마디는 «last|이었»다."],
    ja: ["{name}は{age}歳で、{how}目を閉じた。最後に残した言葉は«last»だった。", "{age}歳、{name}は{how}この世を去った。最後の一言は«last»だった。"],
    en: ["{name} closed their eyes at {age}, {how}. The last words left behind were «last».", "At {age}, {name} left this world {how}. The final words: «last»."],
  },
  openNo: {
    ko: ["{name|은} {age}살에 {how} 눈을 감았다. 마지막 말은 따로 남기지 않았다. 대신 살아오며 적어 둔 말들이 있다."],
    ja: ["{name}は{age}歳で、{how}目を閉じた。最後の言葉は残さなかった。代わりに、生きながら書き残した言葉がある。"],
    en: ["{name} closed their eyes at {age}, {how}. No last words were left — but there are the words written along the way."],
  },
  child: {
    ko: ["어릴 적, {age}살의 {name|은} «t|이라는» 말을 남긴 적이 있다. 그건 무슨 의미였을까. 이제는 아무도 모른다. 다만 그 말을 적던 아이는 분명 거기 있었다.", "{age}살 무렵에는 «t|이라고» 적어 두었다. 어린 마음에 무엇이 그렇게 중요했을까."],
    ja: ["幼い頃、{age}歳の{name}は«t»という言葉を残したことがある。どういう意味だったのだろう。今はもう誰にもわからない。ただ、その言葉を書いた子どもは確かにそこにいた。", "{age}歳の頃には«t»と書き残している。幼い心に、何がそんなに大事だったのだろう。"],
    en: ["As a child, at {age}, {name} once wrote «t». What did it mean? No one knows anymore. But the child who wrote it was surely there.", "Around age {age}, {name} jotted down «t». What could have mattered so much to such a young heart?"],
  },
  dream: {
    ko: ["{name}의 어릴 적 꿈은 «d|이었»다.", "어린 {name|이} 품은 꿈은 «d|이었»다."],
    ja: ["{name}の子どもの頃の夢は«d»だった。", "幼い{name}が抱いた夢は«d»だった。"],
    en: ["{name}'s childhood dream was «d».", "The dream young {name} carried was «d»."],
  },
  q10: {
    ko: ["열 살, 어른이 되면 무엇을 하고 싶냐는 물음에는 «q10|이라고» 답했다."],
    ja: ["十歳のとき、大人になったら何がしたいかと聞かれて、«q10»と答えた。"],
    en: ["At ten, asked what they wanted to do as a grown-up, {name} answered «q10»."],
  },
  q10same: { ko: ["열 살에 어른이 되면 무엇을 하고 싶냐고 다시 물었을 때도 대답은 같았다."], ja: ["十歳で大人になったら何がしたいかと改めて聞かれても、答えは同じだった。"], en: ["Asked again at ten what they wanted to be, {name} gave the same answer."] },
  wish: { ko: ["장래희망 칸에는 «wish|이라고» 적혀 있었다."], ja: ["将来の夢の欄には«wish»と書かれていた。"], en: ["In the 'future job' box, it said «wish»."] },
  dreamYes: {
    ko: ["그리고 그 꿈은 정말로 이루어졌다. 어른이 된 {name|은} {career|으로} 살았다.", "꿈은 꿈으로 끝나지 않았다. {name|은} 끝내 {career|이} 되었다."],
    ja: ["そしてその夢は本当に叶った。大人になった{name}は{career}として生きた。", "夢は夢で終わらなかった。{name}はついに{career}になった。"],
    en: ["And that dream really came true: grown-up {name} lived as {career}.", "The dream did not stay a dream. {name} became {career}."],
  },
  dreamNo: {
    ko: ["그 꿈을 이루고 세상을 떠났을까? 기록을 보면 끝내 그 자리에 닿지는 못했다. 대신 {career|으로} 살았다.", "그 꿈은 이루어졌을까. 기록 속의 {name|은} 그 꿈 대신 {career|으로} 살았다. 그래도 그 말을 적던 마음까지 사라지지는 않았을 것이다."],
    ja: ["その夢を叶えて旅立ったのだろうか。記録を見ると、最後までそこには届かなかった。代わりに{career}として生きた。", "その夢は叶ったのだろうか。記録の中の{name}は、夢の代わりに{career}として生きた。それでも、あの言葉を書いた気持ちまでは消えなかったはずだ。"],
    en: ["Did {name} reach that dream before leaving? The record says no. Instead, {name} lived as {career}.", "Did the dream come true? In the record, {name} lived as {career} instead. Still, the heart that wrote those words surely never disappeared."],
  },
  dreamNoJob: {
    ko: ["그 꿈을 이루고 세상을 떠났을까? 기록을 보면 끝내 닿지는 못했다. 대신 다른 길을 걸었다."],
    ja: ["その夢を叶えて旅立ったのだろうか。記録を見ると、最後まで届かなかった。代わりに別の道を歩いた。"],
    en: ["Did {name} reach that dream before leaving? The record says no — another road was taken instead."],
  },
  dreamUnknown: { ko: ["그 꿈을 이루고 세상을 떠났을까? 그건 {name}만이 알 것이다."], ja: ["その夢を叶えて旅立ったのだろうか。それは{name}だけが知っている。"], en: ["Did {name} fulfil that dream before leaving? Only {name} would know."] },
  q18: { ko: ["열여덟에는 가장 이루고 싶은 꿈으로 «q18|을» 꼽았다."], ja: ["十八歳では、いちばん叶えたい夢に«q18»を挙げた。"], en: ["At eighteen, the dream {name} wanted most was «q18»."] },
  q25: {
    ko: ["스물다섯의 {name}에게 성공이란 «q25|이었»다. 그 말대로 살았을까. 마지막 통장에는 {final|이} 남아 있었다."],
    ja: ["二十五歳の{name}にとって、成功とは«q25»だった。その言葉どおりに生きただろうか。最後の通帳には{final}が残っていた。"],
    en: ["To {name} at twenty-five, success meant «q25». Did life go that way? In the end, {final} remained in the bank."],
  },
  q40: {
    ko: ["마흔, 가장 후회되는 선택을 묻자 «q40|이라고» 적었다. 그 뒤로 {left}년을 더 살았다. 그 후회를 다 풀었는지는 알 수 없다.", "마흔의 {name|은} 가장 후회되는 선택으로 «q40|을» 꼽았다. 남은 {left}년 동안 그 마음은 어디로 갔을까."],
    ja: ["四十歳、いちばん後悔している選択を聞かれて«q40»と書いた。それから{left}年を生きた。その後悔が晴れたのかはわからない。", "四十歳の{name}は、いちばんの後悔に«q40»を挙げた。残りの{left}年、その気持ちはどこへ行ったのだろう。"],
    en: ["At forty, asked about the choice they regretted most, {name} wrote «q40». {left} more years followed. Whether that regret was ever eased, no one can say.", "At forty, {name} named «q40» as the biggest regret. Where did that feeling go over the {left} years that remained?"],
  },
  q40end: { ko: ["마흔, 가장 후회되는 선택을 묻자 «q40|이라고» 적었다."], ja: ["四十歳、いちばん後悔している選択を聞かれて«q40»と書いた。"], en: ["At forty, asked about the choice they regretted most, {name} wrote «q40»."] },
  q60: { ko: ["예순의 {name|은} 젊은 날의 자신에게 «q60|이라고» 말해 주고 싶다고 했다."], ja: ["六十歳の{name}は、若い日の自分に«q60»と伝えたいと言った。"], en: ["At sixty, {name} said they would tell their younger self: «q60»."] },
  adult: {
    ko: ["{age}살 어느 날에는 «t|이라고» 적어 두었다.", "{age}살에는 문득 «t|이라고» 중얼거렸다.", "{age}살의 메모 한 줄 — «t»."],
    ja: ["{age}歳のある日には«t»と書き留めた。", "{age}歳のとき、ふと«t»とつぶやいた。", "{age}歳のメモ一行 — «t»。"],
    en: ["One day at {age}, {name} wrote down «t».", "At {age}, {name} murmured «t».", "A single line from age {age}: «t»."],
  },
  letter: {
    ko: ["그리고 {to}에게 보내는 편지 한 통을 남겼다. 첫 줄은 이랬다 — «l»"],
    ja: ["そして{to}へ宛てた手紙を一通残した。最初の一行はこうだった — «l»"],
    en: ["And {name} left a letter for {to}. It began: «l»"],
  },
  close: {
    ko: ["«first|으로» 시작해 «end|으로» 끝난 {n}개의 말. 그것이 {name|이} 직접 남긴 인생의 목소리였다."],
    ja: ["«first»で始まり、«end»で終わった{n}個の言葉。それが{name}自身の残した人生の声だった。"],
    en: ["{n} sayings, beginning with «first» and ending with «end». That was the voice {name} left behind, in their own words."],
  },
  note: { ko: "따옴표 안의 말은 직접 쓴 그대로예요.", ja: "かぎかっこの中は、自分で書いたそのままの言葉です。", en: "Words in quotes are exactly as written by the player." },
};
const tt = (k, lang, seed, alt) => pick(T[k][lang] || T[k].ko, seed, k + (alt || ""));

/**
 * @param S 인생 상태 · @param o { lang, seed, name, age, dreamDone(true|false|null), career(그 언어 직업 이름|""), final(돈 글자), lastHappy, letterTo(받는 사람 글자) }
 * @returns { paras: 조각[][], note }
 */
export function wordsStory(S, o) {
  const lang = o.lang || "ko", seed = o.seed || "", X = S.texts || {};
  const v = { name: o.name, age: o.age, career: o.career || "", final: o.final || "", left: Math.max(0, (o.age || 0) - 40) };
  const how = T.how[lang][o.lastHappy >= 65 ? 0 : o.lastHappy >= 40 ? 1 : 2];
  const paras = [];
  const P = (k, extra = {}, U = {}, alt) => seg(tt(k, lang, seed, alt), { ...v, ...extra }, U, lang);
  // 1) 마지막 순간
  paras.push(X.last ? P("open", { how }, { last: X.last }) : P("openNo", { how }));
  // 2) 어릴 적 말 (12살까지 생각 남기기) — 첫 말은 깊게, 나머지는 짧게
  const th = (X.thoughts || []).filter(t => t && t.text).sort((a, b) => a.a - b.a);
  const kid = th.filter(t => t.a <= 12), grown = th.filter(t => t.a > 12);
  if (kid.length) { const p = P("child", { age: kid[0].a }, { t: kid[0].text }, "0"); for (const k of kid.slice(1, 3)) p.push({ t: lang === "ja" ? "" : " " }, ...P("adult", { age: k.a }, { t: k.text }, "k" + k.a)); paras.push(p); }
  // 3) 꿈 — 태어날 때 쓴 꿈 / 장래희망 / 열 살 답 → 이루었는지 (기록 그대로)
  const d = X.dream || "", p3 = [];
  const SP = lang === "ja" ? "" : " "; const add = (arr) => { if (p3.length) p3.push({ t: SP }); p3.push(...arr); };
  if (d) add(P("dream", {}, { d }));
  if (X.wish && X.wish !== d) add(P("wish", {}, { wish: X.wish }));
  if (X.q10) add(X.q10.trim() === d.trim() ? P("q10same") : P("q10", {}, { q10: X.q10 }));
  if (X.q18) add(P("q18", {}, { q18: X.q18 }));
  if (d || X.q10 || X.q18 || X.wish) add(o.dreamDone === true && o.career ? P("dreamYes") : o.dreamDone === false ? (o.career ? P("dreamNo") : P("dreamNoJob")) : P("dreamUnknown"));
  if (p3.length) paras.push(p3);
  // 4) 성공·후회·젊은 날에게 (실제로 그 나이까지 살았을 때만 질문이 나옴)
  const p4 = []; const add4 = (arr) => { if (p4.length) p4.push({ t: SP }); p4.push(...arr); };
  if (X.q25) add4(P("q25", {}, { q25: X.q25 }));
  if (X.q40) add4((o.age || 0) - 40 >= 2 ? P("q40", {}, { q40: X.q40 }) : P("q40end", {}, { q40: X.q40 }));
  if (X.q60) add4(P("q60", {}, { q60: X.q60 }));
  if (p4.length) paras.push(p4);
  // 5) 어른이 되어 남긴 메모 (많으면 고르게 4개)
  if (grown.length) { const step = Math.max(1, Math.ceil(grown.length / 4)); const p5 = []; grown.filter((_, i) => i % step === 0).slice(0, 4).forEach((g, i) => { if (i) p5.push({ t: SP }); p5.push(...P("adult", { age: g.a }, { t: g.text }, "g" + g.a)); }); paras.push(p5); }
  // 6) 편지
  if (X.letter?.text) { const first = String(X.letter.text).split(/\n|(?<=[.!?。！？])\s/)[0].slice(0, 80); paras.push(P("letter", { to: o.letterTo || "" }, { l: first })); }
  // 7) 맺음 — 처음 말과 마지막 말
  const all = [...(d ? [{ a: -1, text: d }] : []), ...th, ...["q10", "q18", "q25", "q40", "q60"].filter(k => X[k]).map(k => ({ a: +k.slice(1), text: X[k] })), ...(X.last ? [{ a: 999, text: X.last }] : [])].sort((a, b) => a.a - b.a);
  if (all.length >= 2) paras.push(P("close", { n: all.length }, { first: all[0].text, end: all[all.length - 1].text }));
  return { paras, note: T.note[lang] || T.note.ko };
}
/** 조각 → 글자 (자서전 글자 수 세기·공유용) */
export const paraText = (p, lang = "ko") => p.map(x => x.u != null ? (lang === "ko" ? `'${x.u}'` : lang === "ja" ? `「${x.u}」` : `"${x.u}"`) : x.t).join("");
