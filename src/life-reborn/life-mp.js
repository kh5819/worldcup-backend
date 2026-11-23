// =========================
// 플듀 인생게임 REBORN — 같이 태어난 친구 (멀티) 공용 규칙 (2026-11-23)
// 서버(worldcup-backend/src/lrb.js)와 화면이 같은 파일을 쓴다. 서버가 판정·적용, 화면은 버튼·문장만.
// 원칙: 상대 인생(돈·관계)을 바꾸는 일은 상대가 '수락'해야만 일어난다. 양쪽 결과는 서버가 둘 다에게 실제로 적용한다.
// =========================
const T = (ko, ja, en) => ({ ko, ja, en });

// 행동 목록: need(조건) · apply(서버에서 양쪽 적용) · 글
// who: from(신청한 사람) to(받는 사람). 조건 함수는 (a, b, ctx) — a·b 는 엔진 플레이어(p), ctx = { link(a쪽에서 본 b 사람 기록), linkB, im }
export const ACTIONS = {
  friend: { icon: "🤝", n: T("친구 하자", "友達になろう", "Be friends"), ask: T("{a}이(가) 친구가 되고 싶어 한다.", "{a}が友達になりたがっている。", "{a} wants to be friends."), done: T("{a}와(과) 친구가 되었다.", "{a}と友達になった。", "You became friends with {a}."), minAge: 4,
    need: (a, b, c) => !c.link || c.link.status !== "active" || !["friend", "lover", "spouse"].includes(c.link.rel) },
  hangout: { icon: "☕", n: T("만나서 수다", "会っておしゃべり", "Hang out"), ask: T("{a}이(가) 만나자고 한다.", "{a}が会おうと言っている。", "{a} wants to hang out."), done: T("{a}와(과) 시간 가는 줄 모르고 떠들었다.", "{a}と時間を忘れておしゃべりした。", "You lost track of time chatting with {a}."), minAge: 4, need: (a, b, c) => !!c.link },
  study: { icon: "📚", n: T("같이 공부", "一緒に勉強", "Study together"), ask: T("{a}이(가) 같이 공부하자고 한다.", "{a}が一緒に勉強しようと言っている。", "{a} wants to study together."), done: T("{a}와(과) 같이 공부했다. 둘 다 성적이 올랐다.", "{a}と一緒に勉強した。二人とも成績が上がった。", "You studied with {a}. Both your grades went up."), minAge: 7, maxAge: 30, need: (a, b, c) => !!c.link },
  travel: { icon: "✈️", n: T("같이 여행", "一緒に旅行", "Travel together"), ask: T("{a}이(가) 같이 여행 가자고 한다. (각자 {cost})", "{a}が一緒に旅行に行こうと言っている。(各自{cost})", "{a} wants to travel together. ({cost} each)"), done: T("{a}와(과) 함께 여행을 다녀왔다. 사진이 수백 장 남았다.", "{a}と一緒に旅行した。写真が何百枚も残った。", "You traveled with {a}. Hundreds of photos to show for it."), minAge: 16, cost: 300,
    need: (a, b, c) => !!c.link && a.stats.money >= c.costA && b.stats.money >= c.costB },
  samejob: { icon: "🏢", n: T("우리 회사로 와", "うちの会社に来なよ", "Join my company"), ask: T("{a}이(가) 자기 회사에서 같이 일하자고 한다. ({job})", "{a}が自分の会社で一緒に働こうと言っている。({job})", "{a} invites you to work at their company. ({job})"), done: T("{a}와(과) 같은 직장에 다니게 됐다.", "{a}と同じ職場で働くことになった。", "You now work at the same place as {a}."), minAge: 18, maxAge: 58,
    need: (a, b, c) => !!c.link && !!a.job && !!a.career && a.career !== b.career && !["doctor", "lawyer", "idol", "athlete", "politics"].includes(a.career) },
  partner: { icon: "📈", n: T("동업하기", "共同出資", "Invest as partners"), ask: T("{a}이(가) 같이 돈을 모아 동업하자고 한다. (각자 {cost})", "{a}が一緒にお金を出し合って共同事業をしようと言っている。(各自{cost})", "{a} proposes pooling money as business partners. ({cost} each)"), done: T("{a}와(과) 동업 계약서에 사인했다.", "{a}と共同出資の契約書にサインした。", "You signed a partnership agreement with {a}."), minAge: 22, maxAge: 68, cost: 1000,
    need: (a, b, c) => !!c.link && !c.partner && a.stats.money >= c.costA && b.stats.money >= c.costB },
  startup: { icon: "🚀", n: T("함께 창업", "一緒に起業", "Start a company together"), ask: T("{a}이(가) 회사를 그만두고 같이 창업하자고 한다! (각자 {cost})", "{a}が会社を辞めて一緒に起業しようと言っている!(各自{cost})", "{a} wants you both to quit and start a company together! ({cost} each)"), done: T("{a}와(과) 함께 회사를 세웠다. 사무실은 작았지만 꿈은 컸다.", "{a}と一緒に会社を立ち上げた。事務所は小さいが夢は大きかった。", "You founded a company with {a}. A tiny office, a huge dream."), minAge: 20, maxAge: 60, cost: 600,
    need: (a, b, c) => !!c.link && (c.link.close ?? 50) >= 45 && a.stats.money >= c.costA && b.stats.money >= c.costB && a.career !== "business" && b.career !== "business" },
  gift: { icon: "🎁", n: T("선물하기", "プレゼント", "Give a gift"), ask: T("{a}이(가) 선물을 보냈다. ({cost})", "{a}がプレゼントを送ってきた。({cost})", "{a} sent you a gift. ({cost})"), done: T("{a}에게 선물을 주고받았다.", "{a}とプレゼントをやり取りした。", "You exchanged a gift with {a}."), minAge: 6, cost: 80, tiers: [80, 400, 2000],
    need: (a, b, c) => !!c.link && a.stats.money >= c.costA },
  help: { icon: "🆘", n: T("도움 요청", "助けを求める", "Ask for help"), ask: T("{a}이(가) 도와 달라고 한다. ({cost} 빌려줄까?)", "{a}が助けを求めている。({cost}貸す?)", "{a} is asking for help. (Lend {cost}?)"), done: T("{a}이(가) 힘들 때 손을 내밀었다.", "{a}が困っている時に手を差し伸べた。", "You were there for {a} when it mattered."), minAge: 14, cost: 500,
    need: (a, b, c) => !!c.link && b.stats.money >= c.costB },
  argue: { icon: "💢", n: T("서운함 말하기", "不満をぶつける", "Confront them"), ask: T("{a}이(가) 서운했던 일을 따지러 왔다.", "{a}が不満をぶつけに来た。", "{a} came to confront you about something."), done: T("{a}와(과) 언성을 높였다.", "{a}と言い合いになった。", "Voices were raised with {a}."), minAge: 8, need: (a, b, c) => !!c.link, choices: ["sorry", "fight"] },
  reconcile: { icon: "🕊️", n: T("화해하기", "仲直り", "Make up"), ask: T("{a}이(가) 화해하고 싶어 한다.", "{a}が仲直りしたがっている。", "{a} wants to make up."), done: T("{a}와(과) 화해했다. 묵은 체증이 내려갔다.", "{a}と仲直りした。胸のつかえが下りた。", "You made up with {a}. A weight lifted."), minAge: 8,
    need: (a, b, c) => !!c.link && ((c.link.conflict || 0) >= 15 || (c.link.close ?? 50) < 40) },
  confess: { icon: "💌", n: T("고백하기", "告白する", "Confess"), ask: T("{a}이(가) 좋아한다고 고백했다!", "{a}が好きだと告白してきた!", "{a} just confessed their feelings!"), done: T("{a}와(과) 사귀기 시작했다.", "{a}と付き合い始めた。", "You started dating {a}."), minAge: 15, maxAge: 70,
    need: (a, b, c) => !!c.link && c.link.rel === "friend" && (c.link.close ?? 50) >= 50 && !a.spouse && !b.spouse && !a.relations?.romance && !b.relations?.romance },
  propose: { icon: "💍", n: T("청혼하기", "プロポーズ", "Propose"), ask: T("{a}이(가) 무릎을 꿇었다. 결혼해 달라고 한다!", "{a}がひざまずいた。結婚してほしいと言う!", "{a} got down on one knee. They're asking you to marry them!"), done: T("{a}와(과) 결혼했다! 같은 세상을 사는 사람과.", "{a}と結婚した!同じ世界を生きる人と。", "You married {a} — someone who shares your world."), minAge: 20, maxAge: 75,
    need: (a, b, c) => !!c.link && c.link.rel === "lover" && !a.spouse && !b.spouse },
  party: { icon: "🎉", n: T("모두 모이자", "みんなで集まろう", "Gather everyone"), ask: T("{a}이(가) 모두를 불러 모았다: {what}", "{a}がみんなを呼び集めた:{what}", "{a} is gathering everyone: {what}"), done: T("같이 태어난 친구들과 한자리에 모였다.", "一緒に生まれた友達と一堂に会した。", "You gathered with the friends you were born alongside."), minAge: 6, group: true, need: () => true },
};
export const ACTION_IDS = Object.keys(ACTIONS);
// 모두 모이자: 나이에 맞는 모임 이름
export const PARTY_KIND = (age) => age < 13 ? T("생일 파티", "誕生日パーティー", "a birthday party") : age < 20 ? T("수학여행 밤", "修学旅行の夜", "a school-trip night") : age < 30 ? T("MT", "合宿", "a weekend retreat") : age < 50 ? T("동창회", "同窓会", "a class reunion") : age < 70 ? T("환갑 잔치", "還暦祝い", "a big birthday celebration") : T("오랜 친구들의 점심", "古い友人たちの昼食", "a lunch among old friends");

// 사람 기록에서 상대 찾기 (pid = 상대 좌석 키)
export const linkOf = (p, pid) => (p.people || []).find(x => x.pid === pid && x.status !== "dead") || null;
const bump = (x, k, v, lo = 0, hi = 100) => { if (x) x[k] = Math.max(lo, Math.min(hi, (x[k] ?? (k === "close" ? 50 : 0)) + v)); };

/** 행동 가능한지 (서버·화면 공용). 반환: null(가능) 또는 이유 키 */
export function canDo(kind, a, b, ida, idb, extra = {}) {
  const A = ACTIONS[kind]; if (!A) return "BAD_KIND";
  if (!a?.alive) return "DEAD";
  if (A.group) return a.age >= A.minAge ? null : "AGE";
  if (!b?.alive) return "TARGET_DEAD";
  const age = Math.min(a.age, b.age);
  if (A.minAge && age < A.minAge) return "AGE"; if (A.maxAge && age > A.maxAge) return "AGE";
  const im = (p) => p.incomeMul || 1;
  const tier = kind === "gift" ? (A.tiers[extra.tier | 0] ?? A.tiers[0]) : A.cost || 0;
  const ctx = { link: linkOf(a, idb), linkB: linkOf(b, ida), costA: Math.round(tier * im(a)), costB: Math.round(tier * im(b)), partner: !!extra.partner };
  try { return A.need(a, b, ctx) ? null : "NOT_NOW"; } catch (_) { return "NOT_NOW"; }
}

/**
 * 서버: 수락된 행동을 양쪽 인생에 적용. sys = core.SYS, core 엔진. 반환: { lines:[{seat,text}], moment, partner? }
 * reply: argue 의 받는 쪽 대답(sorry|fight)
 */
export function applyAction(kind, a, b, ida, idb, ctx) {
  const { core, extra = {}, reply } = ctx; const S = core.SYS; const A = ACTIONS[kind];
  const im = (p) => p.incomeMul || 1;
  const addB = (p, k, v) => core.addStat(p, k, v);
  const mem = (p, who, tone = 1, w = 2) => S.remember(p, "m_friend", { who }, tone, w);
  const both = (fn) => { fn(a, b, idb); fn(b, a, ida); };
  const res = { kind, ok: true, d: {} };
  switch (kind) {
    case "friend": S.link(a, b, "friend", [ida, idb]); both((x) => { addB(x, "happy", 3); addB(x, "social", 2); }); break;
    case "hangout": both((x, y, id) => { const l = linkOf(x, id); bump(l, "close", 5); if (l) l.touch = x.age; addB(x, "happy", 2); }); break;
    case "study": both((x, y, id) => { addB(x, "intel", 3); bump(linkOf(x, id), "close", 6); }); break;
    case "travel": both((x, y, id) => { x.stats.money -= Math.round(A.cost * im(x)); addB(x, "happy", 7); addB(x, "health", 1); bump(linkOf(x, id), "close", 8); x.flags.add("travel"); }); res.scene = "abroad"; break;
    case "samejob": { const t = a.job.title, sal = Math.round(a.job.salary * 0.85 / (a.job._im || 1)); core.setCareer(b, a.career, { title: t, salary: sal }); both((x, y, id) => { bump(linkOf(x, id), "close", 5); const l = linkOf(x, id); if (l) l.coworker = true; }); res.scene = "office"; break; }
    case "partner": both((x) => { x.stats.money -= Math.round(A.cost * im(x)); }); S.link(a, b, "partner", [ida, idb]); res.partner = { kind: "partner", stake: A.cost }; res.scene = "office"; break;
    case "startup": both((x) => { x.stats.money -= Math.round(A.cost * im(x)); core.setCareer(x, "business"); x.flags.add("startup"); x.flags.add("cofounder"); }); S.link(a, b, "partner", [ida, idb]); res.partner = { kind: "startup", stake: A.cost }; res.scene = "shop"; break;
    case "gift": { const tier = A.tiers[extra.tier | 0] ?? A.tiers[0]; const va = Math.round(tier * im(a)); a.stats.money -= va; b.stats.money += Math.round(tier * im(b)); addB(b, "happy", 3); addB(a, "happy", 1); both((x, y, id) => bump(linkOf(x, id), "close", 4)); res.d.amount = tier; break; }
    case "help": { const vb = Math.round(A.cost * im(b)); b.stats.money -= vb; a.stats.money += Math.round(A.cost * im(a)); addB(a, "happy", 4); addB(b, "happy", 2); both((x, y, id) => bump(linkOf(x, id), "close", 7)); break; }
    case "argue": if (reply === "sorry") { both((x, y, id) => { const l = linkOf(x, id); bump(l, "close", 2); if (l) l.conflict = Math.max(0, (l.conflict || 0) - 10); }); addB(a, "happy", 2); res.d.reply = "sorry"; }
      else { both((x, y, id) => { const l = linkOf(x, id); bump(l, "close", -10); if (l) l.conflict = Math.min(100, (l.conflict || 0) + 25); addB(x, "happy", -3); }); res.d.reply = "fight"; } break;
    case "reconcile": both((x, y, id) => { const l = linkOf(x, id); if (l) { l.conflict = 0; bump(l, "close", 12); } addB(x, "happy", 4); S.remember(x, "m_reconcile", { who: y.nickname }, 1, 2); }); break;
    case "confess": S.link(a, b, "lover", [ida, idb]); both((x) => addB(x, "happy", 6)); res.scene = "cafe"; break;
    case "propose": S.marry(a, b, [ida, idb]); res.scene = "wedding"; break;
    default: res.ok = false;
  }
  if (kind !== "argue" && kind !== "propose" && kind !== "confess" && kind !== "friend") { mem(a, b.nickname, 1, 1); mem(b, a.nickname, 1, 1); }
  S.sync?.(a); S.sync?.(b);
  return res;
}
/** 모두 모이자: 참가자 모두 (서로 친밀 +) */
export function applyParty(ps, ids, core) {
  for (let i = 0; i < ps.length; i++) {
    core.addStat(ps[i], "happy", 5); core.addStat(ps[i], "social", 2);
    for (let j = 0; j < ps.length; j++) if (i !== j) { let l = linkOf(ps[i], ids[j]); if (!l) { core.SYS.link(ps[i], ps[j], "friend", [ids[i], ids[j]]); l = linkOf(ps[i], ids[j]); } bump(l, "close", 4); }
  }
}
/** 동업·함께 창업 해마다 정산 (같은 금액을 둘이 나눔). 반환 금액(만원·한국 기준) */
export function partnerYear(a, b, part, w, rnd = Math.random) {
  const sk = (a.stats.intel + b.stats.intel + a.stats.social + b.stats.social) / 4 + (a.stats.luck + b.stats.luck) / 4 - 50;
  const econ = { boom: 0.14, normal: 0.05, recession: -0.08, crisis: -0.22 }[w?.econ || "normal"] ?? 0.05;
  const scale = part.kind === "startup" ? 2600 : 1200;
  const amt = Math.round((econ * 2 + sk / 220 + (rnd() - 0.5) * (part.kind === "startup" ? 0.9 : 0.5)) * scale);
  a.stats.money += Math.round(amt * (a.incomeMul || 1)); b.stats.money += Math.round(amt * (b.incomeMul || 1));
  part.total = (part.total || 0) + amt; part.years = (part.years || 0) + 1; part.best = Math.max(part.best ?? -1e9, amt); part.worst = Math.min(part.worst ?? 1e9, amt);
  return amt;
}

// 장례식 (친구가 세상을 떠났을 때 살아 있는 사람에게 나오는 선택)
export const FUNERAL = {
  t: T("{a}의 장례식", "{a}の葬儀", "{a}'s Funeral"),
  x: T("같이 태어난 친구 {a}이(가) 세상을 떠났다. {y}년에 태어나 {age}살이었다.", "一緒に生まれた友 {a} が世を去った。{y}年生まれ、{age}歳だった。", "{a}, a friend you were born alongside, has passed away — born in {y}, aged {age}."),
  choices: [
    { id: "attend", icon: "🕯️", n: T("장례식에 간다", "葬儀に参列する", "Attend the funeral"), d: { happy: -2, social: 2 }, r: T("영정 사진 속 {a}은(는) 웃고 있었다. 함께한 날들이 한꺼번에 떠올랐다.", "遺影の{a}は笑っていた。共に過ごした日々が一度に蘇った。", "In the portrait, {a} was smiling. Every day you shared came rushing back.") },
    { id: "letter", icon: "✉️", n: T("편지와 꽃을 보낸다", "手紙と花を送る", "Send flowers and a letter"), d: { happy: -1 }, r: T("못다 한 말을 편지에 적어 꽃과 함께 보냈다.", "言えなかったことを手紙に書いて花と一緒に送った。", "You wrote the words you never said and sent them with flowers.") },
    { id: "quiet", icon: "🌙", n: T("조용히 기억한다", "静かに偲ぶ", "Remember quietly"), d: { happy: -3 }, r: T("밤하늘을 오래 올려다봤다.", "夜空を長い間見上げた。", "You looked up at the night sky for a long time.") },
  ],
};

// 친구 소식 알림 (해마다 바뀐 점)
export const NOTICE = {
  marry: T("💍 {a}이(가) 결혼했어요!", "💍 {a}が結婚しました!", "💍 {a} got married!"),
  marryMe: T("💍 {a}와(과) 결혼했어요!", "💍 {a}と結婚しました!", "💍 You married {a}!"),
  divorce: T("📄 {a}이(가) 이혼했어요.", "📄 {a}が離婚しました。", "📄 {a} got divorced."),
  kid: T("👶 {a}에게 아이가 생겼어요!", "👶 {a}に子どもが生まれました!", "👶 {a} had a baby!"),
  job: T("💼 {a}이(가) {v}(으)로 일을 시작했어요.", "💼 {a}が{v}として働き始めました。", "💼 {a} started working as {v}."),
  startup: T("🚀 {a}이(가) 창업했어요!", "🚀 {a}が起業しました!", "🚀 {a} started a business!"),
  promo: T("⬆️ {a}이(가) 승진했어요!", "⬆️ {a}が昇進しました!", "⬆️ {a} got promoted!"),
  retire: T("🌇 {a}이(가) 은퇴했어요.", "🌇 {a}が引退しました。", "🌇 {a} retired."),
  house: T("🏠 {a}이(가) 집을 샀어요.", "🏠 {a}が家を買いました。", "🏠 {a} bought a house."),
  pet: T("🐾 {a}에게 반려동물이 생겼어요.", "🐾 {a}がペットを迎えました。", "🐾 {a} adopted a pet."),
  abroad: T("✈️ {a}이(가) 해외로 떠났어요.", "✈️ {a}が海外へ旅立ちました。", "✈️ {a} went abroad."),
  rich: T("💰 {a}이(가) 큰돈을 모았어요.", "💰 {a}が大金を築きました。", "💰 {a} made a fortune."),
  sick: T("🏥 {a}이(가) 많이 아파요.", "🏥 {a}が重い病気です。", "🏥 {a} is seriously ill."),
  death: T("🕯️ {a}이(가) 세상을 떠났어요. ({y1}–{y2})", "🕯️ {a}が亡くなりました。({y1}–{y2})", "🕯️ {a} passed away. ({y1}–{y2})"),
  dream: T("🌟 {a}이(가) 어릴 적 꿈을 이뤘어요!", "🌟 {a}が子どもの頃の夢を叶えました!", "🌟 {a} achieved a childhood dream!"),
  left: T("🚪 {a}이(가) 멀리 떠났어요.", "🚪 {a}が遠くへ去りました。", "🚪 {a} moved far away."),
  memorial: T("🕯️ {a}이(가) {b}을(를) 추모했어요: {v}", "🕯️ {a}が{b}を追悼しました:{v}", "🕯️ {a} left a tribute for {b}: {v}"),
};

/** 공개 프로필 (친구 패널) — 서버가 해마다 만든다. 개인 자유 입력(꿈·편지)은 넣지 않는다 */
export function publicView(p, extra = {}) {
  return {
    name: p.nickname, g: p.gender, age: p.age, alive: !!p.alive, by: p.birthYear, dy: p.alive ? null : (p.birthYear || 0) + (p.deathAge ?? p.age),
    country: p.country || "KR", job: p.job?.title || null, career: p.career || null, step: p.careerStep || 0, edu: p.edu || null,
    married: !!p.spouse, spouse: p.spouse?.name || null, spousePid: p.spouse?.pid || null, kids: (p.kids || []).length, pets: (p.pets || []).filter(x => x.alive !== false).length,
    housing: p.housing, happy: Math.round(p.stats.happy), health: Math.round(p.stats.health), rich: p.stats.money >= 30000 ? 2 : p.stats.money >= 5000 ? 1 : p.stats.money < 0 ? -1 : 0,
    retired: !!p.flags?.has?.("retired"), startup: !!p.flags?.has?.("startup") || p.career === "business", ...extra,
  };
}
/** 공개 프로필 두 장 비교 → 알림 키들 */
export function diffNotices(prev, cur) {
  if (!prev) return [];
  const out = [];
  if (!prev.married && cur.married) out.push({ k: "marry" });
  if (prev.married && !cur.married && cur.alive) out.push({ k: "divorce" });
  if (cur.kids > prev.kids) out.push({ k: "kid" });
  if (cur.job && cur.job !== prev.job && !prev.job) out.push({ k: "job", v: cur.job });
  if (cur.startup && !prev.startup) out.push({ k: "startup" });
  if (cur.step > prev.step && cur.step >= 2) out.push({ k: "promo" });
  if (cur.retired && !prev.retired) out.push({ k: "retire" });
  if (cur.housing === "own" && prev.housing !== "own") out.push({ k: "house" });
  if (cur.pets > prev.pets) out.push({ k: "pet" });
  if (cur.rich === 2 && prev.rich < 2) out.push({ k: "rich" });
  if (cur.health < 20 && prev.health >= 20 && cur.alive) out.push({ k: "sick" });
  if (prev.alive && !cur.alive) out.push({ k: "death", y1: cur.by, y2: cur.dy });
  return out;
}
export const fillT = (s, v = {}) => String(s || "").replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");
/** 한국어 조사 '이(가)' 같은 표기를 이름에 맞게 (받침) */
export function josaKo(s) {
  return s.replace(/([가-힣A-Za-z0-9])(이\(가\)|은\(는\)|을\(를\)|와\(과\)|\(으\)로)/g, (m, ch, j) => {
    const code = ch.charCodeAt(0); const hasB = code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 !== 0 : false; const rieul = code >= 0xac00 && (code - 0xac00) % 28 === 8;
    const pick = { "이(가)": hasB ? "이" : "가", "은(는)": hasB ? "은" : "는", "을(를)": hasB ? "을" : "를", "와(과)": hasB ? "과" : "와", "(으)로": hasB && !rieul ? "으로" : "로" }[j];
    return ch + pick;
  });
}
export const tr = (o, lang = "ko", v = {}) => { const s = fillT(o?.[lang] ?? o?.ko ?? "", v); return lang === "ko" ? josaKo(s) : s; };
