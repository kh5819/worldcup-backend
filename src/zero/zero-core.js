// =========================
// 격리구역: 제로 — 시뮬레이션 엔진 v2 (화면·서버 공용, DOM 없음, 결정론)
// 상태 S는 순수 JSON. 바꾸는 길은 cmd(S, c)와 step(S) 두 개뿐 → 저장·협동(서버 판정)에 그대로 쓰임.
// 이변체의 숨은 규칙은 zero-anoms.js의 규칙 언어를 여기서 실제로 계산하고, 실제로 일어난 일만 증거로 남김.
// =========================
import * as D from "./zero-data.js?v=20261127_z3";
import * as K from "./zero-content.js?v=20261127_z3";
const { T, TICK, DAY_MIN, MIN_PER_TICK } = D;
const AN = D.ANOMS;
const l = (ko, ja, en) => [ko, ja, en];
const DT = 1 / TICK;

// ---------- 난수 ----------
export function rnd(S) { let t = (S.rs = (S.rs + 0x6d2b79f5) | 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const pick = (S, arr) => arr[Math.floor(rnd(S) * arr.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function wpick(S, arr, w) { let tot = 0; for (const x of arr) tot += w(x); let r = rnd(S) * tot; for (const x of arr) { r -= w(x); if (r <= 0) return x; } return arr[arr.length - 1]; }

// ---------- 기록 글 ----------
export const LOG = {
  start: l("{d}일차 근무 시작. 오늘 에너지 목표 {q}", "{d}日目の勤務開始。本日のエネルギー目標 {q}", "Day {d} begins. Energy quota: {q}"),
  res: l("{s} → {a} {m}: {r} (에너지 +{e}, 데이터 +{x})", "{s} → {a} {m}：{r}（エネルギー+{e}、データ+{x}）", "{s} → {a} {m}: {r} (+{e} energy, +{x} data)"),
  stage: l("🔬 {a} 연구 {n}단계 「{t}」 달성", "🔬 {a} 研究段階{n}「{t}」到達", "🔬 {a}: research stage {n} — {t}"),
  warn: l("⚠️ {a} 격리 안정도 {v}% — 위험", "⚠️ {a} 収容安定度 {v}% — 危険", "⚠️ {a} containment at {v}% — critical"),
  breach: l("🚨 격리 실패! {a}이(가) 탈출했다", "🚨 収容違反！{a}が脱走した", "🚨 CONTAINMENT BREACH — {a} has escaped"),
  recon: l("✅ {a} 재격리 성공 ({s})", "✅ {a} 再収容成功（{s}）", "✅ {a} recontained ({s})"),
  selfback: l("✅ {a}이(가) 스스로 잠잠해졌다", "✅ {a}が自ら静まった", "✅ {a} settled down on its own"),
  weak: l("{a}이(가) 약해졌다 — 지금 재격리하세요", "{a}が弱った — 今のうちに再収容を", "{a} is weakened — recontain it now"),
  revive: l("{a}이(가) 다시 힘을 되찾았다", "{a}が力を取り戻した", "{a} has recovered its strength"),
  down: l("💥 {s} 쓰러짐!", "💥 {s} がダウン！", "💥 {s} is down!"),
  lost: l("✝ {s} 순직… 동료들이 큰 충격을 받았다", "✝ {s} 殉職…仲間たちは大きな衝撃を受けた", "✝ {s} has been lost… the team is shaken"),
  treated: l("🩹 {s}이(가) {t}을(를) 치료했다", "🩹 {s} が {t} を治療した", "🩹 {s} treated {t}"),
  panic: l("😱 {s} 패닉! 안전한 곳으로 도망친다", "😱 {s} パニック！安全な場所へ逃げる", "😱 {s} panics and flees to safety"),
  calm: l("{s}이(가) 진정했다", "{s} が落ち着いた", "{s} has calmed down"),
  fault: l("⚡ 발전기 고장! 전력이 떨어진다", "⚡ 発電機故障！電力低下", "⚡ Generator fault! Power is dropping"),
  fixed: l("🔧 {s}이(가) 발전기를 고쳤다", "🔧 {s} が発電機を修理した", "🔧 {s} fixed the generator"),
  emerg: l("🔋 비상 전력 가동 (−{c})", "🔋 非常電力起動（−{c}）", "🔋 Emergency power online (−{c})"),
  mute: l("🔕 경보를 껐다", "🔕 警報を止めた", "🔕 Alarms muted"), unmute: l("🔔 경보를 다시 켰다", "🔔 警報を再開した", "🔔 Alarms restored"),
  lock: l("🔒 문 봉쇄", "🔒 扉を封鎖", "🔒 Door sealed"), unlock: l("🔓 문 개방", "🔓 扉を開放", "🔓 Door opened"),
  blocked: l("{s}: 길이 막혀서 갈 수 없어요", "{s}：道がふさがれていて行けません", "{s}: the way is blocked"),
  zone: l("{z} {r}까지 번졌다", "{z}が{r}まで広がった", "{z} spread into the {r}"),
  cleared: l("✂️ {s}이(가) {r}을(를) 정리했다", "✂️ {s} が{r}を片付けた", "✂️ {s} cleared the {r}"),
  reconFail: l("{a}: {s}은(는) 아직 재격리할 수 없어요 — {w}", "{a}：{s}はまだ再収容できません — {w}", "{a}: {s} can't recontain it yet — {w}"),
  hypOk: l("💡 가설 확인: 「{h}」 → 맞았다! (데이터 +{x})", "💡 仮説確認：「{h}」→ 正解！（データ+{x}）", "💡 Hypothesis \"{h}\" → correct! (+{x} data)"),
  hypNo: l("❌ 가설 판정이 틀렸다: 「{h}」", "❌ 仮説の判定が誤り：「{h}」", "❌ Wrong call on \"{h}\""),
  levelup: l("⬆️ {s} 레벨 {n}! ({t} +1)", "⬆️ {s} レベル{n}！（{t}+1）", "⬆️ {s} reached level {n}! ({t} +1)"),
  bond: l("🤝 {s}와(과) {t}이(가) 친해졌다", "🤝 {s} と {t} が親しくなった", "🤝 {s} and {t} have become friends"),
  endday: l("🕕 18:00 근무 종료", "🕕 18:00 勤務終了", "🕕 18:00 — shift over"),
  dark: l("🌑 시설이 어두워졌다 (전력 {v}%)", "🌑 施設が暗くなった（電力{v}%）", "🌑 The facility goes dark (power {v}%)"),
  built: l("🏗️ {r} 건설 완료 (−{c})", "🏗️ {r} 建設完了（−{c}）", "🏗️ {r} built (−{c})"),
  demolish: l("🧱 {r} 철거", "🧱 {r} を撤去", "🧱 {r} demolished"),
  admit: l("📦 새 이변체 {a} 수용", "📦 新しい異変体 {a} を収容", "📦 New anomaly {a} admitted"),
  hire: l("🧑‍🔬 {s} 입사 ({j})", "🧑‍🔬 {s} 入社（{j}）", "🧑‍🔬 {s} joined ({j})"),
  craft: l("🛠️ {g} 제작 (−{c})", "🛠️ {g} 製作（−{c}）", "🛠️ Crafted {g} (−{c})"),
  equip: l("🎒 {s}: {g} 장착", "🎒 {s}：{g} 装備", "🎒 {s} equipped {g}"),
  reso: l("✨ 공명 발견: 「{n}」", "✨ 共鳴発見：「{n}」", "✨ Resonance discovered: \"{n}\""),
  reveal: l("🔮 {a}: 오늘 {t}에 발전기가 멈출 것", "🔮 {a}：今日{t}に発電機が止まる", "🔮 {a}: the generator will fail at {t} today"),
  floor: l("⛏️ 새 층 B{n}이(가) 열렸다", "⛏️ 新しい階 B{n} が開いた", "⛏️ New level B{n} is open"),
  bailout: l("🏦 자금이 바닥나 본부가 긴급 지원을 보냈다 (+{c}, 다음은 없음)", "🏦 資金が尽き、本部が緊急支援を送った（+{c}、次はない）", "🏦 Funds ran dry — HQ sent emergency support (+{c}, last time)"),
  ev: l("📣 사건: {t}", "📣 事件：{t}", "📣 Event: {t}"),
  evr: l("→ {t}", "→ {t}", "→ {t}"),
  doorsShift: l("🚦 신호가 바뀌며 문들이 멋대로 잠겼다", "🚦 信号が変わり扉が勝手に施錠された", "🚦 The signal changed and doors locked themselves"),
  liftBlock: l("🌀 엘리베이터가 끝없는 계단으로 바뀌었다", "🌀 エレベーターが終わりなき階段に変わった", "🌀 The elevator has become an endless staircase"),
  explore: l("🚪 {s}이(가) 문 너머 도시를 탐사하고 돌아왔다", "🚪 {s} が扉の向こうの街を探査して戻った", "🚪 {s} explored the city beyond the door and returned"),
  gearGet: l("🎁 장비 획득: {g}", "🎁 装備入手：{g}", "🎁 Gear obtained: {g}"),
  coinWin: l("자판기가 음료를 세 개 토해냈다! 모두 기분이 좋아졌다", "自販機が飲み物を三本吐き出した！みんなご機嫌", "The machine spat out three drinks! Everyone cheers up"),
  coinLose: l("자판기가 쓰러질 뻔했다… 수리비 −30", "自販機が倒れかけた…修理費−30", "The machine nearly toppled… −30 repairs"),
  compared: l("📑 {s}이(가) {a}의 흐릿한 기록 {n}건을 비교해 밝혀냈다", "📑 {s}が{a}のあいまいな記録{n}件を照合して解明した", "📑 {s} cross-checked {n} vague record(s) on {a}"),
  secret: l("🗝️ 기밀 문서 {n}번을 손에 넣었다", "🗝️ 機密文書{n}番を手に入れた", "🗝️ Classified file #{n} obtained"),
  checkOk: l("설득 성공", "説得成功", "Persuasion worked"), checkBad: l("설득 실패", "説得失敗", "Persuasion failed"),
  viewer: l("📺 시청자 {s}이(가) 직원으로 입사했다", "📺 視聴者{s}が職員として入社した", "📺 Viewer {s} joined the staff"),
  vote: l("🗳️ 시청자 투표 결과: {t}", "🗳️ 視聴者投票の結果：{t}", "🗳️ Viewer vote result: {t}"),
  don: l("💝 {n}님 후원 → {t}", "💝 {n}さんの支援 → {t}", "💝 {n}'s donation → {t}"),
};
export const RES_NAME = { great: l("대성공", "大成功", "Excellent"), good: l("성공", "成功", "Good"), normal: l("보통", "普通", "Normal"), bad: l("실패", "失敗", "Bad") };
export const ZONE_NAME = { vines: l("🌿 덩굴이", "🌿 つるが", "🌿 Vines"), paper: l("📄 종이가", "📄 紙が", "📄 Paper"), chairs: l("🪑 빈 의자가", "🪑 空の椅子が", "🪑 Empty chairs") };
export const ZONE_THING = { vines: l("덩굴", "つる", "vines"), paper: l("종이 더미", "紙の山", "paper"), chairs: l("빈 의자", "空の椅子", "empty chairs") };
const FLOWER = { white: l("하얀", "白い", "white"), black: l("검은", "黒い", "black") };
const SIGNAL = ["red", "yellow", "green"];

// ---------- 새 게임 ----------
export function newGame(o = {}) {
  const seed = (o.seed ?? 12345) >>> 0;
  const S = { v: D.VERSION, seed, rs: seed || 1, tick: 0, day: 1, min: 0, phase: "prep", diff: o.diff || "normal", mode: o.mode || "campaign", tut: o.tut ? 1 : 0,
    res: { money: 1400, energy: 0, quota: 0, power: 100 }, gen: { broken: false }, nextFault: -1, faultSeen: false, emerg: 0, emergCd: 0, emergFree: 0, muted: false, liftBlocked: false,
    rooms: [], doors: [], staff: [], anoms: [], log: [], fx: [], today: null, hist: [], dark: false, floors: 3, cands: [], hires: [], inv: {}, unlock: {}, bailout: 0,
    ev: { next: 0, cur: null, done: {}, flags: {} }, reso: {}, ending: null, lostTotal: 0, metDays: 0, nid: 1, rides: 0, staffSeq: 1, players: o.players || 1 };
  for (const fl of D.LAYOUT) for (const [type, a, b, anom] of fl.rooms) S.rooms.push({ id: S.rooms.length, type, f: fl.f, x0: a * T, x1: b * T, alarm: 0, zone: null, flick: 0, anom: null, home: anom || null });
  buildDoors(S);
  D.START_STAFF.forEach((p) => addStaff(S, { name: p.name, job: p.job, traits: p.traits, look: p.look, bonus: p.bonus }));
  for (const r of S.rooms) if (r.home) addAnom(S, r.home, r.id);
  if (o.daily) applyDaily(S, o.daily);
  // 해금 보너스 (업적으로 연 것) — 일일 도전에는 없음
  const B = o.daily ? [] : o.bonus || [];
  if (B.includes("money")) S.res.money += 300;
  if (B.includes("vet")) { const s = S.staff.find((q) => q.job === "researcher"); if (s) { s.lv = 2; s.st.obs++; s.st.foc++; s.maxHp += 6; s.hp = s.maxHp; } }
  if (B.includes("kit")) { for (const g of ["e_vest", "e_flash", "e_clip"]) S.inv[g] = (S.inv[g] || 0) + 1; }
  if (B.includes("aide")) addStaff(S, { name: l("아델 문", "アデル・ムン", "Adele Moon"), job: "researcher", traits: ["sharp", "calm"], bonus: { obs: 2, foc: 1 }, look: { skin: 1, hair: 5, hc: 5, f: 1 } });
  S.bonus = B.slice(0, 4); S.secrets = {};
  startPrep(S);
  return S;
}
function buildDoors(S) { S.doors = []; for (const r of S.rooms) { const nb = S.rooms.find((q) => q.f === r.f && q.x0 === r.x1); if (nb) S.doors.push({ id: S.doors.length, f: r.f, x: r.x1, a: r.id, b: nb.id, lock: false }); } }
export function addStaff(S, p) {
  const J = D.JOBS[p.job], st = { ...J.base }; for (const k in p.bonus || {}) st[k] += p.bonus[k];
  const r = S.rooms[postOf(S, p.job)], id = S.staffSeq++;
  const hp = Math.round(J.hp * ((p.traits || []).includes("tough") ? 1.25 : 1));
  const s = { id, name: p.name, job: p.job, traits: (p.traits || []).slice(), look: { ...p.look, job: p.job }, st, lv: 1, xp: 0, maxHp: hp, hp, stress: 8, fat: 0,
    f: r.f, x: (r.x0 + r.x1) / 2 + ((id % 5) - 2) * 14, dir: 1, task: null, path: null, ride: null, prog: 0, wt: 0, auto: true, cond: "ok", panic: false, anim: "idle", rel: {}, gear: { hand: null, body: null, acc: null },
    viewer: p.viewer || null, hist: { works: 0, great: 0, fights: 0, treats: 0, repairs: 0, downs: 0, days: 0, mstat: {}, joined: S.day, energy: 0 } };
  S.staff.push(s); return s;
}
function addAnom(S, kind, rid) {
  const A = AN[kind], r = S.rooms[rid]; r.anom = kind; r.home = null;
  S.anoms.push({ id: kind, home: rid, room: rid, f: r.f, x: (r.x0 + r.x1) / 2, st: "in", stab: 80, hp: A.breach.hp || 0, data: 0, stage: 0, last: null, cnt: {}, quiet: -1, idle: 0, weakT: 0, moveT: 0, autoT: 0,
    hyp: Object.fromEntries(A.hyp.map((h) => [h.id, "open"])), ev: Object.fromEntries(A.hyp.map((h) => [h.id, { pos: 0, neg: 0 }])), obs: [], ep: {}, warned: false, breaches: 0, works: 0, mood: 0, flower: null, workers: {}, since: S.day });
}
function postOf(S, job) { const t = { researcher: "control", security: "control", medic: "medbay", tech: "generator" }[job] || "lounge"; return (S.rooms.find((r) => r.type === t) || S.rooms.find((r) => r.type === "lounge")).id; }

// ---------- 공용 도우미 ----------
export const openFloor = (S, f) => f < S.floors;
export const roomAt = (S, f, x) => S.rooms.find((r) => r.f === f && x >= r.x0 && x < r.x1) || S.rooms.find((r) => r.f === f && x === r.x1);
export const staffById = (S, id) => S.staff.find((s) => s.id === id);
export const anomById = (S, id) => S.anoms.find((a) => a.id === id);
export const ctr = (r) => (r.x0 + r.x1) / 2;
export const facN = (S, t) => S.rooms.filter((r) => r.type === t && openFloor(S, r.f)).length;
export function stressState(s) { if (s.cond !== "ok") return s.cond; if (s.panic) return "panic"; for (const [v, k] of D.STRESS_STATE) if (s.stress < v) return k; return "panic"; }
const has = (s, t) => s.traits.includes(t);
const diffOf = (S) => D.DIFFS[S.diff] || D.DIFFS.normal;
export const alarmCount = (S) => (S.muted ? 0 : S.rooms.filter((r) => r.alarm > 0).length);
export const say = (S, k, a = {}) => { S.log.push({ d: S.day, m: Math.floor(S.min), k, a }); if (S.log.length > 250) S.log.splice(0, S.log.length - 250); };
export const fx = (S, k, o = {}) => { S.fx.push({ k, t: S.tick, n: S.nid++, ...o }); if (S.fx.length > 80) S.fx.splice(0, S.fx.length - 80); };
const nameRef = (s) => ({ $n: s.name });
const aRef = (a) => ({ $n: AN[a.id].name, $a: a.id });
function workX(S, r) { const nb = S.doors.find((d) => d.a === r.id || d.b === r.id); if (!nb) return ctr(r); return ctr(r) + (nb.x > ctr(r) ? 52 : -52); }
export function stageOf(data) { let n = 0; for (let i = 0; i < D.STAGES.length; i++) if (data >= D.STAGES[i]) n = i; return n; }
const ruleOn = (a, id) => a.hyp[id] === "ok";
export const signalOf = (S) => SIGNAL[Math.floor(S.min / 60) % 3];
const okStaff = (S) => S.staff.filter((s) => s.cond === "ok");
// 장비 효과 합치기
const gfxCache = new Map();
export function gfx(s) {
  const key = (s.gear.hand || "") + "|" + (s.gear.body || "") + "|" + (s.gear.acc || ""); if (gfxCache.has(key)) return gfxCache.get(key);
  const o = { st: {}, fight: 1, armor: 1, stressRes: 1, noise: 0, dark: 0, data: 1, energy: 1, move: 1, repair: 1, work: 1, fat: 1, xp: 1, calm: 0, sleepRes: 0, see: 0, method: {}, weapon: 0 };
  for (const g of [s.gear.hand, s.gear.body, s.gear.acc]) { const G = g && K.GEAR[g]; if (!G) continue; const f = G.fx; if (G.w) o.weapon = 1;
    for (const k in f.st || {}) o.st[k] = (o.st[k] || 0) + f.st[k];
    for (const k of ["fight", "armor", "stressRes", "data", "energy", "move", "repair", "work", "fat", "xp"]) if (f[k]) o[k] *= f[k];
    for (const k of ["noise", "dark", "calm", "sleepRes", "see"]) if (f[k]) o[k] = Math.max(o[k], f[k]);
    if (f.method) o.method[f.method[0]] = (o.method[f.method[0]] || 0) + f.method[1]; }
  gfxCache.set(key, o); return o;
}
export const stat = (s, k) => s.st[k] + (gfx(s).st[k] || 0);

// ---------- 규칙 언어 ----------
function friendNear(S, s) { return S.staff.some((o) => o !== s && o.cond === "ok" && o.f === s.f && (s.rel[o.id] || 0) >= 20); }
const roomOf = (S, s) => roomAt(S, s.f, s.x);
const inRoom = (S, r) => S.staff.filter((q) => q.cond === "ok" && roomOf(S, q) === r).length;
function cond(S, a, c, ctx) {
  const s = ctx.s, [k, v, w] = c;
  switch (k) {
    case "power<": return S.res.power < v; case "power>=": return S.res.power >= v;
    case "alarms>": return alarmCount(S) > v; case "alarms==": return alarmCount(S) === v;
    case "method": return ctx.m === v; case "prevMethod": return a.last?.m === v;
    case "sameWorker": return !!s && a.last?.sid === s.id; case "sameMethod": return !!ctx.m && a.last?.m === ctx.m;
    case "stress>=": return !!s && s.stress >= v; case "stress<": return !!s && s.stress < v;
    case "count>": return (w ? a.cnt[w] || 0 : a.cnt.all || 0) > v;
    case "quiet": return a.quiet > S.min;
    case "time": return S.min >= v && S.min < w;
    case "friendNear": return !!s && friendNear(S, s);
    case "lost>": return S.staff.filter((q) => q.cond === "lost").length > v;
    case "stat>=": return !!s && stat(s, v) >= w;
    case "lv>=": return !!s && s.lv >= v; case "lvMax": return !!s && s.lv <= v;
    case "signal": return signalOf(S) === v;
    case "result": return ctx.r === v; case "notResult": return !!ctx.r && ctx.r !== v;
    case "genBroken": return S.gen.broken;
    case "roomStaff>=": return !!s && inRoom(S, roomOf(S, s)) >= v;
    case "aloneRoom": return !!s && inRoom(S, roomOf(S, s)) === 1;
    case "trait": return !!s && has(s, v);
    case "hp<": return !!s && s.hp < s.maxHp * v;
    case "aloneFloor": return !!s && !S.staff.some((q) => q !== s && q.cond === "ok" && q.f === s.f);
    case "weapon": return !!s && !!gfx(s).weapon;
    case "resting": return S.staff.some((q) => q.cond === "ok" && q.task?.k === "rest" && !q.path);
    case "job": return !!s && s.job === v; case "notJob": return !!s && s.job !== v;
    case "fac": return facN(S, v) > 0;
    case "fat>=": return !!s && s.fat >= v;
    case "friendWorked": return !!s && Object.keys(a.workers).some((id) => +id !== s.id && (s.rel[id] || 0) >= 20);
    case "idle>": return a.idle > v;
    case "dark": return S.dark;
    case "ride": return S.rides > 0;
    case "floorStress>=": return S.staff.some((q) => q.cond === "ok" && q.f === a.f && q.stress >= v);
    case "staffCount<=": return S.staff.filter((q) => q.cond !== "lost").length <= v;
    case "faultToday": return S.nextFault > S.min;
    case "noZones": return !S.rooms.some((r) => r.zone && r.id !== a.home);
  }
  return false;
}
const allc = (S, a, cs, ctx) => (cs || []).every((c) => cond(S, a, c, ctx));
function evArgs(S, a, ctx) { const s = ctx.s; return { s: s ? nameRef(s) : "", v: s ? (ctx.vk === "lv" ? s.lv : ctx.vk === "fat" ? Math.round(s.fat) : Math.round(s.stress)) : Math.round(S.res.power), n: ctx.n ?? alarmCount(S), t: clockText(S.min), c: ctx.c }; }
function evidence(S, a, hid, sign, args = {}, once, vague) {
  if (!hid || !a.ev[hid]) return; if (once) { if (a.ep[hid + sign]) return; a.ep[hid + sign] = 1; }
  if (sign < 0) { a.ep["n" + hid] = (a.ep["n" + hid] || 0) + 1; if (a.ep["n" + hid] > 3) return; }
  const e = a.ev[hid]; if (vague) e.vague = (e.vague || 0) + 1; else if (sign > 0) e.pos++; else e.neg++;
  a.obs.unshift({ d: S.day, m: Math.floor(S.min), h: hid, s: sign, a: args, v: vague ? 1 : 0 }); if (a.obs.length > 40) a.obs.pop();
  fx(S, "clue", { aid: a.id });
}
// 관찰력이 낮은 직원의 기록은 흐릿할 수 있음 (관찰력 7 이상이면 늘 또렷)
const vagueRoll = (S, s) => !!s && rnd(S) < clamp((7 - stat(s, "obs")) * 0.15, 0, 0.6);
// 기록 비교: 흐릿한 기록을 또렷하게
function clarify(S, a) { let n = 0; for (const o of a.obs) if (o.v) { o.v = 0; const e = a.ev[o.h]; if (e) { e.vague = Math.max(0, (e.vague || 0) - 1); if (o.s > 0) e.pos++; else e.neg++; } n++; } return n; }
export const vagueCount = (a) => a.obs.filter((o) => o.v).length;

// ---------- 길찾기 ----------
function neighbors(S, r, ignoreLocks) {
  const out = [];
  for (const d of S.doors) if (d.a === r.id || d.b === r.id) { if (d.lock && !ignoreLocks) continue; out.push([d.a === r.id ? d.b : d.a, Math.abs(d.x - ctr(r))]); }
  if (r.type === "elevator" && !S.liftBlocked) for (const q of S.rooms) if (q.type === "elevator" && Math.abs(q.f - r.f) === 1 && openFloor(S, q.f)) out.push([q.id, 60]);
  return out;
}
export function findPath(S, f, x, tf, tx, ignoreLocks) {
  const r0 = roomAt(S, f, x), r1 = roomAt(S, tf, tx); if (!r0 || !r1 || !openFloor(S, tf)) return null;
  if (r0.id === r1.id) return [{ f: tf, x: tx }];
  const dist = new Map([[r0.id, 0]]), prev = new Map(), open = [r0.id];
  while (open.length) {
    open.sort((p, q) => dist.get(p) - dist.get(q)); const u = open.shift(); if (u === r1.id) break;
    for (const [v, c] of neighbors(S, S.rooms[u], ignoreLocks)) { const nd = dist.get(u) + c; if (nd < (dist.get(v) ?? 1e9)) { dist.set(v, nd); prev.set(v, u); open.push(v); } }
  }
  if (!prev.has(r1.id)) return null;
  const chain = [r1.id]; while (chain[0] !== r0.id) chain.unshift(prev.get(chain[0]));
  const wps = [];
  for (let i = 1; i < chain.length; i++) { const a = S.rooms[chain[i - 1]], b = S.rooms[chain[i]]; if (a.f !== b.f) { wps.push({ f: a.f, x: ctr(a) }); wps.push({ f: b.f, x: ctr(b), lift: 1 }); } }
  wps.push({ f: tf, x: tx });
  return wps;
}
function pathCost(S, f, x, tf, tx) { const p = findPath(S, f, x, tf, tx); if (!p) return 1e9; let c = 0, cf = f, cx = x; for (const w of p) { c += w.f !== cf ? 60 * Math.abs(w.f - cf) : Math.abs(w.x - cx); cf = w.f; cx = w.x; } return c; }

// ---------- 명령 ----------
export function cmd(S, c) {
  const r = cmd0(S, c); if (r.ok && S.rec) S.rec.push({ t: S.tick, c }); return r;
}
// 명령 입구 검사: 객체 기본 속성 이름(__proto__·length 등)으로 목록 검사를 통과하는 것 막기 (협동 방 조작 방지)
const BADKEY = new Set(["__proto__", "constructor", "prototype", "length", "toString", "valueOf", "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable", "toLocaleString", "__defineGetter__", "__lookupGetter__"]);
function cleanCmd(c, depth = 0) {
  if (c == null || typeof c !== "object" || Array.isArray(c) || depth > 2) return false;
  for (const k of Object.keys(c)) { if (BADKEY.has(k)) return false; const v = c[k];
    if (typeof v === "string" && (BADKEY.has(v) || v.length > 40)) return false;
    if (typeof v === "number" && !Number.isFinite(v)) return false;
    if (v && typeof v === "object" && !cleanCmd(v, depth + 1)) return false; }
  for (const k of ["i", "rid", "sid"]) if (c[k] != null && !Number.isInteger(c[k])) return false;
  return true;
}
function cmd0(S, c) {
  const err = (e) => ({ ok: false, err: e });
  if (!cleanCmd(c)) return err("bad");
  if (S.ending && c.k !== "endless") return err("ended");
  switch (c.k) {
    case "start": if (S.phase !== "prep") return err("phase"); S.phase = "work"; say(S, "start", { d: S.day, q: S.res.quota }); return { ok: true };
    case "next": if (S.phase !== "end" || S.dailyDone) return err("phase"); S.day++; startPrep(S); return { ok: true };
    case "endless": if (!S.ending || S.ending === "closed") return err("phase"); S.ending = null; S.mode = "endless"; S.day++; startPrep(S); return { ok: true };
    case "order": {
      if (S.phase !== "work" || S.ev.cur) return err("phase");
      const s = staffById(S, c.sid); if (!s || s.cond !== "ok") return err("staff"); if (s.panic) return err("panic");
      const t = c.task; if (!t || !validTask(S, s, t)) return err("task");
      setTask(S, s, { ...t, by: "p" }); return s.task ? { ok: true } : err("blocked");
    }
    case "cancel": { const s = staffById(S, c.sid); if (!s || s.cond !== "ok" || s.panic) return err("staff"); setTask(S, s, null); return { ok: true }; }
    case "auto": { const s = staffById(S, c.sid); if (!s) return err("staff"); s.auto = !!c.v; return { ok: true }; }
    case "judge": {
      const a = anomById(S, c.aid); if (!a) return err("anom"); const h = AN[a.id].hyp.find((q) => q.id === c.hid); if (!h) return err("hyp");
      if (a.hyp[h.id] !== "open") return err("done"); const e = a.ev[h.id]; if (e.pos + e.neg < 1) return err("noev");
      const arch = facN(S, "archive");
      if (!!c.v === !!h.t) { a.hyp[h.id] = h.t ? "ok" : "no"; a.judged = a.judged || {}; a.judged[h.id] = 1; const x = 25 + arch * 15; gainData(S, a, x); say(S, "hypOk", { h: { $n: h.s }, x }); fx(S, "hypok", { aid: a.id }); }
      else { if (!arch) a.hyp[h.id] = "wrong"; a.data = Math.max(D.STAGES[a.stage], a.data - 12); a.stab = Math.max(0, a.stab - 10); say(S, "hypNo", { h: { $n: h.s } }); fx(S, "hypno", { aid: a.id }); }
      return { ok: true };
    }
    case "mute": if (S.phase !== "work") return err("phase"); S.muted = !S.muted; say(S, S.muted ? "mute" : "unmute"); return { ok: true };
    case "emerg": {
      if (S.phase !== "work") return err("phase"); if (S.min < S.emergCd) return err("cool");
      const free = facN(S, "battery") > 0 && !S.emergFree, cost = free ? 0 : 120; if (S.res.money < cost) return err("money");
      if (free) S.emergFree = 1; S.res.money -= cost; S.emerg = S.min + 60; S.emergCd = S.min + 150; S.today.spent += cost; say(S, "emerg", { c: cost }); fx(S, "emerg"); return { ok: true };
    }
    case "lock": { const d = S.doors[c.did]; if (!d || S.phase !== "work") return err("door"); const ra = S.rooms[d.a], rb = S.rooms[d.b]; if (ra.type === "elevator" || rb.type === "elevator") return err("door"); d.lock = !d.lock; d.sig = 0; say(S, d.lock ? "lock" : "unlock"); for (const s of S.staff) if (s.path) replan(S, s); return { ok: true }; }
    // ── 아침 준비 ──
    case "build": {
      if (S.phase !== "prep") return err("phase"); const r = S.rooms[c.rid], B = K.BUILD[c.t]; if (!r || r.type !== "lot" || !B || !openFloor(S, r.f)) return err("lot");
      if (S.res.money < B.cost) return err("money"); S.res.money -= B.cost; r.type = c.t; S.built = (S.built || 0) + 1; say(S, "built", { r: { $n: D.ROOM_TYPES[c.t].name }, c: B.cost }); fx(S, "built", { rid: r.id }); return { ok: true };
    }
    case "demolish": {
      if (S.phase !== "prep") return err("phase"); const r = S.rooms[c.rid]; if (!r || !K.BUILD[r.type] || r.anom || D.LAYOUT[r.f].rooms.some((q) => q[0] === r.type && q[1] * T === r.x0)) return err("room");
      const B = K.BUILD[r.type]; S.res.money += Math.round(B.cost / 2); say(S, "demolish", { r: { $n: D.ROOM_TYPES[r.type].name } }); r.type = "lot"; return { ok: true };
    }
    case "admit": {
      if (S.phase !== "prep") return err("phase"); if (!S.cands.includes(c.aid) || anomById(S, c.aid)) return err("cand");
      const r = S.rooms.find((q) => q.type === "contain" && !q.anom && openFloor(S, q.f) && (c.rid == null || q.id === c.rid)); if (!r) return err("cell");
      addAnom(S, c.aid, r.id); S.cands = S.cands.filter((x) => x !== c.aid); say(S, "admit", { a: aRef(anomById(S, c.aid)) }); fx(S, "admit", { aid: c.aid }); return { ok: true };
    }
    case "hire": {
      if (S.phase !== "prep") return err("phase"); const h = S.hires[c.i]; if (!h) return err("cand"); if (staffCount(S) >= staffCap(S)) return err("cap"); if (S.res.money < h.cost) return err("money");
      S.res.money -= h.cost; const s = addStaff(S, h); S.hires.splice(c.i, 1); say(S, "hire", { s: nameRef(s), j: { $n: D.JOBS[s.job].name } }); fx(S, "hire", { sid: s.id }); return { ok: true, sid: s.id };
    }
    case "craft": {
      const G = K.GEAR[c.g]; if (!G) return err("gear"); if (G.from && (!S.unlock[c.g] || !facN(S, "workshop"))) return err("locked");
      const cost = gearCost(S, c.g); if (S.res.money < cost) return err("money"); S.res.money -= cost; S.inv[c.g] = (S.inv[c.g] || 0) + 1; if (S.today) S.today.spent += cost; say(S, "craft", { g: { $n: G.name }, c: cost }); return { ok: true };
    }
    case "equip": {
      const s = staffById(S, c.sid); if (!s || s.cond === "lost") return err("staff");
      if (c.g == null) { const old = s.gear[c.slot]; if (!old) return err("slot"); s.gear[c.slot] = null; S.inv[old] = (S.inv[old] || 0) + 1; return { ok: true }; }
      const G = K.GEAR[c.g]; if (!G || !(S.inv[c.g] > 0)) return err("inv"); const old = s.gear[G.slot]; if (old) S.inv[old] = (S.inv[old] || 0) + 1; S.inv[c.g]--; s.gear[G.slot] = c.g; say(S, "equip", { s: nameRef(s), g: { $n: G.name } }); return { ok: true };
    }
    case "choose": {
      const e = S.ev.cur; if (!e) return err("noev"); const E = K.EVENTS.find((q) => q.id === e.id), ch = E?.ch[c.i]; if (!ch) return err("choice");
      applyEvent(S, e, ch); S.ev.cur = null; return { ok: true };
    }
  }
  return err("unknown");
}
export const staffCount = (S) => S.staff.filter((s) => s.cond !== "lost").length;
export const staffCap = (S) => D.STAFF_CAP + 2 * facN(S, "dorm");
export const gearCost = (S, g) => Math.round(K.GEAR[g].cost * (facN(S, "storage") ? 0.8 : 1));
export function validTask(S, s, t) {
  switch (t.k) {
    case "move": return !!S.rooms[t.rid] && openFloor(S, S.rooms[t.rid].f);
    case "rest": return true;
    case "research": { const a = anomById(S, t.aid); const M = D.METHODS[t.m]; return !!a && !!M && a.st === "in" && (M.need || 0) <= a.stage && !S.staff.some((o) => o !== s && o.task?.k === "research" && o.task.aid === a.id); }
    case "repair": return S.gen.broken;
    case "treat": { const o = staffById(S, t.tid); return !!o && o !== s && o.cond !== "lost" && (o.cond === "down" || o.hp < o.maxHp); }
    case "fight": { const a = anomById(S, t.aid); const B = a && AN[a.id].breach; return !!a && a.st === "out" && B.hp > 0 && B.fight !== 0 && ["hop", "roam", "mimic"].includes(B.type); }
    case "recon": { const a = anomById(S, t.aid); return !!a && (a.st === "out" || a.st === "weak"); }
    case "clear": { const r = S.rooms[t.rid]; return !!r && !!r.zone; }
    case "compare": { const a = anomById(S, t.aid); return !!a && vagueCount(a) > 0 && !S.staff.some((o) => o !== s && o.task?.k === "compare" && o.task.aid === a.id); }
  }
  return false;
}
function setTask(S, s, t) { s.task = t; s.prog = 0; s.wt = 0; s.path = null; s.ride = null; if (t) replan(S, s); }
function taskTarget(S, s, t) {
  switch (t.k) {
    case "move": { const r = S.rooms[t.rid]; return { f: r.f, x: ctr(r) + ((s.id % 5) - 2) * 12 }; }
    case "rest": { const r = restRoom(S); return { f: r.f, x: ctr(r) + ((s.id % 5) - 2) * 22 }; }
    case "research": { const a = anomById(S, t.aid), r = S.rooms[a.home]; return { f: r.f, x: workX(S, r) }; }
    case "repair": { const r = S.rooms.find((q) => q.type === "generator"); return { f: r.f, x: ctr(r) + 30 }; }
    case "treat": { const o = staffById(S, t.tid); return { f: o.f, x: o.x + (o.x > s.x ? -14 : 14) }; }
    case "fight": case "recon": { const a = anomById(S, t.aid); const ty = AN[a.id].breach.type; if (ty === "static" || ty === "zone") { const h = S.rooms[a.home]; return { f: h.f, x: workX(S, h) }; } return { f: a.f, x: a.x + (s.x < a.x ? -30 : 30) }; }
    case "clear": { const r = S.rooms[t.rid]; return { f: r.f, x: ctr(r) }; }
    case "compare": { const r = S.rooms.find((q) => q.type === "archive" && openFloor(S, q.f)) || S.rooms.find((q) => q.type === "control"); return { f: r.f, x: ctr(r) + ((s.id % 5) - 2) * 14 }; }
    case "flee": return { f: t.f, x: t.x };
  }
  return null;
}
function restRoom(S) { return S.rooms.find((q) => q.type === "counsel" && openFloor(S, q.f)) || S.rooms.find((q) => q.type === "lounge"); }
function replan(S, s) {
  if (!s.task) { s.path = null; return; }
  const g = taskTarget(S, s, s.task); if (!g) { s.task = null; return; }
  s.goal = g; s.path = findPath(S, s.f, s.x, g.f, g.x);
  if (!s.path) { say(S, "blocked", { s: nameRef(s) }); fx(S, "blocked", { sid: s.id }); s.task = null; }
}

// ---------- 하루 ----------
function startPrep(S) {
  const d = diffOf(S); S.phase = "prep"; S.min = 0; S.muted = false; S.emerg = 0; S.emergCd = 0; S.emergFree = 0; S.liftBlocked = false;
  for (const fl of D.LAYOUT) if (fl.open && S.day >= fl.open && S.floors <= fl.f) { S.floors = fl.f + 1; say(S, "floor", { n: fl.f + 1 }); fx(S, "floor", { f: fl.f }); }
  const pm = 1 + Math.max(0, (S.players || 1) - 1) * 0.35;
  S.res.quota = Math.round((D.QUOTA[Math.min(S.day, D.QUOTA.length - 1)] + Math.max(0, S.day - 10) * 40) * d.quota * pm * (S.dmod === "rich" ? 1.3 : 1) * (S.mode === "daily" ? 1.4 : 1)); S.res.energy = 0;
  S.today = { energy: 0, works: 0, great: 0, bad: 0, breaches: 0, recons: 0, downs: 0, lost: 0, clues: 0, spent: 0, stages: [], events: [], resos: [] };
  for (const a of S.anoms) { a.cnt = {}; a.ep = {}; a.idle = 0; a.workers = {}; for (const h in a.hyp) if (a.hyp[h] === "wrong") a.hyp[h] = "open"; }
  for (const s of S.staff) if (s.cond === "ok") { const r = S.rooms[postOf(S, s.job)]; s.f = r.f; s.x = ctr(r) + ((s.id % 5) - 2) * 16; s.task = null; s.path = null; s.ride = null; s.panic = false; s.anim = "idle"; s.rootT = 0;
    if (facN(S, "cafeteria")) { s.stress = Math.max(0, s.stress - 15); s.hp = Math.min(s.maxHp, s.hp + 10); } }
  // 오늘 발전기 고장 시각 (창문·편지가 미리 보여 줄 수 있게 미리 정해 둠)
  S.nextFault = rnd(S) < Math.min(0.95, 0.75 * d.fault) ? Math.round(60 + rnd(S) * 480) : -1; S.faultSeen = false;
  if (S.ev.flags.faultDelay) { S.nextFault = -1; delete S.ev.flags.faultDelay; }
  if (S.dmod === "blackout") { S.nextFault = 150; S.fault2 = 380; }
  S.ev.next = 70 + Math.floor(rnd(S) * 60); S.ev.cur = null;
  // 새 이변체 후보 (2일차부터)
  S.cands = [];
  if (S.day >= 2) {
    const maxG = S.day <= 2 ? 2 : S.day <= 5 ? 3 : 4, minG = S.day >= 7 ? 2 : 1;
    const free = Object.keys(AN).filter((id) => !anomById(S, id) && AN[id].grade <= maxG && AN[id].grade >= minG);
    for (let i = 0; i < 3 + (S.extraCand ? 1 : 0) && free.length; i++) { const k = Math.floor(rnd(S) * free.length); S.cands.push(free.splice(k, 1)[0]); }
  }
  S.extraCand = 0; S.hires = []; for (let i = 0; i < 3; i++) S.hires.push(genHire(S));
  S.story = K.STORY[S.day] ? S.day : 0;
}
export function genHire(S, name) {
  const job = pick(S, ["researcher", "researcher", "security", "medic", "tech"]), tr = Object.keys(D.TRAITS); const traits = [];
  while (traits.length < 2) { const t = pick(S, tr); if (!traits.includes(t)) traits.push(t); }
  const used = new Set(S.staff.map((s) => s.name[2])); const names = K.NAMES.filter((n) => !used.has(n[2]));
  const bonus = {}; const k1 = pick(S, D.STATS); bonus[k1] = 1 + (rnd(S) < 0.3 ? 1 : 0);
  return { name: name ? [name, name, name] : names.length ? pick(S, names) : pick(S, K.NAMES), job, traits, bonus, look: { skin: Math.floor(rnd(S) * 4), hair: Math.floor(rnd(S) * 6), hc: Math.floor(rnd(S) * 6), f: rnd(S) < 0.5 ? 1 : 0 }, cost: 180 + (bonus[k1] - 1) * 60 };
}
function endDay(S) {
  S.phase = "end"; say(S, "endday");
  const rec = [];
  for (const a of S.anoms) if (a.st !== "in") { recontain(S, a, null); S.res.money -= 200; rec.push(a.id); }
  for (const r of S.rooms) { r.zone = null; r.alarm = 0; }
  for (const d of S.doors) { d.lock = false; d.sig = 0; }
  S.gen.broken = false; S.ev.cur = null; S.liftBlocked = false;
  const t = S.today, met = S.res.energy >= S.res.quota, alive = S.staff.filter((s) => s.cond !== "lost"), pay = alive.length * 55;
  const income = Math.round(S.res.energy * 3) + (met ? 200 : 0) + facN(S, "storage") * 80;
  S.res.money += income - pay; if (met) S.metDays++;
  const ups = [];
  for (const s of alive) {
    s.hist.days++;
    if (s.cond === "down") { s.cond = "ok"; s.hp = Math.round(s.maxHp * 0.4); }
    s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.3); s.stress = Math.max(0, s.stress * 0.5 - 5); s.fat = 0; s.panic = false;
    while (s.xp >= 45 * s.lv) {
      s.xp -= 45 * s.lv; s.lv++; s.maxHp += 6;
      const ms = Object.entries(s.hist.mstat).sort((a, b) => b[1] - a[1])[0]; const k = ms ? ms[0] : { researcher: "obs", security: "cmb", medic: "emp", tech: "tec" }[s.job];
      s.st[k] = Math.min(15, s.st[k] + 1); ups.push({ sid: s.id, lv: s.lv, st: k }); say(S, "levelup", { s: nameRef(s), n: s.lv, t: { $n: D.STAT_NAME[k] } });
    }
  }
  let bail = 0; if (S.res.money < 0 && !S.bailout) { S.bailout = 1; bail = 600; S.res.money += bail; say(S, "bailout", { c: bail }); }
  secretCheck(S);
  const rep = { day: S.day, energy: Math.round(S.res.energy * 10) / 10, quota: S.res.quota, met, income, pay, rec, ups, bail, ...t, money: S.res.money };
  S.hist.push(rep); if (S.hist.length > 60) S.hist.shift(); S.report = rep;
  if (S.mode === "daily") { S.dailyDone = 1; rep.score = dailyScore(S); }
  else if (alive.length === 0 || S.res.money < 0) S.ending = "closed";
  else if (S.mode === "campaign" && S.day >= 10) S.ending = decideEnding(S);
  if (S.ending) rep.ending = S.ending;
  return rep;
}
// 기밀 문서: 실제로 한 일로만 얻음
export function secretCheck(S) {
  S.secrets = S.secrets || {}; const got = [];
  const give = (id) => { if (S.secrets[id]) return; S.secrets[id] = S.day; got.push(id); say(S, "secret", { n: id.slice(1) }); fx(S, "secret", { id }); };
  if (S.ev.flags.secret1) give("s1"); if (S.ev.flags.secret2) give("s2");
  if (anomById(S, "window")?.stage >= 5) give("s3");
  if (anomById(S, "mimic")?.stage >= 5 || anomById(S, "library")?.stage >= 5) give("s4");
  if (confirmedTrue(S) >= 10) give("s5");
  return got;
}
// ---------- 일일 도전 ----------
export const DAILY_MODS = {
  blackout: l("⚡ 정전의 날: 발전기가 두 번 멈춰요", "⚡ 停電の日：発電機が2回止まる", "⚡ Blackout day: the generator fails twice"),
  short: l("👥 인원 부족: 직원 4명으로 시작", "👥 人手不足：職員4人でスタート", "👥 Short-staffed: start with 4 staff"),
  rich: l("💰 넉넉한 예산: 자금 +1500, 목표 +30%", "💰 潤沢な予算：資金+1500、目標+30%", "💰 Big budget: +1500 funds, +30% quota"),
  uneasy: l("🌀 불안한 아침: 모든 이변체 안정도 45로 시작", "🌀 不穏な朝：全異変体の安定度45でスタート", "🌀 Uneasy morning: all anomalies start at 45 containment"),
  quiet: l("🤫 조용한 날: 사건이 일어나지 않아요", "🤫 静かな日：事件が起きない", "🤫 Quiet day: no events"),
};
export function dailyInfo(day) {
  let h = 2166136261; for (const ch of String(day)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const R = { rs: h || 1 }; const pool = Object.keys(AN).filter((id) => AN[id].grade <= 3).sort();
  const anoms = []; while (anoms.length < 3) { const id = pool[Math.floor(rnd(R) * pool.length)]; if (!anoms.includes(id)) anoms.push(id); }
  const mods = Object.keys(DAILY_MODS); return { day, seed: h, anoms, mod: mods[Math.floor(rnd(R) * mods.length)] };
}
function applyDaily(S, day) {
  const I = dailyInfo(day); S.mode = "daily"; S.daily = day; S.dmod = I.mod; S.seed = I.seed; S.rs = I.seed || 1;
  for (const a of S.anoms) S.rooms[a.home].anom = null; S.anoms = [];
  const cells = S.rooms.filter((r) => r.type === "contain" && openFloor(S, r.f)); I.anoms.forEach((id, i) => addAnom(S, id, cells[i].id));
  if (I.mod === "short") S.staff = S.staff.filter((s) => s.job !== "tech" && s.id !== 2);
  if (I.mod === "rich") S.res.money += 1500;
  if (I.mod === "uneasy") for (const a of S.anoms) a.stab = 45;
  if (I.mod === "quiet") S.noEvents = 1;
}
export function dailyScore(S) {
  const r = S.report || S.today || {}, judgedN = S.anoms.reduce((n, a) => n + Object.keys(a.judged || {}).length, 0), stages = S.anoms.reduce((n, a) => n + a.stage, 0);
  const met = S.res.energy >= S.res.quota;
  return Math.max(0, Math.round(S.res.energy * 10 + (r.recons || 0) * 80 + judgedN * 60 + stages * 40 + (met ? 500 : 0) - (r.lost || 0) * 400 - (r.breaches || 0) * 60 - (r.downs || 0) * 50));
}
// 서버 확인용: 기록을 처음부터 다시 돌림
export function replayDaily(day, log, maxTicks = 4000) {
  const S = newGame({ seed: 1, daily: day }); let i = 0, guard = 0;
  if (!Array.isArray(log) || log.length > 6000) return { ok: false, err: "log" };
  while (S.phase !== "end" && guard++ < maxTicks + 7000) {
    let applied = false;
    while (i < log.length && log[i] && log[i].t === S.tick) { cmd0(S, log[i].c || {}); i++; applied = true; }
    if (i < log.length && log[i] && log[i].t < S.tick) return { ok: false, err: "order" };
    if (S.phase === "work" && !S.ev.cur) { step(S); if (S.tick > maxTicks) break; }
    else if (!applied) return { ok: false, err: S.phase === "prep" ? "nostart" : "stuck" };
  }
  if (S.phase !== "end") return { ok: false, err: "unfinished" };
  return { ok: true, S, score: dailyScore(S) };
}
export function confirmedTrue(S) { let n = 0; for (const a of S.anoms) for (const h of AN[a.id].hyp) if (h.t && a.judged?.[h.id]) n++; return n; }
export function judgedAll(S) { let n = 0; for (const a of S.anoms) n += Object.keys(a.judged || {}).length; return n; }
function decideEnding(S) {
  if (Object.keys(S.secrets || {}).length >= 5) return "zero";
  const full = S.anoms.filter((a) => a.stage >= 5).length, truth = confirmedTrue(S);
  if (truth >= 8 && judgedAll(S) >= 10 && full >= 1) return "truth";
  if (S.metDays >= 8 && S.lostTotal === 0) return "perfect";
  if (S.metDays < 4) return "closed";
  return "endless";
}

// ---------- 한 틱 ----------
export function step(S) {
  if (S.phase !== "work" || S.ev.cur) return;
  S.tick++; S.min += MIN_PER_TICK;
  power(S);
  for (const a of S.anoms) anomTick(S, a);
  resonance(S);
  S.rides = 0;
  for (const s of S.staff) staffTick(S, s);
  social(S);
  maybeEvent(S);
  if (S.min >= DAY_MIN) endDay(S);
}
function power(S) {
  if (S.fault2 && !S.gen.broken && S.nextFault < 0 && S.min >= S.fault2) { S.nextFault = S.min; S.fault2 = 0; }
  if (!S.gen.broken && S.nextFault > 0 && S.min >= S.nextFault) { S.gen.broken = true; S.nextFault = -1; S.res.power = Math.max(0, S.res.power - 30); say(S, "fault"); fx(S, "fault"); }
  let target = S.gen.broken ? (facN(S, "backup") ? 55 : 12) : 100; if (S.emerg > S.min) target = Math.min(100, target + 45);
  let drain = 0; for (const a of S.anoms) if (a.st === "out") { const B = AN[a.id].breach; if (B.drain) drain += ruleOn(a, "lamp_power") ? B.drain * 0.55 : B.drain; }
  if (S.emerg > S.min) drain *= 0.4;
  const p = S.res.power; S.res.power = clamp(p + clamp(target - p, -3, 3) * DT - drain * DT, facN(S, "battery") ? 20 : 0, 100);
  const dark = S.res.power < 25; if (dark && !S.dark) { say(S, "dark", { v: Math.round(S.res.power) }); fx(S, "dark"); } S.dark = dark;
}

// ---------- 이변체 ----------
function anomTick(S, a) {
  const A = AN[a.id], B = A.breach, d = diffOf(S);
  if (a.st === "in") {
    const worked = S.staff.some((s) => s.task?.k === "research" && s.task.aid === a.id && s.prog > 0);
    a.idle = worked ? 0 : a.idle + MIN_PER_TICK;
    let ds = -[0, 0.1, 0.17, 0.25, 0.32][A.grade] * d.stab * (1 + Math.max(0, S.day - 3) * 0.04);
    if (a.idle > 120) ds -= 0.15 * d.stab;
    if (rnd(S) < 0.00005 * A.grade * d.stab) { a.stab -= 20; fx(S, "surge", { aid: a.id }); }
    let mood = 0;
    for (const R of A.rules) {
      if (R.on !== "tick" || !allc(S, a, R.if, {})) continue;
      const half = R.h && ruleOn(a, R.h);
      if (R.do.stab) ds += R.do.stab * (R.do.stab < 0 ? d.stab * (half ? 0.5 : 1) : 1);
      if (R.do.stabPerAlarm) ds += R.do.stabPerAlarm * alarmCount(S) * d.stab * (half ? 0.5 : 1);
      if (R.do.stabFlat) a.stab += R.do.stabFlat * S.rides * (half ? 0.5 : 1);
      if (R.do.calmFloor) { for (const s of S.staff) if (s.cond === "ok" && s.f === a.f && s.stress >= 35) { s.stress = Math.max(0, s.stress - R.do.calmFloor * DT); evidence(S, a, R.h, 1, { s: nameRef(s) }, true); } }
      else evidence(S, a, R.h, 1, evArgs(S, a, { n: R.do.stabPerAlarm ? alarmCount(S) : Math.round(a.idle) }), true);
      if (R.do.mood) mood = R.do.mood;
    }
    for (const Q of A.decoys || []) if (Q.on === "tick" && allc(S, a, Q.if, {})) evidence(S, a, Q.h, -1, evArgs(S, a, {}), true);
    if (A.signal) a.mood = SIGNAL.indexOf(signalOf(S)); else if (mood) a.mood = mood; else if (a.mood === 2 && a.flower !== "black") a.mood = 0;
    a.stab = clamp(a.stab + ds * DT, 0, 100);
    const warnAt = S.staff.some((s) => s.cond === "ok" && !s.task && roomOf(S, s)?.type === "control") ? 35 : 22;
    if (a.stab < warnAt && !a.warned) { a.warned = true; say(S, "warn", { a: aRef(a), v: Math.round(a.stab) }); fx(S, "warn", { aid: a.id }); }
    if (a.stab > warnAt + 10) a.warned = false;
    if (a.stab <= 0) breach(S, a);
    return;
  }
  const room = S.rooms[a.room];
  if (a.st === "weak") { a.weakT -= DT; if (a.weakT <= 0) { a.st = "out"; a.hp = Math.round(B.hp * 0.5); say(S, "revive", { a: aRef(a) }); fx(S, "revive", { aid: a.id }); } return; }
  if (B.type === "hop") {
    a.moveT -= DT; if (B.dark) room.flick = 1;
    if (a.moveT <= 0) {
      const cands = S.rooms.filter((r) => r.type !== "elevator" && r.type !== "lot" && openFloor(S, r.f) && r.id !== a.room && Math.abs(r.f - a.f) <= 1 && (r.f !== a.f || Math.abs(ctr(r) - a.x) < 480));
      const nr = pick(S, cands); room.flick = 0; room.alarm = 0; a.room = nr.id; a.f = nr.f; a.x = ctr(nr); nr.alarm = 1; a.moveT = B.every[0] + rnd(S) * (B.every[1] - B.every[0]); fx(S, "hop", { aid: a.id });
    }
    for (const s of S.staff) if (s.cond === "ok" && !s.ride && roomOf(S, s)?.id === a.room) addStress(S, s, B.stress * DT, B.dark ? "dark" : "fear");
  } else if (B.type === "zone") {
    a.moveT -= DT;
    if (a.moveT <= 0) {
      a.moveT = B.every; const zr = S.rooms.filter((r) => r.zone);
      if (zr.length < B.max) { const opts = []; for (const r of zr) for (const [nid] of neighbors(S, r, true)) { const q = S.rooms[nid]; if (!q.zone && q.type !== "elevator" && q.f === r.f) opts.push(q); } if (opts.length) { const q = pick(S, opts); q.zone = B.zone; say(S, "zone", { z: { $n: ZONE_NAME[B.zone] }, r: { $n: D.ROOM_TYPES[q.type].name } }); fx(S, "zone", { rid: q.id }); } }
    }
  } else if (B.type === "roam" || B.type === "mimic") {
    if (!a.path || a.moveT <= 0) {
      a.moveT = 4; let best = null, bc = 1e9;
      if (B.seek === "alarm") { for (const r of S.rooms) if (r.alarm > 0 && !S.muted && r.id !== a.room) { const c = pathCost(S, a.f, a.x, r.f, ctr(r)); if (c < bc) { bc = c; best = { f: r.f, x: ctr(r) }; } } }
      else if (B.seek === "staff" || (B.seek === "dark" && S.res.power < 50)) { for (const s of S.staff) if (s.cond === "ok" && !s.ride) { const c = pathCost(S, a.f, a.x, s.f, s.x); if (c < bc && c > 10) { bc = c; best = { f: s.f, x: s.x }; } } }
      if (!best && (rnd(S) < 0.4 || B.type === "mimic")) { const opts = S.rooms.filter((r) => r.type !== "elevator" && r.type !== "lot" && openFloor(S, r.f) && Math.abs(r.f - a.f) <= 1); const r = pick(S, opts); best = { f: r.f, x: ctr(r) + (rnd(S) - 0.5) * 40 }; }
      a.path = best ? findPath(S, a.f, a.x, best.f, best.x) : null;
    }
    a.moveT -= DT;
    if (a.path && a.path.length) { const w = a.path[0]; if (w.f !== a.f) { a.f = w.f; a.x = w.x; a.path.shift(); } else { const sp = B.speed * DT; if (Math.abs(w.x - a.x) <= sp) { a.x = w.x; a.path.shift(); } else { a.dir = Math.sign(w.x - a.x); a.x += a.dir * sp; } } }
    const nr = roomAt(S, a.f, a.x); if (nr && nr.id !== a.room) { if (B.type !== "mimic") room.alarm = 0; a.room = nr.id; if (B.type !== "mimic") nr.alarm = 1; }
    const big = !!B.attack.big && alarmCount(S) >= 2; a.big = big;
    const near = S.staff.filter((s) => s.cond !== "lost" && !s.ride && s.f === a.f && Math.abs(s.x - a.x) < 70).sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x)).slice(0, 3);
    const k = B.attack.kind, v = (big ? B.attack.big : B.attack.v) * DT;
    if (k === "money" && (near.length || rnd(S) < 0.5)) S.res.money = Math.max(-999, Math.round((S.res.money - v) * 10) / 10);
    for (const s of near) {
      if (k === "dmg") hurt(S, s, (v / Math.max(1, near.length)) * (s.cond === "down" ? 0.3 : 1));
      if (k === "sleep" && s.cond === "ok" && !gfx(s).sleepRes) s.fat = Math.min(100, s.fat + v);
      if (k === "root" && s.cond === "ok") { s.rootT = 1.5; hurt(S, s, v * 0.4); }
      if (s.cond === "ok") addStress(S, s, (big ? B.stress * 1.6 : B.stress) * DT, B.noise ? "noise" : "fear");
    }
    for (const s of S.staff) if (s.cond === "ok" && s.f === a.f && !near.includes(s)) addStress(S, s, 0.25 * B.stress * DT, B.noise ? "noise" : "fear");
  } else if (B.type === "static") {
    a.autoT -= DT;
    if (B.stressAll) for (const s of S.staff) if (s.cond === "ok") addStress(S, s, B.stressAll * DT, "fear");
    if (B.lockDoors) { a.moveT -= DT; if (a.moveT <= 0) { a.moveT = 20; const ds = S.doors.filter((q) => S.rooms[q.a].type !== "elevator" && S.rooms[q.b].type !== "elevator"); for (const q of ds) if (q.sig) { q.lock = false; q.sig = 0; } for (let i = 0; i < 2; i++) { const q = pick(S, ds); if (!q.lock) { q.lock = true; q.sig = 1; } } say(S, "doorsShift"); fx(S, "doors"); for (const s of S.staff) if (s.path) replan(S, s); } }
    if (a.autoT <= 0) { recontain(S, a, null); say(S, "selfback", { a: aRef(a) }); fx(S, "recon", { aid: a.id }); return; }
  }
  if (a.st === "out" && B.hp > 0 && a.hp <= 0) weaken(S, a);
}
function breach(S, a) {
  const B = AN[a.id].breach; a.st = "out"; a.breaches++; a.hp = B.hp || 0; a.moveT = B.type === "zone" ? 6 : 3; a.path = null; S.today.breaches++; a.autoT = B.auto || 0; a.big = false;
  const r = S.rooms[a.home]; r.alarm = 1; if (B.type === "zone") r.zone = B.zone;
  if (B.blockLift) { S.liftBlocked = true; say(S, "liftBlock"); for (const s of S.staff) if (s.path) replan(S, s); }
  if (B.type === "mimic") { const src = staffById(S, a.last?.sid) || S.staff.find((s) => s.cond === "ok"); a.copy = src ? src.id : null; r.alarm = 0; }
  say(S, "breach", { a: aRef(a) }); fx(S, "breach", { aid: a.id });
  for (const s of S.staff) if (s.task?.k === "research" && s.task.aid === a.id) { addStress(S, s, 14, "fear"); setTask(S, s, null); }
  for (const s of S.staff) if (s.cond === "ok") addStress(S, s, 5, "fear");
}
function weaken(S, a) { a.st = "weak"; a.weakT = 30; a.hp = 0; say(S, "weak", { a: aRef(a) }); fx(S, "weak", { aid: a.id }); }
function recontain(S, a, s) {
  const B = AN[a.id].breach, r = S.rooms[a.room]; if (r) { r.alarm = 0; r.flick = 0; }
  const h = S.rooms[a.home]; h.alarm = 0; if (B.type === "zone") for (const q of S.rooms) if (q.zone === B.zone) q.zone = null;
  a.st = "in";
  if (B.blockLift) S.liftBlocked = S.anoms.some((q) => q.st !== "in" && AN[q.id].breach.blockLift);
  if (B.lockDoors) for (const d of S.doors) if (d.sig) { d.lock = false; d.sig = 0; }
  a.room = a.home; a.f = h.f; a.x = ctr(h); a.stab = 40; a.hp = B.hp || 0; a.path = null; a.warned = false; a.idle = 0; a.copy = null;
  if (s) { S.today.recons++; say(S, "recon", { a: aRef(a), s: nameRef(s) }); fx(S, "recon", { aid: a.id }); }
  if (S.anoms.every((q) => q.st === "in")) S.muted = false;
}
export function reconBlock(S, a, s) {
  if (a.st === "weak") return null; const B = AN[a.id].breach;
  if (B.type === "roam" || B.type === "mimic") return l("먼저 제압해서 약하게 만들기", "まず鎮圧して弱らせる", "Suppress it first");
  for (const c of B.recon.if || []) if (!cond(S, a, c, { s })) return condText(c);
  return null;
}
export function condText(c) {
  const [k, v, w] = c;
  switch (k) {
    case "power>=": return l(`전력 ${v}% 이상 필요`, `電力${v}%以上が必要`, `Needs power ≥ ${v}%`);
    case "noZones": return l("다른 방부터 정리해야 해요", "他の部屋を先に片付ける", "Clear the other rooms first");
    case "stress<": return l(`스트레스 ${v} 미만인 직원만`, `ストレス${v}未満の職員のみ`, `Needs a worker with stress < ${v}`);
    case "stat>=": { const n = D.STAT_NAME[v]; return [`${n[0]} ${w} 이상인 직원만`, `${n[1]}${w}以上の職員のみ`, `Needs ${n[2]} ${w}+`]; }
    case "signal": return l("초록불일 때만", "青信号の時だけ", "Only on green");
  }
  return l("조건이 안 맞아요", "条件を満たしていません", "Conditions not met");
}

// ---------- 공명 ----------
function resonance(S) {
  for (const R of K.RESO) {
    const a = anomById(S, R.a), b = anomById(S, R.b); if (!a || !b || a.st !== "in" || b.st !== "in") continue;
    if (!allc(S, a, R.if, {})) continue;
    if (R.fx.stab) for (const id in R.fx.stab) { const q = anomById(S, id); if (q) q.stab = clamp(q.stab + R.fx.stab[id] * DT, 0, 100); }
    if (R.fx.stressAll) for (const s of S.staff) if (s.cond === "ok") s.stress = clamp(s.stress + R.fx.stressAll * DT, 0, 100);
    if (R.fx.stab || R.fx.stressAll) discover(S, R);
  }
}
function discover(S, R) { if (S.reso[R.id]) return; S.reso[R.id] = 1; S.today.resos.push(R.id); say(S, "reso", { n: { $n: R.name } }); fx(S, "reso", { rid: R.id }); }
function resoWork(S, a, s, m) {
  const out = { energy: 1, data: 1 };
  for (const R of K.RESO) {
    const w = R.work?.[a.id]; if (!w) continue; const p = anomById(S, R.a), q = anomById(S, R.b); if (!p || !q || p.st !== "in" || q.st !== "in") continue;
    if (w.m && w.m !== m) continue; if (w.lv && s.lv < w.lv) continue;
    if (w.energy) out.energy *= w.energy; if (w.data) out.data *= w.data; discover(S, R);
  }
  return out;
}

// ---------- 직원 ----------
export function addStress(S, s, v, why) {
  if (s.cond !== "ok" || v <= 0) { if (v < 0) s.stress = clamp(s.stress + v, 0, 100); return; }
  const G = gfx(s); let m = diffOf(S).stress * G.stressRes; if (has(s, "calm")) m *= 0.7;
  if (why === "dark") { if (G.dark) m *= 0.3; else if (has(s, "darkfear")) m *= 2; }
  if (why === "noise") { if (G.noise) m *= 0.2; else if (has(s, "noise")) m *= 1.8; }
  if (S.staff.some((o) => o !== s && o.cond === "ok" && o.f === s.f && Math.abs(o.x - s.x) < 80 && (s.rel[o.id] || 0) >= 20)) m *= 0.8;
  s.stress = clamp(s.stress + v * m, 0, 100);
}
function hurt(S, s, v) {
  if (s.cond === "lost") return; s.hp -= v * gfx(s).armor; s.hitT = S.tick;
  if (s.cond === "ok" && s.hp <= 0) {
    s.cond = "down"; s.task = null; s.path = null; s.ride = null; s.panic = false; s.hist.downs++; S.today.downs++; say(S, "down", { s: nameRef(s) }); fx(S, "down", { sid: s.id });
    for (const o of S.staff) if (o !== s && o.cond === "ok") addStress(S, o, (o.rel[s.id] || 0) >= 20 ? 16 : 6, "fear");
  } else if (s.cond === "down" && s.hp <= -80) {
    s.cond = "lost"; S.today.lost++; S.lostTotal++; say(S, "lost", { s: nameRef(s) }); fx(S, "lost", { sid: s.id });
    for (const k in s.gear) if (s.gear[k]) { S.inv[s.gear[k]] = (S.inv[s.gear[k]] || 0) + 1; s.gear[k] = null; }
    for (const o of S.staff) if (o !== s && o.cond === "ok") addStress(S, o, (o.rel[s.id] || 0) >= 20 ? 30 : 12, "fear");
  }
}
function roomMods(S, room) {
  let move = 1, work = 1;
  if (room?.zone) { const B = S.anoms.map((a) => AN[a.id].breach).find((b) => b.zone === room.zone); if (B) { move *= B.move || 1; work *= B.work ?? 1; } }
  for (const a of S.anoms) if (a.st === "out") { const B = AN[a.id].breach;
    if (B.type === "hop" && a.room === room?.id) { move *= B.move || 1; work *= B.work ?? 1; }
    if (B.type === "static") { move *= B.floorMove || 1; work *= B.floorWork || 1; } }
  return { move, work };
}
function staffTick(S, s) {
  if (s.cond !== "ok") { s.anim = s.cond === "down" ? "down" : "gone"; return; }
  const room = roomOf(S, s), G = gfx(s);
  if (S.dark) addStress(S, s, 0.35 * DT, "dark");
  if (!S.muted && has(s, "noise")) { let n = 0; for (const r of S.rooms) if (r.alarm > 0) n += r.f === s.f ? 1 : 0.25; if (n) addStress(S, s, 0.3 * n * DT, "noise"); }
  if (room?.zone) addStress(S, s, (S.anoms.map((a) => AN[a.id].breach).find((b) => b.zone === room.zone)?.stress || 0.5) * DT, "fear");
  if (has(s, "optimist")) s.stress = Math.max(0, s.stress - 0.15 * DT);
  if (has(s, "loner") && room && inRoom(S, room) >= 3) addStress(S, s, 0.2 * DT, "fear");
  if (G.calm) for (const o of S.staff) if (o !== s && o.cond === "ok" && o.f === s.f && Math.abs(o.x - s.x) < 90) o.stress = Math.max(0, o.stress - G.calm * DT);
  const restR = s.task?.k === "rest" || s.task?.k === "flee" || !s.task;
  if ((room?.type === "lounge" || room?.type === "counsel") && restR && !s.path) { const k = room.type === "counsel" ? 4.8 : 2.4; s.stress = Math.max(0, s.stress - k * DT); s.fat = Math.max(0, s.fat - 2.5 * DT); }
  if (room?.type === "medbay" && !s.path && s.hp < s.maxHp) { const medic = S.staff.some((o) => o.job === "medic" && o.cond === "ok" && roomOf(S, o)?.id === room.id); s.hp = Math.min(s.maxHp, s.hp + (medic ? 4 : 2) * DT); }
  if (room?.zone === "paper" && s.task && s.task.k !== "clear" && S.anoms.some((a) => a.st !== "in" && AN[a.id].breach.confuse) && rnd(S) < 0.004) setTask(S, s, null);
  const lim = has(s, "brave") ? 95 : 85;
  if (!s.panic && s.stress >= lim) { s.panic = true; say(S, "panic", { s: nameRef(s) }); fx(S, "panic", { sid: s.id }); const r = safeRoom(S, s); setTask(S, s, { k: "flee", f: r.f, x: ctr(r) + ((s.id % 5) - 2) * 18 }); }
  if (s.panic) s.panicT = (s.panicT || 0) + DT; else s.panicT = 0;
  if (s.panic && s.panicT > 45) s.stress = Math.min(s.stress, 49);
  if (s.panic && s.stress < 50) { s.panic = false; say(S, "calm", { s: nameRef(s) }); if (s.task?.k === "flee") setTask(S, s, null); }
  if (s.panic && !s.task) { const r = safeRoom(S, s); setTask(S, s, { k: "flee", f: r.f, x: ctr(r) }); }
  if (!s.task && !s.panic) autoDuty(S, s);
  if (s.task && ["treat", "fight", "recon"].includes(s.task.k) && S.tick % 10 === s.id % 10) {
    if (!validTask(S, s, s.task)) setTask(S, s, null);
    else { const g = taskTarget(S, s, s.task); if (g && (g.f !== s.goal?.f || Math.abs(g.x - s.goal.x) > 24)) replan(S, s); }
  }
  if (s.rootT > 0) { s.rootT -= DT; s.anim = "hurt"; return; }
  if (s.ride) { s.ride.t += DT; s.anim = "ride"; if (s.ride.t >= 1.6) { s.f = s.ride.to; s.ride = null; fx(S, "ding", { f: s.f, x: s.x }); } return; }
  if (s.path && s.path.length) {
    const w = s.path[0];
    if (w.f !== s.f) { if (S.liftBlocked) { replan(S, s); return; } s.ride = { from: s.f, to: w.f, t: 0 }; s.x = w.x; s.path.shift(); S.rides++; return; }
    const urgent = s.panic || (s.task && ["treat", "fight", "recon", "flee"].includes(s.task.k)) || S.anoms.some((a) => a.st !== "in");
    let sp = (urgent ? 78 : 44) * DT * G.move * roomMods(S, room).move; if (s.fat > 80) sp *= 0.8; if (has(s, "athletic")) sp *= 1.25; if (s.job === "security" && facN(S, "security")) sp *= 1.3;
    const dx = w.x - s.x;
    if (Math.abs(dx) <= sp) { s.x = w.x; s.path.shift(); } else { s.x += Math.sign(dx) * sp; s.dir = Math.sign(dx); }
    s.anim = urgent ? (s.panic ? "panicrun" : "run") : "walk"; s.fat = Math.min(100, s.fat + 0.03 * DT * G.fat);
    if (!s.path.length) s.path = null;
    return;
  }
  if (!s.task) { s.anim = room?.type === "lounge" || room?.type === "counsel" ? "sit" : "idle"; return; }
  work(S, s);
}
function safeRoom(S, s) {
  const bad = new Set(S.anoms.filter((a) => a.st !== "in").map((a) => a.room));
  for (const t of ["counsel", "lounge", "medbay", "control"]) { const r = S.rooms.find((q) => q.type === t && openFloor(S, q.f) && !bad.has(q.id) && !q.zone); if (r && findPath(S, s.f, s.x, r.f, ctr(r))) return r; }
  return roomOf(S, s);
}
export const seesMimic = (S) => S.staff.some((s) => s.cond === "ok" && gfx(s).see);
function autoDuty(S, s) {
  if (!s.auto) { goPost(S, s); return; }
  const out = S.anoms.filter((a) => a.st !== "in");
  if (s.job === "medic" || (s.job !== "researcher" && !out.length)) {
    const hurtS = S.staff.filter((o) => o !== s && (o.cond === "down" || (o.cond === "ok" && o.hp < o.maxHp * 0.5 && !o.task))).sort((p, q) => (p.cond === "down" ? 0 : 1) - (q.cond === "down" ? 0 : 1));
    if (hurtS.length && (s.job === "medic" || hurtS[0].cond === "down") && !S.staff.some((o) => o.task?.k === "treat" && o.task.tid === hurtS[0].id)) { setTask(S, s, { k: "treat", tid: hurtS[0].id }); if (s.task) return; }
  }
  if (s.job === "tech") {
    if (S.gen.broken) { setTask(S, s, { k: "repair" }); if (s.task) return; }
    const vr = S.rooms.find((r) => r.zone && !S.staff.some((o) => o.task?.k === "clear" && o.task.rid === r.id)); if (vr) { setTask(S, s, { k: "clear", rid: vr.id }); if (s.task) return; }
  }
  if (s.job === "security") {
    const t = out.find((a) => a.st === "out" && validTask(S, s, { k: "fight", aid: a.id }) && !(AN[a.id].breach.type === "mimic" && !seesMimic(S))); if (t && s.hp > s.maxHp * 0.35) { setTask(S, s, { k: "fight", aid: t.id }); if (s.task) return; }
    const vr = S.rooms.find((r) => r.zone && !S.staff.some((o) => o.task?.k === "clear" && o.task.rid === r.id)); if (vr) { setTask(S, s, { k: "clear", rid: vr.id }); if (s.task) return; }
  }
  const here = roomOf(S, s); if (here && here.alarm > 0 && !S.muted && s.job !== "security") { const r = safeRoom(S, s); if (r.id !== here.id) { setTask(S, s, { k: "move", rid: r.id }); return; } }
  if (s.fat > 75 || s.stress > 55) { setTask(S, s, { k: "rest", auto: 1 }); return; }
  goPost(S, s);
}
function goPost(S, s) { const r = S.rooms[postOf(S, s.job)]; const here = roomOf(S, s); if (here?.id !== r.id) setTask(S, s, { k: "move", rid: r.id, auto: 1 }); else s.anim = "idle"; }

function work(S, s) {
  const t = s.task, J = s.job, G = gfx(s), room = roomOf(S, s);
  let speed = G.work * roomMods(S, room).work; if (has(s, "perfect")) speed *= 0.83; if (has(s, "rash")) speed *= 1.3; if (s.fat > 80) speed *= 0.7;
  if (has(s, "loner") && inRoom(S, room) === 1) speed *= 1.2;
  const tick = () => { if (speed <= 0) return; s.prog += speed / s.wt; s.fat = Math.min(100, s.fat + 0.22 * DT * G.fat); };
  switch (t.k) {
    case "move": case "flee": s.task = t.k === "flee" && s.panic ? t : null; s.anim = s.panic ? "panic" : "idle"; return;
    case "rest": s.anim = "sit"; if (s.stress < 8 && s.fat < 10) s.task = null; return;
    case "research": {
      const a = anomById(S, t.aid); if (!a || a.st !== "in") { setTask(S, s, null); return; }
      if (!s.wt) { s.wt = t.m === "analyze" ? 120 : 90; s.prog = 0; }
      s.anim = speed > 0 ? "work_" + t.m : "idle"; s.dir = Math.sign(a.x - s.x) || 1; tick();
      if (AN[a.id].grade >= 3 && !(a.quiet > S.min)) addStress(S, s, 0.5 * DT, a.id === "choir" ? "noise" : "fear");
      if (s.prog >= 1) { research(S, s, a, t.m); setTask(S, s, null); }
      return;
    }
    case "repair": if (!S.gen.broken) { setTask(S, s, null); return; } if (!s.wt) s.wt = 80 / (J === "tech" ? 1 : 0.5) / (has(s, "mech") ? 1.4 : 1) / G.repair; s.anim = "repair"; tick(); if (s.prog >= 1) { S.gen.broken = false; s.hist.repairs++; s.xp += 5 * G.xp; say(S, "fixed", { s: nameRef(s) }); fx(S, "fixed"); setTask(S, s, null); } return;
    case "treat": {
      const o = staffById(S, t.tid); if (!o || o.cond === "lost" || (o.cond === "ok" && o.hp >= o.maxHp)) { setTask(S, s, null); return; }
      if (o.f !== s.f || Math.abs(o.x - s.x) > 30) { replan(S, s); return; }
      if (!s.wt) s.wt = (J === "medic" ? 50 : 100) / (1 + stat(s, "emp") * 0.03); s.anim = "heal"; s.dir = Math.sign(o.x - s.x) || 1; tick();
      if (s.prog >= 1) { o.cond = "ok"; o.hp = Math.max(o.hp, Math.round(o.maxHp * (J === "medic" ? 0.7 : 0.4))); addStress(S, o, -10); s.hist.treats++; s.xp += 5 * G.xp; say(S, "treated", { s: nameRef(s), t: nameRef(o) }); fx(S, "heal", { sid: o.id }); setTask(S, s, null); }
      return;
    }
    case "fight": {
      const a = anomById(S, t.aid); if (!a || a.st !== "out") { setTask(S, s, null); return; }
      if (t.by !== "p" && s.hp < s.maxHp * 0.3) { const m = S.rooms.find((q) => q.type === "medbay"); setTask(S, s, { k: "move", rid: m.id, auto: 1 }); return; }
      if (a.f !== s.f || Math.abs(a.x - s.x) > 46) { replan(S, s); return; }
      const B = AN[a.id].breach; s.anim = "attack"; s.dir = Math.sign(a.x - s.x) || 1;
      let dmg = (2 + stat(s, "cmb") * 1.1) * (J === "security" ? 1.4 : 1) * G.fight * (facN(S, "security") && J === "security" ? 1.25 : 1) * (B.fight ?? 1) * DT;
      if (B.litFight && S.res.power < 40 && !G.dark) dmg *= 0.2;
      a.hp -= dmg; s.fat = Math.min(100, s.fat + 0.3 * DT); s.xp += 0.15 * DT * G.xp; s.hist.fights += DT;
      if (S.tick % 4 === 0) fx(S, "hit", { aid: a.id, sid: s.id });
      if (B.dark) addStress(S, s, 0.8 * DT, "dark");
      if (a.hp <= 0) { weaken(S, a); setTask(S, s, null); }
      return;
    }
    case "recon": {
      const a = anomById(S, t.aid); if (!a || a.st === "in") { setTask(S, s, null); return; }
      const B = AN[a.id].breach, mob = B.type === "roam" || B.type === "mimic" || B.type === "hop";
      if (mob && (a.f !== s.f || Math.abs(a.x - s.x) > 46)) { replan(S, s); return; }
      const why = reconBlock(S, a, s); if (why) { say(S, "reconFail", { a: aRef(a), s: nameRef(s), w: { $n: why } }); fx(S, "blocked", { sid: s.id }); if (B.type === "zone") addStress(S, s, 6, "fear"); setTask(S, s, null); return; }
      if (!s.wt) s.wt = 60 / (has(s, "mech") ? 1.3 : 1); s.anim = "work_" + (B.recon.method || "env"); s.dir = Math.sign(a.x - s.x) || 1; tick();
      if (s.prog >= 1) { s.xp += 8 * G.xp; recontain(S, a, s); setTask(S, s, null); }
      return;
    }
    case "compare": {
      const a = anomById(S, t.aid); if (!a || !vagueCount(a)) { setTask(S, s, null); return; }
      if (!s.wt) s.wt = 70 / (1 + (stat(s, "foc") - 5) * 0.08) / (facN(S, "archive") ? 1.5 : 1); s.anim = "work_observe"; tick();
      if (s.prog >= 1) { const n = clarify(S, a); gainData(S, a, 3); s.xp += 4 * G.xp; say(S, "compared", { s: nameRef(s), a: aRef(a), n }); fx(S, "clue", { aid: a.id }); setTask(S, s, null); }
      return;
    }
    case "clear": {
      const r = S.rooms[t.rid]; if (!r || !r.zone) { setTask(S, s, null); return; }
      if (!s.wt) s.wt = 60 / (1 + (Math.max(stat(s, "tec"), stat(s, "cmb")) - 4) * 0.08) / (has(s, "mech") ? 1.2 : 1); s.anim = "repair"; tick();
      if (s.prog >= 1) { const z = r.zone; r.zone = null; s.xp += 4 * G.xp; say(S, "cleared", { s: nameRef(s), r: { $n: ZONE_THING[z] } }); fx(S, "cleared", { rid: r.id }); setTask(S, s, null); }
      return;
    }
  }
  setTask(S, s, null);
}

// ---------- 연구 결과 (숨은 규칙이 실제로 계산되는 곳) ----------
function research(S, s, a, m) {
  const A = AN[a.id], M = D.METHODS[m], d = diffOf(S), G = gfx(s);
  const prev = a.last;
  a.cnt[m] = (a.cnt[m] || 0) + 1; a.cnt.all = (a.cnt.all || 0) + 1;
  const resp = A.resp[m];
  const skill = stat(s, M.stat) + (s.lv - 1) * 0.5 + (m === "talk" && has(s, "social") ? 2 : 0) + (m === "env" && has(s, "mech") ? 1 : 0) + (G.method[m] || 0);
  const roll = rnd(S) * 0.6 + (skill / 10) * 0.45 + resp * 0.25 + (has(s, "careful") || has(s, "perfect") ? 0.08 : 0) - (has(s, "rash") ? 0.08 : 0) - (S.dark && !G.dark ? 0.08 : 0);
  let r = roll > 0.92 ? "great" : roll > 0.62 ? "good" : roll > 0.38 ? "normal" : "bad";
  const ctx = { s, m, r: null };
  for (const R of A.rules) if (R.on === "work" && R.do.noBad && allc(S, a, R.if, ctx) && r === "bad") r = "normal";
  ctx.r = r;
  const mul = { great: 1.6, good: 1.15, normal: 0.75, bad: 0.25 }[r];
  let energy = A.energy * mul * (a.stage >= 5 ? 1.25 : 1) * G.energy, data = { great: 6, good: 4.5, normal: 3.5, bad: 2 }[r] + (m === "analyze" ? 3 : 0);
  let dstab = { great: 10, good: 6, normal: 1, bad: -15 }[r] * (r === "bad" ? d.stab : 1) + resp * 2;
  let stress = [0, 3, 6, 11, 15][A.grade] - stat(s, "cou") * 0.5 + (r === "bad" ? 9 : 0) + (m === "analyze" ? 4 : 0);
  if (has(s, "curious")) { data *= 1.2; if (A.grade >= 2) stress *= 1.15; }
  if (has(s, "sharp")) data *= 1.1;
  data *= G.data * (1 + 0.15 * facN(S, "lab"));
  const ctrl = S.rooms.find((q) => q.type === "control"); if (S.staff.some((o) => o.cond === "ok" && !o.path && roomOf(S, o)?.id === ctrl.id)) data *= 1.15;
  let money = 0, hurtV = 0, flowered = false;
  for (const R of A.rules) {
    if (R.on !== "work" || !allc(S, a, R.if, ctx)) continue;
    const half = R.h && ruleOn(a, R.h), X = R.do;
    if (X.energy != null) energy *= X.energy; if (X.data != null) data *= X.data;
    if (X.stab) dstab += X.stab < 0 ? X.stab * (half ? 0.5 : 1) * d.stab : X.stab;
    if (X.stress) stress += X.stress > 0 ? X.stress * (half ? 0.5 : 1) : X.stress;
    if (X.fat) s.fat = clamp(s.fat + X.fat * (X.fat > 0 && half ? 0.5 : 1), 0, 100);
    if (X.stressFloor) for (const o of S.staff) if (o !== s && o.cond === "ok" && o.f === s.f && Math.abs(o.x - s.x) < 120) addStress(S, o, X.stressFloor * (half ? 0.5 : 1), "fear");
    if (X.stressAll) for (const o of S.staff) if (o.cond === "ok") addStress(S, o, X.stressAll);
    if (X.money) money += X.money; if (X.hurt) hurtV += X.hurt * (half ? 0.5 : 1);
    if (X.mood) a.mood = X.mood; if (X.flower) { a.flower = X.flower; flowered = true; }
    if (X.quiet) a.quiet = S.min + X.quiet;
    const args = evArgs(S, a, { s, vk: R.if.some((c) => c[0] === "lv>=") ? "lv" : R.if.some((c) => c[0] === "fat>=") ? "fat" : null, c: X.flower ? { $n: FLOWER[X.flower] } : undefined });
    const cc = R.if.find((c) => c[0] === "count>"); if (cc) args.n = cc[2] ? a.cnt[cc[2]] : a.cnt.all;
    if (R.if.some((c) => c[0] === "roomStaff>=")) args.n = inRoom(S, roomOf(S, s));
    if (X.reveal === "fault" && S.nextFault > S.min) { args.t = clockText(S.nextFault); S.faultSeen = true; say(S, "reveal", { a: aRef(a), t: clockText(S.nextFault) }); fx(S, "reveal"); }
    if (R.h) evidence(S, a, R.h, 1, args, false, vagueRoll(S, s));
  }
  for (const Q of A.decoys || []) if (Q.on === "work" && allc(S, a, Q.if, { ...ctx, prevM: prev?.m })) evidence(S, a, Q.h, -1, evArgs(S, a, { s }), false, vagueRoll(S, s));
  if (a.id === "garden" && !flowered) { a.flower = null; a.mood = 0; }
  const rw = resoWork(S, a, s, m); energy *= rw.energy; data *= rw.data;
  if (S.focus && S.focus.aid === a.id && S.focus.until > S.min) energy *= 1.3;
  if (S.boost && S.boost.until > S.min) energy *= S.boost.mul;
  if (r === "bad" && A.grade >= 2) hurtV += A.grade >= 3 ? 12 + rnd(S) * 10 : 4 + rnd(S) * 6;
  if (A.explore) { say(S, "explore", { s: nameRef(s) }); fx(S, "explore", { sid: s.id }); }
  energy = Math.round(energy * 10) / 10; data = Math.round(data);
  if (hurtV) hurt(S, s, hurtV);
  a.stab = clamp(a.stab + dstab, 0, 100); addStress(S, s, stress, a.id === "choir" || a.id === "music" ? "noise" : "fear");
  if (money) S.res.money += money;
  S.res.energy = Math.round((S.res.energy + energy) * 10) / 10; S.today.energy += energy; S.today.works++; s.hist.energy += energy; if (r === "great") { S.today.great++; s.hist.great++; } if (r === "bad") S.today.bad++;
  a.last = { sid: s.id, m }; a.works++; a.workers[s.id] = 1; s.hist.works++; s.hist.mstat[M.stat] = (s.hist.mstat[M.stat] || 0) + 1; s.xp += (6 + (r === "great" ? 4 : 0)) * G.xp * (has(s, "sharp") ? 1.2 : 1);
  gainData(S, a, data);
  say(S, "res", { s: nameRef(s), a: aRef(a), m: { $n: M.name }, r: { $n: RES_NAME[r] }, e: energy, x: data });
  fx(S, "res", { aid: a.id, sid: s.id, r, e: energy });
  if (a.stab <= 0 && a.st === "in") breach(S, a);
}
export function gainData(S, a, n) {
  a.data += n; const st = stageOf(a.data);
  while (a.stage < st) {
    a.stage++; S.today.stages.push([a.id, a.stage]); say(S, "stage", { a: aRef(a), n: a.stage, t: { $n: D.STAGE_NAME[a.stage] } }); fx(S, "stage", { aid: a.id, n: a.stage });
    if (a.stage >= 3 && AN[a.id].gear && !S.unlock[AN[a.id].gear]) S.unlock[AN[a.id].gear] = 1;
    if (a.stage >= 5) for (const h of AN[a.id].hyp) if (a.hyp[h.id] === "open" || a.hyp[h.id] === "wrong") a.hyp[h.id] = h.t ? "ok" : "no";
  }
}

// ---------- 관계 ----------
function social(S) {
  if (S.tick % 10) return;
  const ok = okStaff(S);
  for (let i = 0; i < ok.length; i++) for (let j = i + 1; j < ok.length; j++) {
    const a = ok[i], b = ok[j]; if (a.f !== b.f || Math.abs(a.x - b.x) > 90) continue;
    const g = 0.12 * (has(a, "social") || has(b, "social") ? 2 : 1); const before = a.rel[b.id] || 0;
    a.rel[b.id] = Math.min(100, before + g); b.rel[a.id] = Math.min(100, (b.rel[a.id] || 0) + g);
    if (before < 20 && a.rel[b.id] >= 20) { say(S, "bond", { s: nameRef(a), t: nameRef(b) }); fx(S, "bond", { a: a.id, b: b.id }); }
  }
}

// ---------- 사건 ----------
function maybeEvent(S) {
  if (S.min < S.ev.next || S.ev.cur || S.min > DAY_MIN - 40 || S.noEvents) return;
  S.ev.next = S.min + Math.round((110 + Math.floor(rnd(S) * 90)) / (1 + 0.15 * ((S.players || 1) - 1)));
  if (S.anoms.some((a) => a.st !== "in")) { S.ev.next = S.min + 30; return; }
  const ok = okStaff(S).filter((s) => !s.panic), inA = S.anoms.filter((a) => a.st === "in");
  const elig = K.EVENTS.filter((E) => {
    if (E.day && (S.day < E.day[0] || S.day > E.day[1])) return false; if (E.once && S.ev.done[E.id]) return false; if ((S.ev.done[E.id] || 0) >= 2) return false;
    const who = E.who || ""; if (who.includes("a") && !ok.length) return false; if (who.includes("b") && ok.length < 2) return false; if (who.includes("x") && !inA.length) return false;
    if (E.need && !ok.some((s) => s.job === E.need)) return false;
    return true;
  });
  if (!elig.length) return;
  for (let tries = 0; tries < 6; tries++) {
    const E = wpick(S, elig, (e) => e.w || 1);
    const roles = {}; const who = E.who || "";
    if (who.includes("a")) roles.a = (E.need ? pick(S, ok.filter((s) => s.job === E.need)) : pick(S, ok)).id;
    if (who.includes("b")) { const rest = ok.filter((s) => s.id !== roles.a); roles.b = pick(S, rest).id; }
    if (who.includes("x")) roles.x = pick(S, inA).id;
    if (!(E.cond || []).every((c) => evCond(S, c, roles))) continue;
    S.ev.cur = { id: E.id, roles, at: S.tick }; S.ev.done[E.id] = (S.ev.done[E.id] || 0) + 1; S.today.events.push(E.id);
    say(S, "ev", { t: { $n: E.title } }); fx(S, "event", { id: E.id }); return;
  }
}
// 이름 있는 사건을 바로 띄움 (시험·방송용)
export function forceEvent(S, id) {
  const E = K.EVENTS.find((q) => q.id === id); if (!E || S.phase !== "work") return false; const ok = okStaff(S), inA = S.anoms.filter((a) => a.st === "in"); const roles = {};
  if ((E.who || "").includes("a")) { const c = E.need ? ok.filter((s) => s.job === E.need) : ok; if (!c.length) return false; roles.a = c[0].id; }
  if ((E.who || "").includes("b")) { const c = ok.filter((s) => s.id !== roles.a); if (!c.length) return false; roles.b = c[0].id; }
  if ((E.who || "").includes("x")) { if (!inA.length) return false; roles.x = inA[0].id; }
  S.ev.cur = { id, roles, at: S.tick }; S.ev.done[id] = (S.ev.done[id] || 0) + 1; say(S, "ev", { t: { $n: E.title } }); fx(S, "event", { id }); return true;
}
function evCond(S, c, roles) {
  const a = staffById(S, roles.a);
  switch (c[0]) {
    case "lvA>=": return a && a.lv >= c[1]; case "stressA>=": return a && a.stress >= c[1];
    case "breachToday": return S.today.breaches > 0; case "anyBreachEver": return S.anoms.some((q) => q.breaches > 0);
  }
  return true;
}
function applyEvent(S, e, ch) {
  const R = e.roles, a = staffById(S, R.a), b = staffById(S, R.b), x = anomById(S, R.x); let F = ch.fx || {}; let extra = null;
  if (F.check) { const ok = a && stat(a, F.check[0]) + rnd(S) * 4 >= F.check[1] + 1; F = ok ? F.ok : F.bad; extra = ok ? "checkOk" : "checkBad"; }
  if (F.coin) { if (rnd(S) < 0.5) { F = { stressAll: -8 }; extra = "coinWin"; } else { F = { money: -30 }; extra = "coinLose"; } }
  const all = okStaff(S);
  if (F.money) S.res.money += F.money; if (F.energy) S.res.energy = Math.max(0, Math.round((S.res.energy + F.energy) * 10) / 10);
  if (F.stressAll) for (const s of all) addStress(S, s, F.stressAll);
  if (F.stressA && a) addStress(S, a, F.stressA); if (F.stressB && b) addStress(S, b, F.stressB);
  if (F.xpA && a) a.xp += F.xpA; if (F.xpB && b) b.xp += F.xpB; if (F.xpAll) for (const s of all) s.xp += F.xpAll;
  if (F.fat && a) a.fat = clamp(a.fat + F.fat, 0, 100);
  if (F.relAB && a && b) { a.rel[b.id] = clamp((a.rel[b.id] || 0) + F.relAB, 0, 100); b.rel[a.id] = clamp((b.rel[a.id] || 0) + F.relAB, 0, 100); }
  if (F.relAll) for (const s of all) for (const o of all) if (s !== o) s.rel[o.id] = clamp((s.rel[o.id] || 0) + F.relAll, 0, 100);
  if (F.data && x) gainData(S, x, F.data); if (F.stab && x) x.stab = clamp(x.stab + F.stab, 0, 100);
  if (F.dataAny && S.anoms.length) gainData(S, pick(S, S.anoms), F.dataAny);
  if (F.dataAll) for (const q of S.anoms) gainData(S, q, F.dataAll);
  if (F.power) S.res.power = clamp(S.res.power + F.power, 0, 100);
  if (F.quota) S.res.quota += F.quota;
  if (F.flag) S.ev.flags[F.flag] = 1;
  if (F.faultDelay) S.nextFault = -1; if (F.faultSoon && !S.gen.broken) S.nextFault = Math.min(S.nextFault > S.min ? S.nextFault : 1e9, DAY_MIN - 20, S.min + 40);
  if (F.trait && a && !a.traits.includes(F.trait)) a.traits.push(F.trait);
  if (F.gear) { const opts = K.GEAR_IDS.filter((g) => !K.GEAR[g].from); const g = pick(S, opts); S.inv[g] = (S.inv[g] || 0) + 1; say(S, "gearGet", { g: { $n: K.GEAR[g].name } }); }
  if (x && x.stab <= 0 && x.st === "in") breach(S, x);
  say(S, "evr", { t: { $n: ch.r, a: a ? nameRef(a) : "", b: b ? nameRef(b) : "", x: x ? aRef(x) : "" } });
  if (extra) say(S, extra);
  secretCheck(S);
  fx(S, "evdone");
}

// ---------- 글 만들기 ----------
export function fmt(tpl, args, li) {
  const s = Array.isArray(tpl) ? tpl[li] : tpl;
  return String(s ?? "").replace(/\{(\w+)\}/g, (_, k) => { const v = args?.[k]; if (v == null || v === "") return ""; if (typeof v === "object" && v.$n) { const inner = Array.isArray(v.$n) ? v.$n[li] : v.$n; return inner.includes("{") ? fmt(inner, v, li) : inner; } return v; });
}
const JOSA = { "이(가)": ["이", "가"], "을(를)": ["을", "를"], "은(는)": ["은", "는"], "와(과)": ["과", "와"], "과(와)": ["과", "와"], "으로(로)": ["으로", "로"] };
export function josa(str) {
  return str.replace(/(.)(이\(가\)|을\(를\)|은\(는\)|와\(과\)|과\(와\)|으로\(로\))/g, (m, ch, j) => { const c = ch.charCodeAt(0); let bat = false; if (c >= 0xac00 && c <= 0xd7a3) { const jong = (c - 0xac00) % 28; bat = jong !== 0 && !(j === "으로(로)" && jong === 8); } else if (/[0-9]/.test(ch)) bat = "013678".includes(ch); return ch + (bat ? JOSA[j][0] : JOSA[j][1]); });
}
export function logText(e, li) { const t = fmt(LOG[e.k], e.a, li); return li === 0 ? josa(t) : t; }
export const VAGUE = l("{s}의 기록: 무언가 달라졌다… 원인과 결과가 흐릿하게 적혀 있다 (관찰력 부족)", "{s}の記録：何かが変わった…原因と結果がぼやけている（観察力不足）", "{s}'s note: something changed… cause and effect are blurry (low Observation)");
export function obsText(aid, o, li) { if (o.v) { const x = fmt(VAGUE, o.a, li); return li === 0 ? josa(x) : x; } const h = AN[aid]?.hyp.find((q) => q.id === o.h); const t = h && (o.s > 0 ? h.pos : h.neg); if (!t) return ""; const x = fmt(t, o.a, li); return li === 0 ? josa(x) : x; }
export function evText(S, tpl, li) { const e = S.ev.cur; const R = e ? e.roles : {}; const a = staffById(S, R.a), b = staffById(S, R.b), x = anomById(S, R.x); const t = fmt(tpl, { a: a ? nameRef(a) : "", b: b ? nameRef(b) : "", x: x ? (x.stage >= 1 ? aRef(x) : AN[x.id].no) : "" }, li); return li === 0 ? josa(t) : t; }
export function clockText(min) { const m = Math.floor(min) + 8 * 60; return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }

// ---------- 방송(시청자 투표·후원) 효과: 서버가 정한 값으로 엔진이 계산 ----------
export const VOTE_OPTS = {
  supply: [l("🩹 의료 물자 (모든 직원 체력 +25)", "🩹 医療物資（全職員の体力+25）", "🩹 Medical supplies (all staff +25 HP)"), l("💰 운영 자금 +150", "💰 運営資金+150", "💰 +150 funds"), l("☕ 커피 배달 (스트레스 −15)", "☕ コーヒー配達（ストレス−15）", "☕ Coffee run (stress −15)")],
  env: [l("🍀 행운의 날 (모든 이변체 안정도 +15)", "🍀 幸運の日（全異変体の安定度+15）", "🍀 Lucky day (all anomalies +15 containment)"), l("🌀 요동 (무작위 이변체 안정도 −25)", "🌀 動揺（ランダム異変体の安定度−25）", "🌀 Tremor (a random anomaly −25 containment)"), l("🔌 정전 훈련 (전력 −35, 모든 이변체 데이터 +8)", "🔌 停電訓練（電力−35、全異変体データ+8）", "🔌 Blackout drill (power −35, +8 data on all)")],
};
export function streamApply(S, kind, d = {}) {
  if (S.phase !== "work" && !["viewer", "cand"].includes(kind)) return { ok: false, err: "phase" };
  const ok = okStaff(S), inA = S.anoms.filter((a) => a.st === "in"); let t = null;
  switch (kind) {
    case "supply": {
      const o = d.opt | 0; if (o === 0) for (const s of ok) s.hp = Math.min(s.maxHp, s.hp + 25); else if (o === 1) S.res.money += 150; else for (const s of ok) s.stress = Math.max(0, s.stress - 15);
      t = VOTE_OPTS.supply[o] || VOTE_OPTS.supply[0]; break;
    }
    case "env": {
      const o = d.opt | 0;
      if (o === 0) for (const a of inA) a.stab = clamp(a.stab + 15, 0, 100);
      else if (o === 1) { const a = inA.length ? pick(S, inA) : null; if (a) { a.stab -= 25; fx(S, "surge", { aid: a.id }); if (a.stab <= 0) breach(S, a); } }
      else { S.res.power = clamp(S.res.power - 35, 0, 100); for (const a of S.anoms) gainData(S, a, 8); }
      t = VOTE_OPTS.env[o] || VOTE_OPTS.env[0]; break;
    }
    case "focus": { const a = anomById(S, d.aid); if (!a) return { ok: false, err: "anom" }; S.focus = { aid: a.id, until: S.min + 90 }; t = { $n: l("🎯 집중 연구: {a} (90분간 에너지 ×1.3)", "🎯 集中研究：{a}（90分間エネルギー×1.3）", "🎯 Focus: {a} (×1.3 energy for 90 min)"), a: aRef(a) }; break; }
    case "viewer": {
      if (staffCount(S) >= staffCap(S) + 4) return { ok: false, err: "cap" };
      const name = String(d.name || "").replace(/[<>\r\n\t]/g, "").trim().slice(0, 12); if (!name) return { ok: false, err: "name" };
      const h = genHire(S, name); h.viewer = d.from || "viewer"; const s = addStaff(S, h);
      if (S.phase === "work") { const r = S.rooms[postOf(S, s.job)]; s.f = r.f; s.x = ctr(r); }
      say(S, "viewer", { s: nameRef(s) }); fx(S, "viewer", { sid: s.id, name }); return { ok: true, sid: s.id };
    }
    case "research": { const a = S.anoms.length ? pick(S, S.anoms) : null; if (!a) return { ok: false }; gainData(S, a, 20); a.stab = clamp(a.stab + 5, 0, 100); fx(S, "clue", { aid: a.id }); t = { $n: l("🔬 특별 연구 지원: {a} 데이터 +20", "🔬 特別研究支援：{a} データ+20", "🔬 Research grant: {a} +20 data"), a: aRef(a) }; break; }
    case "cand": S.extraCand = 1; t = l("📦 내일 새 이변체 후보가 하나 더 와요", "📦 明日、新しい異変体候補が一つ増えます", "📦 One more anomaly candidate tomorrow"); break;
    case "big": { for (const a of inA) a.stab = clamp(a.stab - 15, 0, 100); S.boost = { until: S.min + 60, mul: 1.5 }; t = l("🌋 대규모 특별 사건: 모든 이변체 불안정, 60분간 에너지 ×1.5", "🌋 大規模特別事件：全異変体が不安定、60分間エネルギー×1.5", "🌋 Major incident: all anomalies agitated, ×1.5 energy for 60 min"); fx(S, "surge", {}); break; }
    default: return { ok: false, err: "kind" };
  }
  if (d.donor) say(S, "don", { n: d.donor, t: { $n: t.$n || t, a: t.a } }); else say(S, "vote", { t: { $n: t.$n || t, a: t.a } });
  fx(S, "stream", { kind });
  return { ok: true };
}
