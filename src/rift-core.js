// =========================
// 운명의 균열 — 게임 규칙 엔진 (화면·서버 공용, 두 곳 파일이 똑같아야 함)
// - 상태(run)는 순수 JSON. act(run, 플레이어번호, 행동) 하나로만 바뀜 → 혼자 하기는 브라우저가, 협동은 서버가 같은 규칙으로 판정
// - 난수는 run.rs 하나(시드 기반) → 같은 시드 + 같은 행동 = 같은 결과 (서버가 혼자 하기 기록도 다시 돌려 검증)
// - 카드·유물·적 효과는 데이터(ops). 효과 실행 상한(OP_LIMIT)·반복 상한·되감기 깊이 제한으로 무한 루프 차단
// - 데이터는 setData(DATA)로 넣음 (rift-data.js)
// =========================
export const CORE_VERSION = 1;
let D = null, CARD = {}, RELIC = {};
export function setData(d) { D = d; CARD = Object.fromEntries(d.CARDS.map((c) => [c.id, c])); RELIC = Object.fromEntries(d.RELICS.map((r) => [r.id, r])); }
export const data = () => D;
export const cardDef = (id) => CARD[id];
export const relicDef = (id) => RELIC[id];

const CARD_GEN = ["RECALL", "COPY", "ADD_CARD", "REWIND"], PLAY_LIMIT = 60;   // 되감기·역행이 다시 쓰지 않는 효과 · 한 턴 최대 카드 수 (무한 콤보 방지)
const OP_LIMIT = 600, REPEAT_MAX = 20, HAND_MAX = 10, SAND_MAX = 10, RIFT_MAX = 15, SUMMON_MAX = 6, LUCK_MAX = 10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// ---------- 난수 (mulberry32, 상태는 run.rs) ----------
export const own = (o, k) => typeof k === "string" && !!o && Object.prototype.hasOwnProperty.call(o, k);   // 객체 기본 속성 이름(constructor 등)을 데이터로 착각하지 않게
export function hashSeed(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rnd(run) { let a = (run.rs = (run.rs + 0x6d2b79f5) | 0); let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const ri = (run, n) => Math.floor(rnd(run) * n);
const pick = (run, a) => a[ri(run, a.length)];
function shuffle(run, a) { for (let i = a.length - 1; i > 0; i--) { const j = ri(run, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function wpick(run, pairs) { const tot = pairs.reduce((s, p) => s + p[1], 0); let x = rnd(run) * tot; for (const [v, w] of pairs) { if ((x -= w) < 0) return v; } return pairs[pairs.length - 1][0]; }

// =========================================================
// 1) 새 판
// =========================================================
// opts: { seed, chars:[charId…](1~4), names, diff:'normal'|'hard'|'night', mode:'solo'|'coop' }
export function newRun({ seed, chars, names = [], diff = "normal", mode = "solo", daily = null }) {
  if (daily) { const di = dailyInfo(daily); seed = di.seed; chars = [di.char]; diff = "normal"; mode = "solo"; }   // 일일 도전: 날짜가 시드·캐릭터·규칙을 정함 (기록 검증도 날짜만으로 같은 판)
  if (mode === "battle") diff = "normal";
  if (!own(D.DIFF, diff)) diff = "normal";   // 이상한 이름(__proto__ 등) 막기
  if (!Array.isArray(chars) || !chars.length || chars.length > 4) throw new Error("BAD_CHAR");
  const n = chars.length, df = D.DIFF[diff];
  const run = { v: CORE_VERSION, dv: D.VERSION, seed: seed >>> 0, rs: hashSeed(`rift:${seed >>> 0}`), diff, mode, region: "forest", nuid: 1,
    hpMult: df.hp * n, dmgMult: df.dmg * (1 + 0.3 * (n - 1)),   // 협동: 인원수만큼 적 체력 ×n · 공격 +30%/명
    floor: -1, at: null, phase: "map", map: null, players: [], cb: null, room: null, over: null, seenEv: [], turnTotal: 0, log: [], ri: 0, base: 0 };
  run.region = D.ORDER?.[0] || "forest";
  chars.forEach((c, i) => {
    if (!own(D.CHARS, c)) throw new Error("BAD_CHAR"); const ch = D.CHARS[c];
    const p = { i, char: c, name: String(names[i] || "").slice(0, 12), hp: ch.hp, maxHp: ch.hp, gold: 99, deck: [], relics: [], alive: true,
      st: { dmg: 0, taken: 0, heal: 0, maxHit: 0, kills: 0, bossKills: 0, uses: {}, reso: {}, resoN: 0, coopReso: 0, played: 0, evo: 0, eng: 0, floors: 0, elites: 0 } };
    for (const id of ch.start) p.deck.push(newInst(run, id));
    run.players.push(p);
    gainRelic(run, p, ch.relic);
    if (df.curse) p.deck.push(newInst(run, "cu_wound"));
  });
  run.map = genMap(run);
  if (daily) { run.daily = daily; run.mods = dailyInfo(daily).mods; for (const m of run.mods) applyMod(run, m); }
  if (mode === "battle") { run.bt = { round: 0, quota: 0, done: 0, res: null, ghost: null, pre: null, hist: [] }; run.phase = "bwait"; run.room = { type: "bwait" }; }
  return run;
}
// ---------- 일일 도전: 날짜(한국 시간 YYYY-MM-DD) → 시드·캐릭터·특별 규칙 2개 ----------
export function dailyInfo(day) {
  const s = hashSeed(`rift-daily:${day}`), chars = Object.keys(D.CHARS), mods = Object.keys(D.DAILY_MODS || {});
  const t = { rs: hashSeed(`rift-daily-pick:${day}`) }, m1 = mods[ri(t, mods.length)]; let m2 = mods[ri(t, mods.length)]; for (let k = 0; k < 10 && m2 === m1; k++) m2 = mods[ri(t, mods.length)];
  return { day, seed: s >>> 0, char: chars[ri(t, chars.length)], mods: mods.length ? [m1, m2] : [] };
}
function applyMod(run, id) {
  const p = run.players[0];
  switch (id) {
    case "rich": p.gold += 200; break;
    case "glass": p.maxHp = Math.round(p.maxHp * 0.75); p.hp = p.maxHp; { const pool = poolFor(p.char).filter((d) => d.r === "rare"); p.deck.push(newInst(run, pick(run, pool).id)); } break;
    case "tough": run.hpMult *= 1.2; break;
    case "relics": for (let k = 0; k < 2; k++) { const r = randRelic(run, p, "common"); if (r) gainRelic(run, p, r); } break;
    case "upgraded": for (const x of p.deck) if (canUpgrade(x)) upgradeInst(run, p, x, CARD[x.id].evo ? pick(run, Object.keys(CARD[x.id].evo)) : null); break;
    case "cursed": p.deck.push(newInst(run, "cu_doubt")); { const r = randRelic(run, p, "rare"); if (r) gainRelic(run, p, r); } break;
    case "lean": for (let k = 0; k < 2; k++) { const j = p.deck.findIndex((x) => CARD[x.id].r === "basic"); if (j >= 0) p.deck.splice(j, 1); } break;
    case "fierce": run.dmgMult *= 1.2; { const pool = poolFor(p.char).filter((d) => d.r === "uncommon"); for (let k = 0; k < 2; k++) p.deck.push(newInst(run, pick(run, pool).id)); } break;
    case "engraved": engraveRand(run, p, 3); break;
  }
}
// 일일 도전 점수 (높을수록 좋음)
export function dailyScore(run) { const p = run.players[0]; return (run.over?.win ? 5000 : 0) + (run.floor + 1) * 100 + (run.ri || 0) * 500 + p.st.bossKills * 300 + p.st.elites * 60 + Math.max(0, p.hp) * 2 - Math.min(run.turnTotal, 2000); }

// ---------- 덱 배틀: 라운드 · 그림자 결투 ----------
export const DUEL_TURNS = 10;
export function battleRound(run, quota = 2) {
  if (run.mode !== "battle" || run.over || run.phase !== "bwait") return false;
  const p = run.players[0]; run.bt.round++; run.bt.quota = quota; run.bt.done = 0; run.bt.res = null; run.bt.ghost = null;
  if (run.bt.round > 1) p.hp = Math.min(p.maxHp, p.hp + Math.ceil((p.maxHp - p.hp) / 4));   // 라운드 사이 잃은 체력 1/4 회복
  run.phase = "map"; run.room = null; run.cb = null; return true;
}
function roomDone(run) { if (run.mode !== "battle" || !run.bt) return; run.bt.done++; if (run.bt.done >= run.bt.quota) { run.phase = "bwait"; run.room = { type: "bwait" }; run.cb = null; } }
// 상대 덱 요약(그림자): 서버가 상대 판에서 만들어 넘김
export function ghostOf(run, name) { const p = run.players[0]; return { name: String(name || "").slice(0, 12), char: p.char, hp: Math.round(p.maxHp * 1.6), deck: p.deck.filter((x) => CARD[x.id].t !== "cur").map((x) => ({ id: x.id, up: x.up, evo: x.evo })), str: Math.min(4, Math.floor(p.relics.length / 3)) }; }
export function startDuel(run, ghost) {
  const ev = []; if (run.mode !== "battle" || run.over || run.phase !== "bwait" || !ghost?.deck) return { ok: false, ev };
  const p = run.players[0]; run.bt.pre = p.hp; p.hp = p.maxHp; run.bt.ghost = ghost; run.bt.res = null;   // 결투는 체력 가득 차서 (끝나면 원래대로)
  startCombat(run, ["ghost"], "duel", ev); return { ok: true, ev };
}
// 그림자 행동: 상대 덱에서 카드 3장 → 공격·방어·약화만 옮겨 씀 (힘은 덜 세게)
const G_DEBUFF = ["weak", "vuln", "frail", "poison", "burn"], G_BUFF = ["str", "thorns", "regen"];
function ghostOps(ops, out, depth = 0) {
  for (const o of ops || []) {
    if (out.length >= 12) return;
    if (o.op === "DAMAGE" && typeof o.n === "number" && o.n > 0) out.push({ op: "DAMAGE", n: Math.max(1, Math.round(o.n * 0.75)) });
    else if (o.op === "BLOCK" && typeof o.n === "number" && o.n > 0 && (!o.tgt || ["self", "team", "ally"].includes(o.tgt))) out.push({ op: "BLOCK", n: Math.round(o.n * 0.8), tgt: "self" });
    else if (o.op === "APPLY" && typeof o.n === "number" && o.n > 0) { if (["self", "team", "ally"].includes(o.tgt)) { if (G_BUFF.includes(o.s)) out.push({ op: "APPLY", s: o.s, n: Math.min(2, o.n), tgt: "self" }); } else if (G_DEBUFF.includes(o.s)) out.push({ op: "APPLY", s: o.s, n: Math.min(3, o.n) }); }
    else if (o.op === "REPEAT" && typeof o.times === "number" && depth < 1) for (let k = 0; k < Math.min(3, o.times); k++) ghostOps(o.ops, out, depth + 1);
    else if (o.op === "IF" && depth < 1) ghostOps(o.then, out, depth + 1);
  }
}
function ghostMove(run, e) {
  const deck = e.gdeck || [], cards = [];
  for (let k = 0; k < 3 && deck.length; k++) cards.push(deck[ri(run, deck.length)]);
  const ops = []; for (const x of cards) ghostOps(cardOps(x), ops);
  if (!ops.some((o) => o.op === "DAMAGE")) ops.push({ op: "DAMAGE", n: 5 + run.bt.round });
  const D_ = ops.some((o) => o.op === "DAMAGE"), B_ = ops.some((o) => o.op === "BLOCK"), Db = ops.some((o) => o.op === "APPLY" && !o.tgt);
  return { i: D_ && B_ ? "atkdef" : D_ && Db ? "atkdeb" : D_ ? "atk" : B_ ? "def" : "debuff", ops, cards: cards.map((x) => x.id) };
}
function newInst(run, id, o = {}) { return { u: run.nuid++, id, up: 0, evo: null, eng: null, ...o }; }

// ---------- 지도: 15층 × 7칸, 경로 6개, 마지막에 보스 ----------
const COLS = 7;
function genMap(run) {
  const ROWS = D.REGIONS[run.region]?.rows || 15, TREASURE = Math.floor(ROWS / 2);
  const nodes = {}, key = (r, c) => `${r}-${c}`;
  const add = (r, c) => (nodes[key(r, c)] ||= { id: key(r, c), r, c, type: null, next: [] });
  const starts = []; for (let k = 0; k < 6; k++) { let c = ri(run, COLS); if (k === 1) while (c === starts[0]) c = ri(run, COLS); starts.push(c); }
  for (const s of starts) { let c = s; add(0, c); for (let r = 1; r < ROWS; r++) { const nc = clamp(c + ri(run, 3) - 1, 0, COLS - 1); const a = add(r - 1, c), b = add(r, nc); if (!a.next.includes(b.id)) a.next.push(b.id); c = nc; } }
  const boss = { id: "boss", r: ROWS, c: 3, type: "B", next: [] }; nodes.boss = boss;
  for (const nd of Object.values(nodes)) if (nd.r === ROWS - 1) nd.next = ["boss"];
  const parents = {}; for (const nd of Object.values(nodes)) for (const x of nd.next) (parents[x] ||= []).push(nd.id);
  const byRow = Object.values(nodes).filter((x) => x.id !== "boss").sort((a, b) => a.r - b.r || a.c - b.c);
  for (const nd of byRow) {
    if (nd.r === 0) { nd.type = "F"; continue; } if (nd.r === TREASURE) { nd.type = "T"; continue; } if (nd.r === ROWS - 1) { nd.type = "R"; continue; }
    const pt = (parents[nd.id] || []).map((id) => nodes[id].type);
    const pool = nd.r < Math.min(4, ROWS / 3) ? [["F", 58], ["?", 32], ["$", 10]] : [["F", 44], ["?", 22], ["E", 13], ["R", 12], ["$", 9]];
    let t = "F"; for (let k = 0; k < 8; k++) { t = wpick(run, pool); if (!(["E", "R", "$"].includes(t) && pt.includes(t)) && !(t === "R" && nd.r === ROWS - 2)) break; t = "F"; }
    nd.type = t;
  }
  const bossIds = D.REGIONS[run.region]?.bosses || [], bossId = bossIds[hashSeed(`boss:${run.seed}:${run.region}`) % Math.max(1, bossIds.length)];   // 지역 보스는 지도를 만들 때 정함 (지도 그림 = 실제 보스)
  return { rows: ROWS, cols: COLS, nodes, boss: bossId };
}
export const nextNodes = (run) => (run.at ? run.map.nodes[run.at].next : Object.values(run.map.nodes).filter((n) => n.r === 0).map((n) => n.id));

// =========================================================
// 2) 카드 정보
// =========================================================
export function cardName(inst, L = 0) { const d = CARD[inst.id]; if (!d) return inst.id; if (inst.evo && d.evo?.[inst.evo]) return d.evo[inst.evo].n[L]; return d.n[L] + (inst.up ? "+" : ""); }
export function cardOps(inst) {
  const d = CARD[inst.id]; if (inst.evo && d.evo?.[inst.evo]) return d.evo[inst.evo].ops;
  if (inst.up) return d.up?.ops || (d.up ? d.ops : autoUp(d.ops));
  return d.ops;
}
function autoUp(ops) { return ops.map((o) => { const x = { ...o }; if (x.ops) x.ops = autoUp(x.ops); if (x.then) x.then = autoUp(x.then); if (x.else) x.else = autoUp(x.else);
  if (x.op === "DAMAGE" && x.n > 0) x.n += x.n >= 6 ? 3 : 2; if (x.op === "BLOCK" && x.n > 0) x.n += 3; if (x.op === "HEAL") x.n += 3; if (x.op === "APPLY" && !["stun", "double"].includes(x.s)) x.n += 1; return x; }); }
export function baseCost(inst) { const d = CARD[inst.id]; if (inst.evo && d.evo?.[inst.evo]?.cost != null) return d.evo[inst.evo].cost; if (inst.up && d.up?.cost != null) return d.up.cost; return d.cost; }
export function costOf(cp, inst) { const b = baseCost(inst); if (b < 0) return -1; if (inst.free) return 0; return Math.max(0, b + (cp?.cmod?.[inst.u] || 0)); }
export const canUpgrade = (inst) => { const d = CARD[inst.id]; return d && d.t !== "cur" && !inst.up && !inst.evo; };
export const engOk = (inst, eng) => { const d = CARD[inst.id], e = D.ENGRAVE[eng]; return !!(d && e && d.t !== "cur" && !inst.eng && e.types.includes(d.t)); };
const cardTags = (inst) => (inst.eng === "attune" ? ["*"] : CARD[inst.id]?.tags || []);

// =========================================================
// 3) 효과 엔진
// =========================================================
const regHp = (run) => (run.cb?.kind === "duel" ? 1 : D.REGIONS[run.region]?.hpMul || 1), regDmg = (run) => (run.cb?.kind === "duel" ? 1 : D.REGIONS[run.region]?.dmgMul || 1);   // 지역별 적 체력·공격 배율
const ent = (cb, ref) => (ref.k === "e" ? cb.en[ref.i] : cb.ps[ref.i]);
const aliveE = (cb) => cb.en.filter((e) => !e.dead);
const aliveP = (run) => run.cb.ps.filter((cp) => run.players[cp.i].alive);
function plusOf(run, ctx, s) {
  if (ctx.src.k !== "p") return 0; const p = run.players[ctx.src.i], cp = run.cb.ps[ctx.src.i]; let x = 0;
  for (const r of p.relics) x += RELIC[r.id]?.plus?.[s] || 0;
  if (s === "rift") x += cp.pw.riftPlus || 0;
  if (s === "poison") x += cp.pw.poisonPlus || 0;
  return x;
}
function scaleN(n, mult) { return n > 0 ? Math.max(1, Math.round(n * mult)) : n; }
function perVal(run, ctx, per, tgtEnt) {
  if (!per) return 0; const cp = ctx.src.k === "p" ? run.cb.ps[ctx.src.i] : null, m = per.m || 1;
  switch (per.k) {
    case "block": return (cp?.block || 0) * m;
    case "tgtStatus": return (tgtEnt?.st?.[per.s] || 0) * m;
    case "res": return (cp?.res?.[per.res] || 0) * m;
    case "spent": return (ctx.spent || 0) * m;
    case "played": return (cp?.played || 0) * m;
    case "summons": return (cp?.sm?.length || 0) * m;
    case "summonPow": return (cp?.sm || []).reduce((a, x) => a + x.v, 0) * m;
    case "consumed": return (ctx.consumed || 0) * m;
    case "consumedPow": return (ctx.consumedPow || 0) * m;
    case "roll": return (ctx.roll || 0) * m;
    case "allPoison": return run.cb.en.reduce((a, e) => a + (e.dead ? 0 : e.st.poison || 0), 0) * m;
  }
  return 0;
}
function pushEv(ctx, e) { if (ctx.ev.length < 400) ctx.ev.push(e); }
// 피해 처리 (공격 피해: 힘·약화·취약·빙결·균열 적용)
function hit(run, ctx, srcRef, tgtRef, base, o = {}) {
  const cb = run.cb, src = srcRef ? ent(cb, srcRef) : null, tgt = ent(cb, tgtRef); if (!tgt || tgt.dead || (tgtRef.k === "p" && !run.players[tgtRef.i].alive)) return 0;
  let n = base; if (src && !o.nostr) n += src.st.str || 0;
  n *= ctx.mult;
  if (src && !o.pure) { if (src.st.weak) n *= 0.75; if (srcRef.k === "e" && src.st.freeze) n *= 1 - Math.min(0.5, 0.1 * src.st.freeze); }
  if (!o.pure) { if (tgtRef.k === "e" && tgt.st.rift) n += tgt.st.rift; if (tgt.st.vuln) n *= 1.5; }
  if (srcRef?.k === "e") n *= run.dmgMult * regDmg(run);
  n = Math.max(0, Math.floor(n));
  if (tgtRef.k === "e" && D.ENEMIES[tgt.id].cap) n = Math.min(n, D.ENEMIES[tgt.id].cap);
  const blocked = Math.min(tgt.block, n); tgt.block -= blocked; const un = n - blocked;
  pushEv(ctx, { k: "hit", t: tgtRef, s: srcRef, n, un, b: blocked });
  if (un > 0) loseHp(run, ctx, tgtRef, un, srcRef);
  if (srcRef?.k === "p") { const st = run.players[srcRef.i].st; st.dmg += un; st.maxHit = Math.max(st.maxHit, n); if (un > 0) { const k = ctx.cid || "_etc"; (st.cdmg ||= {})[k] = (st.cdmg[k] || 0) + un; } }   // 카드별 준 피해 (결과 화면)
  if (src && o.attack !== false && tgt.st.thorns && srcRef) { pushEv(ctx, { k: "thorns", t: srcRef, n: tgt.st.thorns }); const b2 = Math.min(src.block, tgt.st.thorns); src.block -= b2; if (tgt.st.thorns - b2 > 0) loseHp(run, ctx, srcRef, tgt.st.thorns - b2, tgtRef); }
  const leech = o.leech || (ctx.leech && srcRef?.k === "p" ? ctx.leech : 0);
  if (leech && un > 0 && srcRef) healEnt(run, ctx, srcRef, Math.floor((un * leech) / 100));
  return un;
}
function loseHp(run, ctx, ref, n, by) {
  const cb = run.cb;
  if (ref.k === "e") { const e = cb.en[ref.i]; e.hp -= n; if (e.hp <= 0 && !e.dead) killEnemy(run, ctx, ref.i, by); return; }
  const p = run.players[ref.i]; if (!p.alive) return; p.hp -= n; p.st.taken += n;
  if (p.hp <= 0) {
    const ph = p.relics.find((r) => RELIC[r.id]?.revive && !r.used);
    if (ph) { ph.used = 1; p.hp = Math.max(1, Math.floor((p.maxHp * RELIC[ph.id].revive) / 100)); pushEv(ctx, { k: "revive", t: ref }); return; }
    p.hp = 0; p.alive = false; pushEv(ctx, { k: "die", t: ref });
  }
}
function healEnt(run, ctx, ref, n) {
  if (n <= 0) return; if (ref.k === "e") { const e = run.cb.en[ref.i]; if (e.dead) return; e.hp = Math.min(e.maxHp, e.hp + n); pushEv(ctx, { k: "heal", t: ref, n }); return; }
  const p = run.players[ref.i]; if (!p.alive) return; const h = Math.min(p.maxHp - p.hp, n); p.hp += h; p.st.heal += h; pushEv(ctx, { k: "heal", t: ref, n: h });
}
function killEnemy(run, ctx, i, by) {
  const e = run.cb.en[i]; e.dead = true; e.hp = 0; pushEv(ctx, { k: "kill", t: { k: "e", i } });
  if (by?.k === "p") { const st = run.players[by.i].st; st.kills++; if (D.ENEMIES[e.id].boss) st.bossKills++; }
  for (const cp of aliveP(run)) { relicHook(run, cp.i, "enemyDie", ctx); if (cp.pw.killSpirit) summon(run, ctx, cp, "spirit", cp.pw.killSpirit); }
  // 보스가 죽으면 부하도 쓰러짐
  if (D.ENEMIES[e.id].boss) for (const x of run.cb.en) if (!x.dead && x.minion) { x.dead = true; x.hp = 0; pushEv(ctx, { k: "kill", t: { k: "e", i: run.cb.en.indexOf(x) } }); }
}
function gainBlock(run, ctx, ref, n, o = {}) {
  const t = ent(run.cb, ref); if (!t || t.dead || (ref.k === "p" && !run.players[ref.i].alive)) return;
  let v = n * ctx.mult; if (ref.k === "p" && !o.nodex) { v += ent(run.cb, ref).st.dex || 0; if (t.st.frail) v *= 0.75; }
  v = Math.max(0, Math.floor(v)); t.block += v; pushEv(ctx, { k: "block", t: ref, n: v });
}
function applySt(run, ctx, ref, s, n) {
  const t = ent(run.cb, ref); if (!t || t.dead || (ref.k === "p" && !run.players[ref.i].alive) || n === 0) return;
  if (ref.k === "e" && s === "stun" && D.ENEMIES[t.id].boss && t.flags.stunCd > 0) { pushEv(ctx, { k: "resist", t: ref }); return; }
  t.st[s] = (t.st[s] || 0) + n; if (s === "rift") t.st.rift = Math.min(RIFT_MAX, t.st.rift);
  if (t.st[s] <= 0) delete t.st[s];
  pushEv(ctx, { k: "status", t: ref, s, n });
  if (ref.k === "e" && s === "freeze" && t.st.freeze >= 5) { delete t.st.freeze; t.st.stun = (t.st.stun || 0) + 1; pushEv(ctx, { k: "status", t: ref, s: "stun", n: 1 }); }
  if (ref.k === "e" && s === "stun" && D.ENEMIES[t.id].boss) t.flags.stunCd = 3;
}
const DEBUFF = ["weak", "vuln", "frail", "poison", "burn", "freeze", "stun"];

// 대상 고르기
function enemyTargets(run, ctx, tgt) {
  const al = aliveE(run.cb).map((e) => run.cb.en.indexOf(e)); if (!al.length) return [];
  const main = ctx.tgtE != null && !run.cb.en[ctx.tgtE]?.dead ? ctx.tgtE : null;
  switch (tgt || "enemy") {
    case "all": return al;
    case "rand": { const x = pick(run, al); ctx.last = x; return [x]; }
    case "others": return al.filter((x) => x !== main);
    case "other": { const o = al.filter((x) => x !== main); if (!o.length) return []; const x = pick(run, o); ctx.last = x; return [x]; }
    case "last": return ctx.last != null && !run.cb.en[ctx.last].dead ? [ctx.last] : [];
    case "lowest": { const x = al.slice().sort((a, b) => run.cb.en[a].hp - run.cb.en[b].hp)[0]; return [x]; }
    default: { const x = main ?? pick(run, al); ctx.last = x; return [x]; }
  }
}
function playerTargets(run, ctx, tgt) {
  const al = aliveP(run).map((cp) => cp.i);
  if (tgt === "team") return al;
  if (tgt === "ally") return ctx.tgtP != null && run.players[ctx.tgtP]?.alive ? [ctx.tgtP] : ctx.src.k === "p" ? [ctx.src.i] : al.slice(0, 1);
  if (ctx.src.k === "p") return [ctx.src.i];
  // 적이 쓰는 효과: 예고한 대상(죽었으면 다른 사람)
  if (ctx.tgtP != null && run.players[ctx.tgtP]?.alive) return [ctx.tgtP];
  return al.length ? [pick(run, al)] : [];
}
function cond(run, ctx, c) {
  const cb = run.cb, te = ctx.tgtE != null ? cb.en[ctx.tgtE] : null, cp = ctx.src.k === "p" ? cb.ps[ctx.src.i] : null, p = ctx.src.k === "p" ? run.players[ctx.src.i] : null;
  switch (c.k) {
    case "intentAtk": return !!te && !te.dead && ["atk", "atkdeb", "atkdef"].includes(moveOf(te)?.i);
    case "tgtHas": return !!te && (te.st[c.s] || 0) > 0;
    case "tgtStatusGte": return !!te && (te.st[c.s] || 0) >= c.n;
    case "tgtHpBelow": return !!te && te.hp <= (te.maxHp * c.pct) / 100;
    case "hpBelow": return !!p && p.hp <= (p.maxHp * c.pct) / 100;
    case "playedGte": return !!cp && cp.played >= c.n;
    case "turnMod": return cb.turn % c.m === 0;
    case "coopReso": return !!ctx.coopReso;
    case "summonsGte": return (cp?.sm?.length || 0) >= c.n;
  }
  return false;
}
// 소환수·장치 (플레이어마다 최대 6): spirit·turret = 턴 끝에 무작위 적 공격 · shield = 턴 시작 방어도 · battery = 턴 시작 에너지
function summon(run, ctx, cp, k, v) {
  if (cp.sm.length >= SUMMON_MAX) { const w = cp.sm.filter((x) => x.k === k).sort((a, b) => a.v - b.v)[0] || cp.sm.slice().sort((a, b) => a.v - b.v)[0]; w.v += v; pushEv(ctx, { k: "summonbuff", p: cp.i }); return; }
  cp.sm.push({ k, v }); pushEv(ctx, { k: "summon", p: cp.i, kind: k, v });
}
function summonsAct(run, ctx, cp, when) {
  const cb = run.cb, me = { k: "p", i: cp.i };
  for (const x of cp.sm) {
    if (cb.done) return;
    if ((x.k === "spirit" || x.k === "turret") && (when === "end" || when === "all")) {
      const al = aliveE(cb).map((e) => cb.en.indexOf(e)); if (!al.length) return;
      const plus = x.k === "spirit" ? cp.pw.spiritPlus || 0 : cp.pw.turretPlus || 0, t = pick(run, al);
      pushEv(ctx, { k: "summonhit", p: cp.i, kind: x.k, t: { k: "e", i: t } });
      hit(run, { ...ctx, mult: 1 }, me, { k: "e", i: t }, x.v + plus, { nostr: 1, attack: false });
    }
    if (x.k === "shield" && (when === "start" || when === "all")) gainBlock(run, { ...ctx, mult: 1 }, me, x.v, { nodex: 1 });
    if (x.k === "battery" && (when === "start" || when === "all")) { cp.energy += x.v; pushEv(ctx, { k: "energy", p: cp.i, n: x.v }); }
  }
}
// ops 실행 (src: {k:'p'|'e', i})
function exec(run, ops, ctx) {
  const cb = run.cb; if (!cb) return;
  for (const o of ops || []) {
    if (++ctx.budget.n > OP_LIMIT) { if (!ctx.budget.warned) { ctx.budget.warned = 1; pushEv(ctx, { k: "limit" }); } return; }
    if (cb.done) return;
    const me = ctx.src, isP = me.k === "p", cp = isP ? cb.ps[me.i] : null;
    switch (o.op) {
      case "DAMAGE": {
        if (isP) { for (const t of enemyTargets(run, ctx, o.tgt)) { const n = o.n + perVal(run, ctx, o.per, cb.en[t]); const un = hit(run, ctx, me, { k: "e", i: t }, n, o); if (ctx.firstDmg == null) { ctx.firstDmg = n; ctx.firstT = t; } void un; } }
        else for (const t of playerTargets(run, ctx, o.tgt)) hit(run, ctx, me, { k: "p", i: t }, o.n, o);
        break;
      }
      case "BLOCK": {
        if (!isP) { gainBlock(run, ctx, me, o.n, { nodex: 1 }); break; }
        for (const t of playerTargets(run, ctx, o.tgt)) gainBlock(run, ctx, { k: "p", i: t }, o.n + perVal(run, ctx, o.per), o);
        break;
      }
      case "HEAL": { if (!isP) { healEnt(run, ctx, me, scaleN(o.n, ctx.mult)); break; } for (const t of playerTargets(run, ctx, o.tgt)) healEnt(run, ctx, { k: "p", i: t }, scaleN(o.n, ctx.mult)); break; }
      case "DRAW": if (cp) drawCards(run, ctx, cp, o.n); break;
      case "DISCARD": if (cp) for (let k = 0; k < o.n && cp.hand.length; k++) { const c = cp.hand.splice(ri(run, cp.hand.length), 1)[0]; cp.disc.push(c); pushEv(ctx, { k: "discard", p: me.i, u: c.u }); } break;
      case "ENERGY": if (cp) { cp.energy = Math.max(0, cp.energy + o.n); pushEv(ctx, { k: "energy", p: me.i, n: o.n }); } break;
      case "APPLY": {
        const n = scaleN(o.n + plusOf(run, ctx, o.s), ctx.mult);
        if (!isP) { if (o.tgt === "self") applySt(run, ctx, me, o.s, o.n); else for (const t of playerTargets(run, ctx, o.tgt)) applySt(run, ctx, { k: "p", i: t }, o.s, o.n); break; }
        if (o.tgt === "self") applySt(run, ctx, me, o.s, n);
        else if (o.tgt === "team" || o.tgt === "ally") for (const t of playerTargets(run, ctx, o.tgt)) applySt(run, ctx, { k: "p", i: t }, o.s, n);
        else for (const t of enemyTargets(run, ctx, o.tgt)) applySt(run, ctx, { k: "e", i: t }, o.s, n);
        break;
      }
      case "MULT_STATUS": for (const t of enemyTargets(run, ctx, o.tgt)) { const e = cb.en[t], v = e.st[o.s] || 0; if (v) applySt(run, ctx, { k: "e", i: t }, o.s, v * (o.x - 1)); } break;
      case "REPEAT": { let t = typeof o.times === "number" ? o.times : (o.times.base || 0) + (o.times.per === "spent" ? ctx.spent || 0 : 0); t = Math.min(REPEAT_MAX, t); for (let k = 0; k < t; k++) exec(run, o.ops, ctx); break; }
      case "IF": exec(run, cond(run, ctx, o.cond) ? o.then : o.else, ctx); break;
      case "DELAY": if (cp) cp.delays.push({ at: cb.turn + (o.turns || 1), ops: o.ops, mult: ctx.mult }); pushEv(ctx, { k: "delay", p: me.i }); break;
      case "POWER": if (cp) { cp.pw[o.id] = (cp.pw[o.id] || 0) + o.n; pushEv(ctx, { k: "power", p: me.i, id: o.id }); } break;
      case "GAIN": if (cp) { cp.res[o.res] = clamp((cp.res[o.res] || 0) + o.n, 0, o.res === "luck" ? LUCK_MAX : SAND_MAX); pushEv(ctx, { k: "res", p: me.i, res: o.res, n: o.n }); } break;
      case "SPEND": if (cp) { const have = cp.res[o.res] || 0, n = o.all ? have : Math.min(have, o.n); cp.res[o.res] = have - n; ctx.spent = n; pushEv(ctx, { k: "res", p: me.i, res: o.res, n: -n }); exec(run, o.then, ctx); } break;
      case "SELF_DAMAGE": if (isP) { const p = run.players[me.i], n = Math.min(o.n, p.hp - 1); if (n > 0) { p.hp -= n; p.st.taken += n; pushEv(ctx, { k: "hit", t: me, n, un: n, b: 0, self: 1 }); } } break;
      case "DETONATE": for (const t of enemyTargets(run, ctx, o.tgt)) { const e = cb.en[t], s = e.st.rift || 0; if (!s) continue; delete e.st.rift; pushEv(ctx, { k: "detonate", t: { k: "e", i: t }, n: s }); hit(run, ctx, me, { k: "e", i: t }, s * o.m, { nostr: 1, attack: false }); } break;
      case "CONSUME": for (const t of enemyTargets(run, ctx, o.tgt)) { const e = cb.en[t], s = e.st[o.s] || 0; if (!s) continue; delete e.st[o.s]; pushEv(ctx, { k: "consume", t: { k: "e", i: t }, s: o.s, n: s }); if (o.m) hit(run, ctx, me, { k: "e", i: t }, s * o.m, { nostr: 1, attack: false }); } break;
      case "POISON_BURST": for (const t of enemyTargets(run, ctx, "all")) { const s = cb.en[t].st.poison || 0; if (s) hit(run, ctx, me, { k: "e", i: t }, s, { nostr: 1, attack: false, pure: 1 }); } break;
      case "CLEANSE": for (const t of playerTargets(run, ctx, o.tgt || "self")) { const c = cb.ps[t]; for (const s of DEBUFF) delete c.st[s]; pushEv(ctx, { k: "cleanse", t: { k: "p", i: t } }); } break;
      // 복사 카드끼리 서로 복사하는 무한 콤보 방지: 복사·되감기 카드는 복사 못 함 + 한 턴 5번까지
      case "COPY": if (cp && ctx.prevInst && cp.hand.length < HAND_MAX && (cp.copies || 0) < 5 && !cardOps(ctx.prevInst).some((x) => x.op === "COPY" || x.op === "REWIND")) { cp.copies = (cp.copies || 0) + 1; const c = { ...ctx.prevInst, u: run.nuid++, tmp: 1, free: o.free ? 1 : 0 }; cp.hand.push(c); pushEv(ctx, { k: "addhand", p: me.i, u: c.u }); } break;
      case "TRANSFORM": if (cp) { const pool = poolFor(run.players[me.i].char).filter((d) => d.r !== "basic"); for (let k = 0; k < o.n; k++) { const cand = cp.hand.filter((c) => c.u !== ctx.selfU); if (!cand.length) break; const c = pick(run, cand), j = cp.hand.indexOf(c); cp.hand[j] = { u: run.nuid++, id: pick(run, pool).id, up: 0, evo: null, eng: null, tmp: 1 }; pushEv(ctx, { k: "transform", p: me.i, u: cp.hand[j].u }); } } break;
      case "COST": if (cp) for (const c of cp.hand) if (c.u !== ctx.selfU) cp.cmod[c.u] = (cp.cmod[c.u] || 0) + o.n; break;
      case "RECALL": if (cp) for (let k = 0; k < o.n && cp.disc.length && cp.hand.length < HAND_MAX; k++) { const c = cp.disc.splice(ri(run, cp.disc.length), 1)[0]; cp.hand.push(c); pushEv(ctx, { k: "addhand", p: me.i, u: c.u }); } break;
      case "REWIND": if (cp && ctx.prevOps && ctx.depth < 1 && !ctx.prevOps.some((x) => CARD_GEN.includes(x.op))) { pushEv(ctx, { k: "rewind", p: me.i }); const sub = { ...ctx, depth: ctx.depth + 1, tgtE: ctx.prevTgt ?? ctx.tgtE, firstDmg: null }; exec(run, ctx.prevOps, sub); } break;
      case "RANDOM_OF": exec(run, pick(run, o.list), ctx); break;
      case "GOLD": if (isP) { const p = run.players[me.i]; p.gold = Math.max(0, p.gold + o.n); pushEv(ctx, { k: "gold", p: me.i, n: o.n }); } break;
      case "TEAM_ENERGY": for (const t of aliveP(run)) { t.energy += o.n; pushEv(ctx, { k: "energy", p: t.i, n: o.n }); } break;
      // ---- 5단계: 물약 · 소환수/장치 · 확률/주사위 ----
      case "ADD_CARD": if (cp) for (let k = 0; k < (o.n || 1) && cp.hand.length < HAND_MAX; k++) { const id = o.id === "potion" ? pick(run, D.CARDS.filter((d) => d.c === "potion")).id : o.id; if (!CARD[id]) break; const c = { u: run.nuid++, id, up: 0, evo: null, eng: null, tmp: 1 }; cp.hand.push(c); pushEv(ctx, { k: "addhand", p: me.i, u: c.u, id }); } break;
      case "SUMMON": if (cp) for (let k = 0; k < (o.n || 1); k++) summon(run, ctx, cp, o.k, scaleN(o.v, ctx.mult)); break;
      case "TRIGGER_SUMMONS": if (cp) summonsAct(run, ctx, cp, "all"); break;
      case "BUFF_SUMMONS": if (cp) for (const x of cp.sm) if (!o.kind || x.k === o.kind) x.v += o.n; pushEv(ctx, { k: "summonbuff", p: me.i }); break;
      case "CONSUME_SUMMONS": if (cp) { const take = cp.sm.filter((x) => !o.kind || x.k === o.kind); ctx.consumed = take.length; ctx.consumedPow = take.reduce((a, x) => a + x.v, 0); cp.sm = cp.sm.filter((x) => !take.includes(x)); pushEv(ctx, { k: "sacrifice", p: me.i, n: take.length }); exec(run, o.then, ctx); } break;
      case "CHANCE": { const luck = cp ? cp.res.luck || 0 : 0, p = Math.min(95, o.p + 5 * luck), win = rnd(run) * 100 < p; pushEv(ctx, { k: "chance", p: me.i, win, pct: p }); if (!win && cp?.pw.failBlock) gainBlock(run, ctx, me, cp.pw.failBlock, { nodex: 1 }); exec(run, win ? o.then : o.else, ctx); break; }
      case "ROLL": { let sum = 0; const dice = []; for (let k = 0; k < (o.n || 1); k++) { let r = 1 + ri(run, o.d); if (cp && (cp.res.luck || 0) > 0 && r <= o.d / 3) { r = Math.max(r, 1 + ri(run, o.d)); cp.res.luck--; } dice.push(r); sum += r; } ctx.roll = sum; pushEv(ctx, { k: "roll", p: me.i, dice, d: o.d }); exec(run, o.then, ctx); break; }
      case "DRAWBONUS": if (cp) cp.firstBonus += o.n; break;
      case "STEAL": for (const t of playerTargets(run, ctx, o.tgt)) { const p = run.players[t], n = Math.min(p.gold, o.n); p.gold -= n; pushEv(ctx, { k: "steal", t: { k: "p", i: t }, n }); } break;
      case "SUMMON_ENEMY": { const mine = cb.en.filter((e) => !e.dead && e.minion); for (let k = 0; k < (o.n || 1) && mine.length + k < o.max; k++) { const i = spawnEnemy(run, o.id, true); pushEv(ctx, { k: "spawn", t: { k: "e", i } }); } break; }
      case "ADD_CURSE": for (const t of playerTargets(run, ctx, o.tgt)) { const cpp = cb.ps[t]; for (let k = 0; k < (o.n || 1); k++) cpp.disc.push({ u: run.nuid++, id: o.id, up: 0, evo: null, eng: null, tmp: 1 }); pushEv(ctx, { k: "addcurse", t: { k: "p", i: t }, id: o.id, n: o.n || 1 }); } break;
      case "DRAWMINUS": for (const t of playerTargets(run, ctx, o.tgt)) { cb.ps[t].drawMinus = (cb.ps[t].drawMinus || 0) + o.n; pushEv(ctx, { k: "drawminus", t: { k: "p", i: t }, n: o.n }); } break;
      case "TIMEEAT": for (const t of playerTargets(run, ctx, "team")) { cb.ps[t].eMinus = (cb.ps[t].eMinus || 0) + 1; pushEv(ctx, { k: "timeeat", t: { k: "p", i: t } }); } break;
      case "BOSS_REWIND": { const e = cb.en[me.i]; if (e.flags.rewound) break; e.flags.rewound = 1; for (const s of DEBUFF) delete e.st[s]; healEnt(run, ctx, me, Math.floor(e.maxHp * 0.25)); pushEv(ctx, { k: "bossrewind", t: me }); break; }
    }
  }
}
const mkCtx = (run, src, o = {}) => ({ src, mult: 1, ev: o.ev || [], budget: o.budget || { n: 0 }, depth: 0, tgtE: null, tgtP: null, spent: 0, ...o });

// =========================================================
// 4) 전투
// =========================================================
function poolFor(char) { return D.CARDS.filter((d) => (d.c === char || d.c === "common") && d.t !== "cur" && d.r !== "special"); }
function spawnEnemy(run, id, minion = false) {
  const d = D.ENEMIES[id], base = d.hp[0] + ri(run, d.hp[1] - d.hp[0] + 1), hp = Math.round(base * run.hpMult * regHp(run));
  const e = { id, hp, maxHp: hp, block: 0, st: {}, mi: 0, last: [], intent: null, dead: false, minion: minion || !!d.minion, flags: {} };
  if (d.ai === "ghost") { const g = run.bt?.ghost || { name: "?", char: "knight", hp: 60, deck: [], str: 0 }; e.hp = e.maxHp = Math.max(20, g.hp | 0); e.gname = g.name; e.gchar = g.char; e.gdeck = g.deck.slice(0, 60); if (g.str) e.st.str = g.str; }
  run.cb.en.push(e); const i = run.cb.en.length - 1;
  if (d.start) exec(run, d.start, mkCtx(run, { k: "e", i }));
  chooseIntent(run, i);
  return i;
}
function startCombat(run, ids, kind, evIn) {   // evIn: 이 행동의 사건 목록(전투 시작 연출이 화면으로 가게)
  run.phase = "combat";
  run.cb = { kind, turn: 1, en: [], ps: [], reso: null, played: 0, done: false, ev: evIn || [] };
  for (const p of run.players) {
    if (!p.alive) continue;
    const draw = shuffle(run, p.deck.map((c) => ({ ...c })));
    run.cb.ps.push({ i: p.i, draw, hand: [], disc: [], exh: [], energy: 0, block: 0, st: {}, pw: {}, res: {}, sm: [], delays: [], cmod: {}, played: 0, atkN: 0, firstBonus: 0, dbl: 0, ready: false, prevOps: null, prevTgt: null, prevInst: null, eMinus: 0, resoOnce: {} });
  }
  // 죽은 사람(협동)은 빈 자리로 둠 → ps 인덱스 = 플레이어 번호
  const ps = []; for (const p of run.players) ps[p.i] = run.cb.ps.find((c) => c.i === p.i) || { i: p.i, draw: [], hand: [], disc: [], exh: [], energy: 0, block: 0, st: {}, pw: {}, res: {}, delays: [], cmod: {}, played: 0, atkN: 0, firstBonus: 0, dbl: 0, ready: true, eMinus: 0, resoOnce: {}, sm: [], out: true };
  run.cb.ps = ps;
  for (const id of ids) spawnEnemy(run, id);
  const ev = run.cb.ev;
  for (const cp of aliveP(run)) relicHook(run, cp.i, "combatStart", mkCtx(run, { k: "p", i: cp.i }, { ev }));
  flushStream(run, ev);
  startTurn(run, ev, true);
}
function drawCards(run, ctx, cp, n) {
  for (let k = 0; k < n; k++) {
    if (!cp.draw.length) { if (!cp.disc.length) break; cp.draw = shuffle(run, cp.disc); cp.disc = []; pushEv(ctx, { k: "reshuffle", p: cp.i }); }
    const c = cp.draw.pop(); if (cp.hand.length >= HAND_MAX) { cp.disc.push(c); continue; }
    cp.hand.push(c); pushEv(ctx, { k: "draw", p: cp.i, u: c.u });
  }
}
function relicHook(run, pi, hook, ctx, info = {}) {
  const p = run.players[pi], cp = run.cb?.ps[pi];
  for (const r of p.relics) {
    const d = RELIC[r.id]; if (!d || d.hook !== hook) continue;
    if (hook === "cardPlay") { if (d.ctype && info.type !== d.ctype) continue; if (d.ctag && !info.tags?.includes(d.ctag)) continue; if (d.every) { cp.rc = cp.rc || {}; cp.rc[r.id] = (cp.rc[r.id] || 0) + 1; if (cp.rc[r.id] % d.every) continue; } }
    if (d.once && cp) { if (cp.resoOnce[r.id]) continue; cp.resoOnce[r.id] = 1; }
    pushEv(ctx, { k: "relic", p: pi, id: r.id });
    const sub = { ...ctx, src: { k: "p", i: pi }, mult: 1, tgtE: null, tgtP: null };
    exec(run, d.ops, sub);
  }
}
function startTurn(run, ev, first = false) {
  const cb = run.cb; if (!first) cb.turn++; run.turnTotal++;
  cb.reso = null; cb.played = 0;
  for (const cp of aliveP(run)) {
    const ctx = mkCtx(run, { k: "p", i: cp.i }, { ev }), p = run.players[cp.i];
    if (!first) cp.block = cp.pw.keepBlock ? Math.floor((cp.block * Math.min(100, cp.pw.keepBlock)) / 100) : 0;   // 첫 턴은 전투 시작 유물이 준 방어도 유지
    if (cp.st.poison) { loseHp(run, ctx, { k: "p", i: cp.i }, cp.st.poison, null); pushEv(ctx, { k: "tick", t: { k: "p", i: cp.i }, s: "poison", n: cp.st.poison }); cp.st.poison--; if (cp.st.poison <= 0) delete cp.st.poison; if (!p.alive) continue; }
    cp.energy = Math.max(0, 3 - (cp.eMinus || 0)) + (first ? cp.energy : 0); cp.eMinus = 0; cp.cmod = {}; cp.played = 0; cp.copies = 0; cp.ready = false; cp.dbl = cp.pw.firstDouble || 0;   // 첫 턴: 전투 시작 유물 에너지 더함
    for (const c of cp.hand) c.free = 0;
    relicHook(run, cp.i, "turnStart", ctx);
    if (cp.pw.riftArmor) gainBlock(run, ctx, { k: "p", i: cp.i }, cp.pw.riftArmor * aliveE(cb).filter((e) => e.st.rift).length, { nodex: 1 });
    if (cp.pw.turnBlock) gainBlock(run, ctx, { k: "p", i: cp.i }, cp.pw.turnBlock, { nodex: 1 });
    if (cp.pw.turnSand) exec(run, [{ op: "GAIN", res: "sand", n: cp.pw.turnSand }], ctx);
    if (cp.pw.teamBlock) for (const t of aliveP(run)) gainBlock(run, ctx, { k: "p", i: t.i }, cp.pw.teamBlock, { nodex: 1 });
    if (cp.pw.turnPoison) exec(run, [{ op: "APPLY", s: "poison", n: cp.pw.turnPoison, tgt: "all" }], ctx);
    if (cp.pw.turnPotion) exec(run, [{ op: "ADD_CARD", id: "potion", n: cp.pw.turnPotion }], ctx);
    if (cp.pw.turnSpirit) exec(run, [{ op: "SUMMON", k: "spirit", v: cp.pw.turnSpirit }], ctx);
    if (cp.pw.turnTurret) exec(run, [{ op: "SUMMON", k: "turret", v: cp.pw.turnTurret }], ctx);
    if (cp.pw.spiritArmor) gainBlock(run, ctx, { k: "p", i: cp.i }, cp.pw.spiritArmor * cp.sm.filter((x) => x.k === "spirit").length, { nodex: 1 });
    if (cp.pw.deviceArmor) gainBlock(run, ctx, { k: "p", i: cp.i }, cp.pw.deviceArmor * cp.sm.filter((x) => x.k !== "spirit").length, { nodex: 1 });
    if (cp.pw.turnEnergy) { cp.energy += cp.pw.turnEnergy; pushEv(ctx, { k: "energy", p: cp.i, n: cp.pw.turnEnergy }); }
    if (cp.pw.turnLuck) exec(run, [{ op: "GAIN", res: "luck", n: cp.pw.turnLuck }], ctx);
    if (cp.pw.turnGamble) exec(run, [{ op: "CHANCE", p: 50, then: [{ op: "ENERGY", n: cp.pw.turnGamble }], else: [] }], ctx);
    if (cp.sm.length) summonsAct(run, ctx, cp, "start");
    const due = cp.delays.filter((d) => d.at <= cb.turn); cp.delays = cp.delays.filter((d) => d.at > cb.turn);
    for (const d of due) { pushEv(ctx, { k: "delayfire", p: cp.i }); exec(run, d.ops, { ...ctx, mult: d.mult }); if (cb.done || checkWin(run, ev)) return; }
    const minus = p.relics.reduce((s, r) => s + (RELIC[r.id]?.drawMinus || 0), 0);
    drawCards(run, ctx, cp, Math.max(1, 5 - minus - (cp.drawMinus || 0) + (first ? cp.firstBonus : 0))); cp.drawMinus = 0;
  }
  if (!aliveP(run).length) return endCombat(run, false, ev);
  for (let i = 0; i < cb.en.length; i++) if (!cb.en[i].dead && !cb.en[i].intent) chooseIntent(run, i);
}
// 적 행동 고르기
export function moveOf(e) { return e.intent ? (e.gm || D.ENEMIES[e.id].moves[e.intent.key]) : null; }
function chooseIntent(run, i) {
  const cb = run.cb, e = cb.en[i], d = D.ENEMIES[e.id]; let key;
  if (d.ai === "cycle") { const order = e.order || d.order, L = order.length; const idx = d.loop && !e.order && e.mi >= L ? 1 + ((e.mi - 1) % (L - 1)) : e.mi % L; key = order[idx]; }
  else if (d.ai === "rand") { const keys = Object.keys(d.moves); for (let k = 0; k < 6; k++) { key = d.w ? wpick(run, Object.entries(d.w)) : pick(run, keys); if (!(e.last.length >= 2 && e.last[0] === key && e.last[1] === key)) break; } }
  else if (d.ai === "warden") { const kids = cb.en.filter((x) => !x.dead && x.minion).length; if (e.mi === 0 || (kids === 0 && e.mi % 4 === 0)) key = "sprout"; else key = ["crush", "thorn", "bark"][e.mi % 3]; }
  else if (d.ai === "ghost") { key = "g"; e.gm = ghostMove(run, e); }
  else if (d.ai === "devourer") { if (e.hp <= e.maxHp / 2 && !e.flags.rewound) key = "rewind"; else if (e.mi % 4 === 3) key = "consume"; else key = e.mi % 2 ? "rend" : "gaze"; }
  e.mi++; e.last = [key, ...e.last].slice(0, 2);
  const al = aliveP(run); e.intent = { key, tgt: al.length ? pick(run, al).i : 0 };
}
export function intentInfo(run, i) {
  const e = run.cb.en[i], mv = moveOf(e); if (!mv) return null;
  let dmg = 0, times = 0, team = false;
  const walk = (ops, mul = 1) => { for (const o of ops) { if (o.op === "DAMAGE") { let n = o.n + (e.st.str || 0); if (e.st.weak) n *= 0.75; if (e.st.freeze) n *= 1 - Math.min(0.5, 0.1 * e.st.freeze); n = Math.floor(n * run.dmgMult * regDmg(run)); dmg = n; times += mul; if (o.tgt === "team") team = true; } if (o.op === "REPEAT") walk(o.ops, mul * o.times); if (o.tgt === "team") team = true; } };
  walk(mv.ops);
  return { i: mv.i, key: e.intent.key, dmg, times, tgt: team ? -1 : e.intent.tgt, stun: (e.st.stun || 0) > 0 };
}
function enemyPhase(run, ev) {
  const cb = run.cb; if (checkWin(run, ev)) return;
  if (cb.kind === "duel" && cb.turn >= DUEL_TURNS) return endCombat(run, false, ev);   // 결투 시간 끝: 준 피해로 판정
  // 끝없는 전투 방지: 20턴부터 적이 매 턴 '균열 폭주'(힘 +2), 60턴부터 모두 막을 수 없는 피해 10
  if (cb.turn >= 20) { for (let i = 0; i < cb.en.length; i++) if (!cb.en[i].dead) applySt(run, { ev }, { k: "e", i }, "str", 2); pushEv({ ev }, { k: "enrage", turn: cb.turn }); }
  if (cb.turn >= 60) { for (const cp of aliveP(run)) loseHp(run, { ev }, { k: "p", i: cp.i }, 10, null); if (!aliveP(run).length) return endCombat(run, false, ev); }
  for (let i = 0; i < cb.en.length; i++) {
    const e = cb.en[i]; if (e.dead) continue; const d = D.ENEMIES[e.id], me = { k: "e", i }, ctx = mkCtx(run, me, { ev });
    e.block = 0;
    if (d.ai === "warden") { if (cb.en.some((x) => !x.dead && x.minion)) gainBlock(run, ctx, me, 8, { nodex: 1 }); if (e.hp < e.maxHp / 2 && !e.flags.thorny) { e.flags.thorny = 1; applySt(run, ctx, me, "thorns", 4); } }
    if (e.st.poison) { pushEv(ctx, { k: "tick", t: me, s: "poison", n: e.st.poison }); loseHp(run, ctx, me, e.st.poison, null); e.st.poison--; if (e.st.poison <= 0) delete e.st.poison; if (e.dead) { if (checkWin(run, ev)) return; continue; } }
    if (e.flags.stunCd > 0) e.flags.stunCd--;
    // 보스 단계: 체력이 정해진 % 아래로 처음 내려가면 변신(효과 실행 + 행동 순서 바꿈)
    if (d.phases) for (const [k, ph] of d.phases.entries()) { if (e.flags["ph" + k] || e.hp > (e.maxHp * ph.at) / 100) continue; e.flags["ph" + k] = 1; pushEv(ctx, { k: "phase", t: me, n: k + 1 }); exec(run, ph.ops, ctx); if (ph.order) { e.order = ph.order; e.mi = 0; } }
    if (e.st.stun) { e.st.stun--; if (e.st.stun <= 0) delete e.st.stun; pushEv(ctx, { k: "stunned", t: me }); }
    else { const mv = moveOf(e); pushEv(ctx, { k: "act", t: me, key: e.intent?.key, i: mv?.i }); ctx.tgtP = e.intent?.tgt; exec(run, mv?.ops || [], ctx); }
    if (!aliveP(run).length) return endCombat(run, false, ev);
    if (e.st.burn && !e.dead) { pushEv(ctx, { k: "tick", t: me, s: "burn", n: e.st.burn }); loseHp(run, ctx, me, e.st.burn, null); e.st.burn = Math.floor(e.st.burn / 2); if (!e.st.burn) delete e.st.burn; }
    if (e.st.ritual && !e.dead) applySt(run, ctx, me, "str", e.st.ritual);
    for (const s of ["weak", "vuln", "frail", "freeze"]) if (e.st[s]) { e.st[s]--; if (!e.st[s]) delete e.st[s]; }
    if (checkWin(run, ev)) return;
  }
  for (let i = 0; i < cb.en.length; i++) if (!cb.en[i].dead) chooseIntent(run, i);
  startTurn(run, ev);
}
function checkWin(run, ev) { if (run.cb && !run.cb.done && !aliveE(run.cb).length) { endCombat(run, true, ev); return true; } return false; }
function endRound(run, ev) {
  const cb = run.cb;
  for (const cp of aliveP(run)) {
    const ctx = mkCtx(run, { k: "p", i: cp.i }, { ev }), me = { k: "p", i: cp.i };
    const doubt = cp.hand.filter((c) => c.id === "cu_doubt").length; if (doubt) { pushEv(ctx, { k: "curse", p: cp.i }); loseHp(run, ctx, me, 2 * doubt, null); }
    for (const c of cp.hand) { if (c.tmp && (CARD[c.id].t === "cur" || CARD[c.id].r === "special")) continue; cp.disc.push(c); } cp.hand = [];   // 남은 물약은 사라짐
    if (cp.sm.length) { summonsAct(run, ctx, cp, "end"); if (checkWin(run, ev)) return; }
    relicHook(run, cp.i, "turnEnd", ctx);
    for (const r of run.players[cp.i].relics) { const n = RELIC[r.id]?.endSelf; if (n) loseHp(run, ctx, me, n, null); }
    if (cp.st.burn) { pushEv(ctx, { k: "tick", t: me, s: "burn", n: cp.st.burn }); loseHp(run, ctx, me, cp.st.burn, null); cp.st.burn = Math.floor(cp.st.burn / 2); if (!cp.st.burn) delete cp.st.burn; }
    if (cp.st.regen) { healEnt(run, ctx, me, cp.st.regen); cp.st.regen--; if (!cp.st.regen) delete cp.st.regen; }
    for (const s of ["weak", "vuln", "frail", "freeze"]) if (cp.st[s]) { cp.st[s]--; if (!cp.st[s]) delete cp.st[s]; }
  }
  if (!aliveP(run).length) return endCombat(run, false, ev);
  enemyPhase(run, ev);
}
function endCombat(run, win, ev) {
  const cb = run.cb; if (cb.done) return; cb.done = true;
  if (cb.kind === "duel") {
    const e = cb.en[0], p = run.players[0], dmgPct = Math.round((100 * (e.maxHp - Math.max(0, e.hp))) / e.maxHp), hpPct = win ? Math.round((100 * Math.max(0, p.hp)) / p.maxHp) : 0;
    run.bt.res = { kill: win ? 1 : 0, dead: p.alive ? 0 : 1, turns: cb.turn, dmgPct, hpPct, score: win ? 1000 - cb.turn * 40 + hpPct : Math.min(600, dmgPct * 6) - (p.alive ? 0 : 50) };
    run.bt.hist.push({ round: run.bt.round, ...run.bt.res, vs: run.bt.ghost?.name || "" });
    p.alive = true; p.hp = Math.max(1, Math.min(p.maxHp, run.bt.pre ?? p.hp));
    pushEv({ ev }, { k: "duelend", res: run.bt.res }); run.phase = "bwait"; run.room = { type: "bwait" }; return;
  }
  if (!win && run.mode === "battle") {   // 덱 배틀: 쓰러져도 끝나지 않음 (체력 40%로 일어나고 보상 없음)
    for (const p of run.players) { p.alive = true; p.hp = Math.max(1, Math.floor(p.maxHp * 0.4)); p.st.falls = (p.st.falls || 0) + 1; }
    pushEv({ ev }, { k: "defeat", soft: 1 }); run.phase = "map"; run.room = null; run.cb = null; roomDone(run); return;
  }
  if (!win) { run.phase = "over"; run.over = { win: false, floor: run.floor, killer: aliveE(cb)[0]?.id || null }; pushEv({ ev }, { k: "defeat" }); return; }
  pushEv({ ev }, { k: "victory" });
  const kind = cb.kind;
  for (const p of run.players) {
    if (!p.alive) { p.alive = true; p.hp = Math.max(1, Math.floor(p.maxHp / 4)); }   // 협동: 쓰러진 팀원은 전투가 끝나면 25%로 일어남
    relicHook(run, p.i, "combatEnd", mkCtx(run, { k: "p", i: p.i }, { ev }));
    if (kind === "elite") p.st.elites++;
  }
  if (kind === "boss") {
    if (run.ri >= (D.ORDER?.length || 1) - 1) { run.phase = "over"; run.over = { win: true, floor: run.floor }; return; }
    // 지역 보스: 큰 보상(골드·희귀 카드 3장 중 1·유물) 뒤 다음 지역으로
    const rw = { type: "reward", per: [], next: true };
    for (const p of run.players) {
      const mult = 1 + p.relics.reduce((s, r) => s + (RELIC[r.id]?.goldMult || 0), 0), gold = Math.round((60 + ri(run, 21)) * mult); p.gold += gold;
      const relic = randRelic(run, p, "rare") || randRelic(run, p); if (relic) gainRelic(run, p, relic);
      const pool = poolFor(p.char).filter((d) => d.r === "rare"), cards = []; for (let k = 0; k < 20 && cards.length < 3; k++) { const id = pick(run, pool).id; if (!cards.includes(id)) cards.push(id); }
      rw.per[p.i] = { gold, relic, cards, done: false };
    }
    run.room = rw; run.phase = "reward"; return;
  }
  // 보상: 골드·카드 3장 중 1장(각자)·엘리트는 유물
  const rw = { type: "reward", per: [] };
  for (const p of run.players) {
    const mult = 1 + p.relics.reduce((s, r) => s + (RELIC[r.id]?.goldMult || 0), 0);
    const gold = Math.round((kind === "elite" ? 25 + ri(run, 11) : 10 + ri(run, 11)) * mult); p.gold += gold;
    let relic = null; if (kind === "elite") { relic = randRelic(run, p); if (relic) gainRelic(run, p, relic); }
    rw.per[p.i] = { gold, relic, cards: cardChoices(run, p, kind === "elite" ? 1 : 0), done: false };
  }
  run.room = rw; run.phase = "reward";
}
function cardChoices(run, p, tier) {
  const pool = poolFor(p.char).filter((d) => d.r !== "basic"), out = [];
  for (let k = 0; k < 30 && out.length < 3; k++) {
    const r = wpick(run, tier ? [["common", 50], ["uncommon", 38], ["rare", 12]] : [["common", 60], ["uncommon", 33], ["rare", 7]]);
    const cand = pool.filter((d) => d.r === r && !out.includes(d.id)); if (!cand.length) continue; out.push(pick(run, cand).id);
  }
  return out;
}
function randRelic(run, p, rar) {
  const own = new Set(p.relics.map((r) => r.id));
  const ok = D.RELICS.filter((r) => r.r !== "start" && !own.has(r.id) && (run.mode === "coop" || r.kind !== "협동형"));
  if (!ok.length) return null; const r = rar || wpick(run, [["common", 55], ["uncommon", 33], ["rare", 12]]);
  const c = ok.filter((x) => x.r === r); return pick(run, c.length ? c : ok).id;
}
export function giveRelic(run, p, id) { gainRelic(run, p, id); }   // 시험·이벤트용
function gainRelic(run, p, id) {
  const d = RELIC[id]; if (!d) return; p.relics.push({ id });
  if (d.onPick?.maxhp) { p.maxHp = Math.max(1, p.maxHp + d.onPick.maxhp); p.hp = Math.min(p.hp, p.maxHp); }
  if (d.onPick?.engrave) engraveRand(run, p, d.onPick.engrave);
  if (d.onPick?.gold) p.gold += d.onPick.gold;
  if (d.onPick?.curse) p.deck.push(newInst(run, d.onPick.curse));
  if (d.onPick?.upgrade) for (let k = 0; k < d.onPick.upgrade; k++) { const c = p.deck.filter(canUpgrade); if (!c.length) break; const x = pick(run, c); upgradeInst(run, p, x, CARD[x.id].evo ? pick(run, Object.keys(CARD[x.id].evo)) : null); }
  if (d.onPick?.card) { const pool = poolFor(p.char).filter((c) => c.r === (d.onPick.card === "rare" ? "rare" : "uncommon")); if (pool.length) p.deck.push(newInst(run, pick(run, pool).id)); }
}

// =========================================================
// 5) 카드 쓰기
// =========================================================
function playCard(run, pi, a, ev) {
  const cb = run.cb, cp = cb.ps[pi], p = run.players[pi];
  if (!p.alive || cp.out) return "DEAD"; if (cp.ready) return "READY"; if (cp.played >= (run.mode === "battle" ? 30 : PLAY_LIMIT)) return "TURN_LIMIT";
  const hi = cp.hand.findIndex((c) => c.u === a.u); if (hi < 0) return "NO_CARD";
  const inst = cp.hand[hi], d = CARD[inst.id]; if (!d || d.unplay) return "UNPLAYABLE";
  const cost = costOf(cp, inst); if (cost > cp.energy) return "ENERGY";
  let tgtE = null, tgtP = null;
  if (d.tgt === "enemy") { tgtE = a.tgt | 0; if (!cb.en[tgtE] || cb.en[tgtE].dead) { tgtE = cb.en.findIndex((e) => !e.dead); if (tgtE < 0) return "BAD_TARGET"; } }   // 협동: 팀원이 방금 쓰러뜨린 적을 노렸으면 살아 있는 적에게
  if (d.tgt === "ally") { tgtP = a.tgt == null ? pi : a.tgt | 0; if (!run.players[tgtP]?.alive) return "BAD_TARGET"; }
  cp.energy -= cost; cp.hand.splice(hi, 1);
  if (d.t !== "pow") (d.ex ? cp.exh : cp.disc).push(inst);
  const ctx = mkCtx(run, { k: "p", i: pi }, { ev, tgtE, tgtP, prevOps: cp.prevOps, prevTgt: cp.prevTgt, prevInst: cp.prevInst, selfU: inst.u, cid: inst.id });
  pushEv(ctx, { k: "play", p: pi, u: inst.u, id: inst.id, tgt: tgtE ?? tgtP, ty: d.t });
  // 각인
  let mult = 1;
  if (inst.eng === "sacrifice") { exec(run, [{ op: "SELF_DAMAGE", n: 3 }], ctx); mult *= 1.5; }
  if (inst.eng === "overload" && cp.energy >= 1) { cp.energy--; mult *= 2; pushEv(ctx, { k: "overload", p: pi }); }
  if (inst.eng === "leech") ctx.leech = 30;
  const ops = cardOps(inst);
  let times = 1; if (cp.st.double) { times++; cp.st.double--; if (!cp.st.double) delete cp.st.double; } if (cp.dbl > 0) { times++; cp.dbl--; }
  const runOnce = (m) => { ctx.mult = m; ctx.firstDmg = null; exec(run, ops, ctx); if (inst.eng === "chain" && ctx.firstDmg && !cb.done) { const o = aliveE(cb).map((e) => cb.en.indexOf(e)).filter((x) => x !== ctx.firstT); if (o.length) hit(run, ctx, { k: "p", i: pi }, { k: "e", i: pick(run, o) }, Math.floor(ctx.firstDmg * 0.5), { nostr: 1 }); } };
  for (let t = 0; t < times && !cb.done; t++) { if (t) pushEv(ctx, { k: "double", p: pi }); if (inst.eng === "split") { runOnce(mult * 0.6); if (!cb.done) runOnce(mult * 0.6); } else runOnce(mult); }
  if (inst.eng === "echo") cp.delays.push({ at: cb.turn + 1, ops, mult: mult * 0.5 });
  if (inst.eng === "regress" && cp.prevOps && !cb.done && !cp.prevOps.some((x) => CARD_GEN.includes(x.op))) { pushEv(ctx, { k: "rewind", p: pi }); exec(run, cp.prevOps, { ...ctx, mult: mult * 0.5, depth: 1, tgtE: cp.prevTgt ?? tgtE }); }
  // 공명: 같은 턴에 앞 카드(팀 전체) → 이 카드 순서
  if (!cb.done) resonate(run, pi, inst, ctx);
  if (!cb.done) {
    relicHook(run, pi, "cardPlay", ctx, { type: d.t, tags: d.tags });
    if (d.r === "special" && cp.pw.potionBlock) gainBlock(run, ctx, { k: "p", i: pi }, cp.pw.potionBlock, { nodex: 1 });
    if (d.t === "atk") { cp.atkN++; if (cp.pw.staticAtk) exec(run, [{ op: "DAMAGE", n: cp.pw.staticAtk, tgt: "rand", nostr: 1 }], { ...ctx, mult: 1 }); }
  }
  cp.played++; cb.played++; p.st.played++; p.st.uses[inst.id] = (p.st.uses[inst.id] || 0) + 1;
  if (!ops.some((o) => o.op === "REWIND")) { cp.prevOps = ops; cp.prevTgt = tgtE; cp.prevInst = { id: inst.id, up: inst.up, evo: inst.evo, eng: inst.eng }; }
  checkWin(run, ev);
  return null;
}
export function findReso(prevTags, curTags) {
  if (!prevTags?.length || !curTags?.length) return null;
  const P = prevTags.includes("*"), Cc = curTags.includes("*");
  return D.RESON.findIndex((r) => (P || prevTags.includes(r.a)) && (Cc || curTags.includes(r.b)));
}
function resonate(run, pi, inst, ctx) {
  const cb = run.cb, tags = cardTags(inst), prev = cb.reso;
  cb.reso = { tags, by: pi };
  if (!prev) return;
  const idx = findReso(prev.tags, tags); if (idx == null || idx < 0) return;
  const R = D.RESON[idx], coop = prev.by !== pi, p = run.players[pi];
  pushEv(ctx, { k: "reso", p: pi, r: idx, coop: coop ? prev.by : null });
  p.st.resoN++; p.st.reso[idx] = (p.st.reso[idx] || 0) + 1; if (coop) p.st.coopReso++;
  const sub = { ...ctx, mult: coop ? 1.5 : 1, coopReso: coop, firstDmg: null };
  exec(run, R.ops, sub);
  relicHook(run, pi, "resonance", sub);
  cb.reso = null;   // 공명 한 번 쓰면 사슬은 새로 시작
}

// =========================================================
// 6) 방 (보상·이벤트·상점·휴식·보물)
// =========================================================
function enterNode(run, id, ev) {
  const nd = run.map.nodes[id]; run.at = id; run.floor = (run.base || 0) + nd.r; run.room = null;
  for (const p of run.players) { p.st.floors = Math.max(p.st.floors, nd.r + 1); }
  pushEv({ ev }, { k: "enter", node: id, type: nd.type }); (run.visited ||= []).push(id);
  const R = D.REGIONS[run.region];
  if (nd.type === "F") { const forced = run.sx?.enc; if (forced) run.sx.enc = null; return startCombat(run, forced || (nd.r < 3 && run.ri === 0 ? pick(run, R.easy) : nd.r < 2 ? pick(run, R.easy) : pick(run, R.normal)), "normal", ev); }   // 스트리머 모드: 시청자가 고른 적   // 스트리머 모드: 시청자가 고른 적
  if (nd.type === "E") return startCombat(run, pick(run, R.elites), "elite", ev);
  if (nd.type === "B") return startCombat(run, [run.map.boss && R.bosses.includes(run.map.boss) ? run.map.boss : pick(run, R.bosses)], "boss", ev);
  if (nd.type === "?") {
    const pool = D.EVENTS.filter((e) => !e.stream && (!e.reg || e.reg === run.region)), left = pool.filter((e) => !run.seenEv.includes(e.id));
    const forced = run.sx?.ev ? D.EVENTS.find((e) => e.id === run.sx.ev) : null; if (forced) run.sx.ev = null;   // 스트리머 모드: 시청자가 고른 이벤트
    const e = forced || pick(run, left.length ? left : pool); run.seenEv.push(e.id);
    run.phase = "event"; run.room = { type: "event", ev: e.id, chosen: null, result: null }; return;
  }
  if (nd.type === "$") {
    run.phase = "shop"; const per = [];
    for (const p of run.players) {
      const disc = 1 - p.relics.reduce((s, r) => s + (RELIC[r.id]?.shopDisc || 0), 0), price = (b) => Math.round((b + ri(run, 15)) * disc);
      const pool = poolFor(p.char).filter((d) => d.r !== "basic"), cards = [];
      for (let k = 0; k < 30 && cards.length < 5; k++) { const r = wpick(run, [["common", 55], ["uncommon", 35], ["rare", 10]]), cand = pool.filter((d) => d.r === r && !cards.some((x) => x.id === d.id)); if (!cand.length) continue; const id2 = pick(run, cand).id; cards.push({ id: id2, price: price({ common: 48, uncommon: 72, rare: 140 }[r]), sold: false }); }
      const relics = []; for (let k = 0; k < 2; k++) { const r = randRelic(run, { relics: [...p.relics, ...relics.map((x) => ({ id: x.id }))] }); if (r) relics.push({ id: r, price: price({ common: 140, uncommon: 190, rare: 250 }[RELIC[r].r]), sold: false }); }
      per[p.i] = { cards, relics, removePrice: Math.round(75 * disc), removed: false, done: false };
    }
    run.room = { type: "shop", per }; return;
  }
  if (nd.type === "R") { run.phase = "rest"; run.room = { type: "rest", per: run.players.map((p) => ({ engs: shuffle(run, Object.keys(D.ENGRAVE)).slice(0, 3), done: false, did: null })) }; return; }
  if (nd.type === "T") { run.phase = "treasure"; run.room = { type: "treasure", per: run.players.map((p) => { const r = randRelic(run, p); if (r) gainRelic(run, p, r); return { relic: r, done: false }; }) }; return; }
}
function afterRoom(run) { if (run.room?.per && run.room.per.some((x, i) => x && !x.done && run.players[i])) return; const next = run.room?.next; run.phase = "map"; run.room = null; run.cb = null; if (next) nextRegion(run); roomDone(run); }
// 다음 지역: 새 지도 · 잃은 체력 절반 회복
function nextRegion(run) {
  run.ri++; run.region = D.ORDER[run.ri]; run.base = run.floor + 1; run.at = null; run.map = genMap(run);
  for (const p of run.players) { p.hp = Math.min(p.maxHp, p.hp + Math.ceil((p.maxHp - p.hp) / 2)); p.st.regions = run.ri + 1; }
}
// 이벤트 결과 적용 (모든 팀원에게, 각자 무작위)
function applyFx(run, fx, ev) {
  let fight = null;
  for (const p of run.players) {
    if (fx.gold) p.gold = Math.max(0, p.gold + fx.gold);
    if (fx.maxhp) { p.maxHp = Math.max(1, p.maxHp + fx.maxhp); if (fx.maxhp > 0) p.hp += fx.maxhp; p.hp = Math.min(p.hp, p.maxHp); }
    if (fx.hp) p.hp = clamp(p.hp + fx.hp, 1, p.maxHp);
    if (fx.heal) p.hp = Math.min(p.maxHp, p.hp + Math.floor((p.maxHp * fx.heal) / 100));
    if (fx.card) { const pool = poolFor(p.char).filter((d) => d.r !== "basic"); const want = fx.card === "rare" ? "rare" : fx.card === "unc" ? "uncommon" : null; const c = CARD[fx.card] ? CARD[fx.card] : pick(run, want ? pool.filter((d) => d.r === want) : pool); p.deck.push(newInst(run, c.id)); pushEv({ ev }, { k: "gaincard", p: p.i, id: c.id }); }
    if (fx.curse) { p.deck.push(newInst(run, fx.curse)); pushEv({ ev }, { k: "gaincard", p: p.i, id: fx.curse }); }
    if (fx.relic) { const r = randRelic(run, p); if (r) { gainRelic(run, p, r); pushEv({ ev }, { k: "gainrelic", p: p.i, id: r }); } }
    if (fx.upgrade) for (let k = 0; k < fx.upgrade; k++) { const c = p.deck.filter(canUpgrade); if (!c.length) break; const x = pick(run, c); upgradeInst(run, p, x, CARD[x.id].evo ? pick(run, Object.keys(CARD[x.id].evo)) : null); pushEv({ ev }, { k: "upgrade", p: p.i, u: x.u }); }
    if (fx.engrave) engraveRand(run, p, fx.engrave, ev);
    if (fx.remove) { const c = p.deck.filter((x) => CARD[x.id].r === "basic"); if (c.length) { const x = pick(run, c); p.deck.splice(p.deck.indexOf(x), 1); pushEv({ ev }, { k: "remove", p: p.i, id: x.id }); } }
    if (fx.transform) for (let k = 0; k < fx.transform; k++) { const c = p.deck.filter((x) => CARD[x.id].t !== "cur"); if (!c.length) break; const x = pick(run, c), pool = poolFor(p.char).filter((d) => d.r !== "basic" && d.id !== x.id); const j = p.deck.indexOf(x); p.deck[j] = newInst(run, pick(run, pool).id); pushEv({ ev }, { k: "transformdeck", p: p.i, from: x.id, id: p.deck[j].id }); }
    if (fx.dup) { const c = p.deck.filter((x) => CARD[x.id].r !== "basic" && CARD[x.id].t !== "cur"); const x = c.length ? pick(run, c) : pick(run, p.deck); p.deck.push(newInst(run, x.id, { up: x.up, evo: x.evo, eng: x.eng })); pushEv({ ev }, { k: "gaincard", p: p.i, id: x.id }); }
    if (fx.fight) fight = fx.fight;
  }
  return fight;
}
function engraveRand(run, p, n, ev) {
  for (let k = 0; k < n; k++) { const c = p.deck.filter((x) => CARD[x.id].t !== "cur" && !x.eng); if (!c.length) return; const x = pick(run, c), ok = Object.keys(D.ENGRAVE).filter((e) => engOk(x, e)); if (!ok.length) continue; x.eng = pick(run, ok); p.st.eng++; if (ev) pushEv({ ev }, { k: "engrave", p: p.i, u: x.u, eng: x.eng }); }
}
function upgradeInst(run, p, inst, evo) { if (CARD[inst.id].evo) { inst.evo = evo; p.st.evo++; } else inst.up = 1; }

// =========================================================
// 7) 행동 하나 처리 — 유일한 상태 변경 입구
// =========================================================
// pi: 플레이어 번호 (협동 서버가 정한 공동 결정은 -1)
// 행동: path{node} · play{u,tgt} · end · reward{pick} · event{opt} · buy{kind,idx} · remove{u} · rest{kind,u,evo,eng} · leave
export function act(run, pi, a) {
  const ev = []; if (!a || typeof a !== "object") return { ok: false, err: "BAD_ACTION", ev };
  if (run.over) return { ok: false, err: "OVER", ev };
  const team = pi === -1, p = team ? null : run.players[pi]; if (!team && !p) return { ok: false, err: "BAD_PLAYER", ev };
  const fail = (err) => ({ ok: false, err, ev });
  switch (a.t) {
    case "path": {
      if (run.phase !== "map") return fail("PHASE"); if (run.mode === "coop" && !team) return fail("VOTE");
      if (!nextNodes(run).includes(a.node)) return fail("BAD_NODE");
      enterNode(run, a.node, ev); break;
    }
    case "play": { if (run.phase !== "combat" || team) return fail("PHASE"); const e = playCard(run, pi, a, ev); if (e) return fail(e); settle(run, ev); break; }
    case "end": {
      if (run.phase !== "combat" || team) return fail("PHASE"); const cp = run.cb.ps[pi]; if (!p.alive || cp.out) return fail("DEAD"); if (cp.ready) return fail("READY");
      cp.ready = true; pushEv({ ev }, { k: "ready", p: pi });
      settle(run, ev);
      break;
    }
    case "reward": {
      if (run.phase !== "reward" || team) return fail("PHASE"); const r = run.room.per[pi]; if (!r || r.done) return fail("DONE");
      const k = a.pick | 0; if (k >= 0) { const id = r.cards[k]; if (!id) return fail("BAD_PICK"); p.deck.push(newInst(run, id)); pushEv({ ev }, { k: "gaincard", p: pi, id }); }
      r.done = true; afterRoom(run); break;
    }
    case "event": {
      if (run.phase !== "event") return fail("PHASE"); if (run.mode === "coop" && !team) return fail("VOTE"); if (run.room.chosen != null) return fail("DONE");
      const e = D.EVENTS.find((x) => x.id === run.room.ev), o = e?.opts[a.opt | 0]; if (!o) return fail("BAD_OPT");
      if (o.need?.gold && run.players.some((x) => x.gold < o.need.gold)) return fail("NEED");
      run.room.chosen = a.opt | 0; let fx = o.fx, out = null;
      if (fx.chance) { const win = rnd(run) * 100 < fx.chance.p; out = win ? "win" : "lose"; fx = { ...fx, ...(win ? fx.chance.win : fx.chance.lose) }; delete fx.chance; }
      run.room.result = out;
      const fight = applyFx(run, fx, ev);
      if (fight) { const R = D.REGIONS[run.region]; startCombat(run, fight === "elite" ? pick(run, R.elites) : pick(run, R.normal), fight === "elite" ? "elite" : "normal", ev); }
      break;
    }
    case "buy": {
      if (run.phase !== "shop" || team) return fail("PHASE"); const s = run.room.per[pi], list = a.kind === "relic" ? s.relics : s.cards, it = list?.[a.idx | 0];
      if (!it || it.sold) return fail("SOLD"); if (p.gold < it.price) return fail("GOLD");
      p.gold -= it.price; it.sold = true;
      if (a.kind === "relic") { gainRelic(run, p, it.id); pushEv({ ev }, { k: "gainrelic", p: pi, id: it.id }); } else { p.deck.push(newInst(run, it.id)); pushEv({ ev }, { k: "gaincard", p: pi, id: it.id }); }
      break;
    }
    case "remove": {
      if (run.phase !== "shop" || team) return fail("PHASE"); const s = run.room.per[pi]; if (s.removed) return fail("DONE"); if (p.gold < s.removePrice) return fail("GOLD");
      const j = p.deck.findIndex((c) => c.u === a.u); if (j < 0) return fail("NO_CARD");
      p.gold -= s.removePrice; s.removed = true; pushEv({ ev }, { k: "remove", p: pi, id: p.deck[j].id }); p.deck.splice(j, 1); break;
    }
    case "rest": {
      if (run.phase !== "rest" || team) return fail("PHASE"); const s = run.room.per[pi]; if (s.done) return fail("DONE");
      if (a.kind === "heal") { const bonus = p.relics.reduce((x, r) => x + (RELIC[r.id]?.restBonus || 0), 0); const h = Math.floor((p.maxHp * (30 + bonus)) / 100); const before = p.hp; p.hp = Math.min(p.maxHp, p.hp + h); p.st.heal += p.hp - before; pushEv({ ev }, { k: "heal", t: { k: "p", i: pi }, n: p.hp - before }); }
      else if (a.kind === "up") { const c = p.deck.find((x) => x.u === a.u); if (!c || !canUpgrade(c)) return fail("BAD_CARD"); if (CARD[c.id].evo && !CARD[c.id].evo[a.evo]) return fail("BAD_EVO"); upgradeInst(run, p, c, a.evo); pushEv({ ev }, { k: "upgrade", p: pi, u: c.u }); }
      else if (a.kind === "eng") { const c = p.deck.find((x) => x.u === a.u); if (!c || !s.engs.includes(a.eng) || !engOk(c, a.eng)) return fail("BAD_CARD"); c.eng = a.eng; p.st.eng++; pushEv({ ev }, { k: "engrave", p: pi, u: c.u, eng: a.eng }); }
      else return fail("BAD_KIND");
      s.done = true; s.did = a.kind; afterRoom(run); break;
    }
    case "leave": {
      if (run.phase === "event") { if (run.room.chosen == null) return fail("CHOOSE"); run.phase = "map"; run.room = null; roomDone(run); break; }
      if (team || !["shop", "treasure", "rest", "reward"].includes(run.phase)) return fail("PHASE");
      const s = run.room.per[pi]; if (!s) return fail("BAD"); s.done = true; afterRoom(run); break;
    }
    default: return fail("BAD_ACTION");
  }
  if (run.log.length < 20000) run.log.push([pi, a]);   // 지역 4개 한 판도 다 담기게 (서버 검증 상한과 같음)
  return { ok: true, ev };
}
// 카드를 쓰다 쓰러지거나(가시 반격) 협동에서 팀원이 쓰러졌을 때: 전멸이면 패배, 남은 사람이 모두 준비 끝이면 적 차례
function settle(run, ev) {
  const cb = run.cb; if (run.phase !== "combat" || !cb || cb.done) return;
  if (checkWin(run, ev)) return;
  const al = aliveP(run); if (!al.length) return endCombat(run, false, ev);
  if (al.every((c) => c.ready)) endRound(run, ev);
}


// =========================================================
// 스트리머 모드: 시청자 투표·후원이 판에 개입 (서버만 부름. 혼자 하기 기록 검증에는 안 씀)
// kind: bless{id} · curse{id} · nick{nick, id?} · enc{ids} · event{id} · boss{id} · gift{}
// 전투 중이면 바로 적용, 아니면 run.sx에 쌓았다가 다음 전투 시작(이벤트·적은 다음 칸)에
// =========================================================
export function streamApply(run, kind, d = {}) {
  const ev = []; if (run.over) return { ok: false, ev };
  run.sx ||= { bless: [], curse: [], nick: [], boss: [], enc: null, ev: null, giftN: 0 };
  const sx = run.sx;
  if (kind === "bless" && D.BLESS.some((b) => b.id === d.id)) sx.bless.push(d.id);
  else if (kind === "curse" && D.CURSES.some((c) => c.id === d.id)) sx.curse.push(d.id);
  else if (kind === "nick") sx.nick.push({ nick: String(d.nick || "").slice(0, 12) || "?", id: D.ENEMIES[d.id] && !D.ENEMIES[d.id].boss && !D.ENEMIES[d.id].elite ? d.id : null });
  else if (kind === "boss" && D.BOSSBUFF.some((b) => b.id === d.id)) sx.boss.push(d.id);
  else if (kind === "enc" && Array.isArray(d.ids) && d.ids.length && d.ids.every((x) => D.ENEMIES[x])) sx.enc = d.ids.slice(0, 4);
  else if (kind === "event" && D.EVENTS.some((e) => e.id === d.id)) sx.ev = d.id;
  else if (kind === "gift") { sx.ev = "sv_gift"; sx.giftN++; if (run.phase === "map") { run.phase = "event"; run.room = { type: "event", ev: "sv_gift", chosen: null, result: null, donor: String(d.nick || "").slice(0, 12) }; pushEv({ ev }, { k: "giftevent" }); sx.ev = null; } }
  else return { ok: false, ev };
  pushEv({ ev }, { k: "stream", kind, id: d.id || null, nick: d.nick || null });
  if (run.phase === "combat" && run.cb && !run.cb.done) flushStream(run, ev);
  return { ok: true, ev };
}
function flushStream(run, ev) {
  const sx = run.sx, cb = run.cb; if (!sx || !cb || cb.done) return;
  for (const id of sx.bless.splice(0)) { const b = D.BLESS.find((x) => x.id === id); for (const cp of aliveP(run)) exec(run, b.ops, mkCtx(run, { k: "p", i: cp.i }, { ev })); pushEv({ ev }, { k: "bless", id }); }
  for (const id of sx.curse.splice(0)) {
    const c = D.CURSES.find((x) => x.id === id);
    if (c.side === "e") cb.en.forEach((e, i) => { if (!e.dead) exec(run, c.ops, mkCtx(run, { k: "e", i }, { ev })); });
    else for (const cp of aliveP(run)) for (const o of c.ops) if (o.op === "APPLY") applySt(run, { ev }, { k: "p", i: cp.i }, o.s, o.n);
    pushEv({ ev }, { k: "curse", id });
  }
  const boss = cb.en.findIndex((e) => !e.dead && D.ENEMIES[e.id].boss);
  if (boss >= 0) for (const id of sx.boss.splice(0)) {
    const b = D.BOSSBUFF.find((x) => x.id === id), e = cb.en[boss];
    if (id === "bb_hp") { const add = Math.round(e.maxHp * 0.25); e.maxHp += add; e.hp += add; } else exec(run, b.ops, mkCtx(run, { k: "e", i: boss }, { ev }));
    pushEv({ ev }, { k: "bossbuff", id });
  }
  // 후원자 닉네임 몬스터: 보스전이 아니고 적이 5마리보다 적을 때 합류
  while (sx.nick.length && cb.kind !== "boss" && cb.en.filter((e) => !e.dead).length < 5) {
    const n = sx.nick.shift(), R = D.REGIONS[run.region], id = n.id || pick(run, R.normal.flat());
    const i = spawnEnemy(run, id); cb.en[i].nick = n.nick; pushEv({ ev }, { k: "spawn", t: { k: "e", i }, nick: n.nick });
  }
}

// =========================================================
// 8) 결과 요약 · 검증용 다시 돌리기
// =========================================================
export function summary(run) {
  return { win: !!run.over?.win, floor: run.floor + 1, regions: (run.ri || 0) + 1, daily: run.daily || null, score: run.daily ? dailyScore(run) : undefined, turns: run.turnTotal, diff: run.diff, mode: run.mode,
    players: run.players.map((p) => ({ char: p.char, name: p.name, hp: p.hp, maxHp: p.maxHp, gold: p.gold, deck: p.deck.length, relics: p.relics.map((r) => r.id), st: p.st })) };
}
export function replay({ seed, chars, names, diff, mode, daily }, log) {
  const run = newRun({ seed, chars, names, diff, mode, daily });
  for (const [pi, a] of log || []) { const r = act(run, pi, a); if (!r.ok) return { ok: false, err: r.err, run }; if (run.phase === "event" && run.mode === "coop") {} }
  return { ok: true, run };
}

// =========================================================
// 9) 카드 설명 (ops → 한/日/EN 자동 생성, 실제 효과와 항상 같음)
// =========================================================
const SN = (s, L) => D.STATUS[s]?.n[L] || s;
const SMK = { spirit: ["영혼", "魂", "Spirit"], turret: ["포탑", "砲台", "Turret"], shield: ["방어막 발생기", "防御装置", "Shield Generator"], battery: ["축전지", "蓄電池", "Battery"] };
const TX = {
  dmg: ["피해 {n}", "{n}ダメージ", "Deal {n} damage"], dmgAll: ["모든 적에게 피해 {n}", "敵全体に{n}ダメージ", "Deal {n} damage to ALL enemies"], dmgRand: ["무작위 적에게 피해 {n}", "ランダムな敵に{n}ダメージ", "Deal {n} damage to a random enemy"],
  dmgOthers: ["다른 모든 적에게 피해 {n}", "他の敵全体に{n}ダメージ", "Deal {n} damage to all other enemies"], dmgOther: ["다른 적 하나에게 피해 {n}", "別の敵1体に{n}ダメージ", "Deal {n} damage to another enemy"], dmgLowest: ["체력이 가장 낮은 적에게 피해 {n}", "HPが最も低い敵に{n}ダメージ", "Deal {n} damage to the weakest enemy"],
  dmgBlock: ["내 방어도만큼 피해", "自分のブロック分のダメージ", "Deal damage equal to your Block"], perRift: [" (+대상 균열 1마다 {m})", "（+対象の亀裂1につき{m}）", " (+{m} per Rift on target)"],
  perSpent: ["쓴 모래 1마다 피해 {m}", "使った砂1につき{m}ダメージ", "Deal {m} damage per Sand spent"], perPlayed: [" (+이번 턴에 쓴 카드 1장마다 {m})", "（+このターン使ったカード1枚につき{m}）", " (+{m} per card played this turn)"],
  leech: [" (막히지 않은 피해의 {n}% 회복)", "（防がれなかったダメージの{n}%回復）", " (heal {n}% of unblocked damage)"],
  times: ["{x}를 {t}번", "{x}を{t}回", "{x}, {t} times"], timesSpent: ["{x}를 ({b} + 쓴 모래)번", "{x}を（{b}+使った砂）回", "{x}, ({b} + Sand spent) times"],
  blk: ["방어도 {n}", "ブロック{n}", "Gain {n} Block"], blkAlly: ["아군 하나에게 방어도 {n}", "味方1人にブロック{n}", "Give an ally {n} Block"], blkTeam: ["아군 모두 방어도 {n}", "味方全員にブロック{n}", "ALL allies gain {n} Block"],
  blkSand: ["방어도 {n} + 모래 1마다 {m}", "ブロック{n}+砂1につき{m}", "Gain {n} Block +{m} per Sand"],
  heal: ["체력 {n} 회복", "HP{n}回復", "Heal {n} HP"], healAlly: ["아군 하나 체력 {n} 회복", "味方1人のHPを{n}回復", "Heal an ally for {n}"], healTeam: ["아군 모두 체력 {n} 회복", "味方全員のHPを{n}回復", "Heal ALL allies for {n}"],
  draw: ["카드 {n}장 뽑기", "カードを{n}枚引く", "Draw {n} card(s)"], disc: ["무작위 카드 {n}장 버리기", "ランダムなカード{n}枚を捨てる", "Discard {n} random card(s)"],
  en: ["에너지 +{n}", "エネルギー+{n}", "Gain {n} Energy"], enLose: ["에너지 {n}", "エネルギー{n}", "Lose {a} Energy"],
  apSelf: ["{s} +{n}", "{s}+{n}", "Gain {n} {s}"], apEnemy: ["{s} {n} 부여", "{s}{n}を付与", "Apply {n} {s}"], apAll: ["모든 적에게 {s} {n}", "敵全体に{s}{n}", "Apply {n} {s} to ALL enemies"], apRand: ["무작위 적에게 {s} {n}", "ランダムな敵に{s}{n}", "Apply {n} {s} to a random enemy"],
  apTeam: ["아군 모두 {s} +{n}", "味方全員に{s}+{n}", "ALL allies gain {n} {s}"], apLast: ["그 적에게도 {s} {n}", "その敵にも{s}{n}", "Apply {n} {s} to that enemy too"],
  mult: ["대상의 {s} {x}배", "対象の{s}を{x}倍", "Multiply target's {s} by {x}"],
  if: ["{c}이면 {x}", "{c}なら{x}", "If {c}: {x}"], else: [" · 아니면 {x}", "・そうでなければ{x}", " · Otherwise: {x}"],
  delay1: ["다음 턴 시작에: {x}", "次のターン開始時：{x}", "Next turn: {x}"], delayN: ["{t}턴 뒤: {x}", "{t}ターン後：{x}", "In {t} turns: {x}"],
  sand: ["모래 +{n}", "砂+{n}", "Gain {n} Sand"], spendAll: ["모래를 모두 써서 {x}", "砂をすべて使い{x}", "Spend all Sand: {x}"],
  selfdmg: ["체력 {n} 잃기", "HPを{n}失う", "Lose {n} HP"],
  deto: ["대상의 균열을 모두 터뜨려 1마다 피해 {m}", "対象の亀裂を全て炸裂させ1につき{m}ダメージ", "Detonate all Rift on target: {m} damage per stack"], detoAll: ["모든 적의 균열을 터뜨려 1마다 피해 {m}", "全ての敵の亀裂を炸裂させ1につき{m}ダメージ", "Detonate Rift on ALL enemies: {m} damage per stack"],
  consume: ["대상의 {s}을(를) 모두 없애고 1마다 피해 {m}", "対象の{s}を全て消し1につき{m}ダメージ", "Remove all {s} on target: {m} damage per stack"], consumeAll: ["모든 적의 {s}을(를) 없애고 1마다 피해 {m}", "全ての敵の{s}を消し1につき{m}ダメージ", "Remove {s} from ALL enemies: {m} damage per stack"], consume0: ["대상의 {s}을(를) 모두 없애고", "対象の{s}を全て消し", "Remove all {s} on target, then"],
  pburst: ["모든 적이 자기 독만큼 피해", "全ての敵が自身の毒の分ダメージ", "ALL enemies take damage equal to their Poison"],
  cleanse: ["아군의 해로운 효과 모두 제거", "味方の不利な効果を全て除去", "Remove all debuffs from an ally"], cleanseTeam: ["아군 모두의 해로운 효과 제거", "味方全員の不利な効果を除去", "Remove debuffs from ALL allies"],
  copy: ["바로 전에 쓴 카드 복사본을 손으로 (이번 턴 0 에너지)", "直前に使ったカードの複製を手札に（このターン0コスト）", "Add a copy of your previous card to hand (costs 0 this turn)"],
  transform: ["손의 무작위 카드 {n}장을 다른 카드로 바꾸기 (이번 전투)", "手札のランダムなカード{n}枚を別のカードに（この戦闘）", "Transform {n} random card(s) in hand (this combat)"],
  cost: ["손의 카드 비용 {n} (이번 턴)", "手札のカードコスト{n}（このターン）", "Cards in hand cost {n} (this turn)"], recall: ["버린 카드에서 무작위 {n}장을 손으로", "捨て札からランダムに{n}枚を手札に", "Return {n} random card(s) from discard to hand"],
  rewind: ["이번 턴에 바로 전에 쓴 카드 효과를 한 번 더 (카드를 가져오거나 만드는 효과는 빼고)", "このターン直前に使ったカードの効果をもう一度（カードを手に入れる・作る効果は除く）", "Replay the effect of your previous card this turn (except effects that fetch or create cards)"],
  addPotion: ["무작위 물약 {n}개를 손으로", "ランダムなポーション{n}個を手札に", "Add {n} random Potion(s) to your hand"], addCard: ["'{c}' {n}장을 손으로", "『{c}』{n}枚を手札に", "Add {n} '{c}' to your hand"],
  smSpirit: ["영혼 소환 (공격 {v})", "魂を召喚（攻撃{v}）", "Summon a Spirit ({v} attack)"], smTurret: ["포탑 설치 (공격 {v})", "砲台を設置（攻撃{v}）", "Build a Turret ({v} attack)"], smShield: ["방어막 발생기 설치 (방어도 {v})", "防御フィールド装置を設置（ブロック{v}）", "Build a Shield Generator ({v} Block)"], smBattery: ["축전지 설치 (에너지 {v})", "蓄電池を設置（エネルギー{v}）", "Build a Battery ({v} Energy)"],
  smTimes: ["{x} ×{n}", "{x} ×{n}", "{x} ×{n}"], trig: ["모든 소환수·장치가 지금 한 번 작동", "全ての召喚獣・装置が今すぐ1回作動", "All summons and devices activate now"],
  buffSm: ["모든 소환수·장치 +{n}", "全ての召喚獣・装置+{n}", "All summons and devices +{n}"], buffSmK: ["모든 {k} +{n}", "全ての{k}+{n}", "All {k}s +{n}"],
  consume: ["모든 소환수·장치를 바쳐서 {x}", "全ての召喚獣・装置を捧げて{x}", "Sacrifice all summons and devices: {x}"], consumeK: ["모든 {k}를 바쳐서 {x}", "全ての{k}を捧げて{x}", "Sacrifice all {k}s: {x}"],
  chance: ["{p}% 확률로 {x}", "{p}%の確率で{x}", "{p}% chance: {x}"], chanceElse: [" · 실패하면 {x}", "・失敗したら{x}", " · On failure: {x}"],
  roll: ["주사위(d{d}) {n}개 굴려서 {x}", "サイコロ(d{d})を{n}個振り{x}", "Roll {n} d{d}: {x}"],
  perRoll: ["눈 1마다 피해 {m}", "出目1につき{m}ダメージ", "deal {m} damage per pip"], perRollB: ["눈 1마다 방어도 {m}", "出目1につきブロック{m}", "gain {m} Block per pip"],
  perSm: [" (+소환수·장치 1개마다 {m})", "（+召喚獣・装置1体につき{m}）", " (+{m} per summon/device)"], perCons: ["바친 것의 힘 1마다 피해 {m}", "捧げた力1につき{m}ダメージ", "deal {m} damage per power sacrificed"], perConsE: ["바친 것 1개마다 에너지 {m}", "捧げた1体につきエネルギー{m}", "gain {m} Energy per one sacrificed"], perConsH: ["바친 것 1개마다 체력 {m} 회복", "捧げた1体につきHP{m}回復", "heal {m} per one sacrificed"],
  perAllPoison: [" (+모든 적의 독 1마다 {m})", "（+全ての敵の毒1につき{m}）", " (+{m} per Poison on all enemies)"], perLuck: [" (+행운 1마다 {m})", "（+幸運1につき{m}）", " (+{m} per Luck)"], luck: ["행운 +{n}", "幸運+{n}", "Gain {n} Luck"], spendLuck: ["행운을 모두 써서 {x}", "幸運をすべて使い{x}", "Spend all Luck: {x}"],
  c_summonsGte: ["소환수·장치가 {n}개 이상이면", "召喚獣・装置が{n}体以上なら", "you have {n}+ summons/devices"],
  randOf: ["무작위로: {x}", "ランダムに：{x}", "At random: {x}"], or: [" 또는 ", " または ", " or "], drawbonus: ["첫 턴 카드 +{n}", "最初のターンのカード+{n}", "+{n} card(s) on turn 1"],
  ex: ["소멸", "消滅", "Exhaust"], unplay: ["사용할 수 없음", "使用不可", "Unplayable"], doubt: ["턴이 끝날 때 손에 있으면 체력 2 잃기", "ターン終了時に手札にあればHPを2失う", "If in hand at end of turn, lose 2 HP"],
  c_intentAtk: ["대상이 공격하려 하면", "対象が攻撃しようとしているなら", "the target intends to attack"], c_tgtHas: ["대상에게 {s}이(가) 있으면", "対象に{s}があるなら", "the target has {s}"], c_tgtStatusGte: ["대상의 {s}이(가) {n} 이상이면", "対象の{s}が{n}以上なら", "the target has {n}+ {s}"],
  c_tgtHpBelow: ["대상 체력이 {n}% 이하면", "対象のHPが{n}%以下なら", "the target is at or below {n}% HP"], c_hpBelow: ["내 체력이 {n}% 이하면", "自分のHPが{n}%以下なら", "you are at or below {n}% HP"],
  c_playedGte: ["이번 턴에 이미 카드 {n}장 이상 썼다면", "このターン既にカードを{n}枚以上使っていれば", "you've played {n}+ cards this turn"], c_turnMod: ["{n}번째 턴마다", "{n}ターンごとに", "every {n}th turn"], c_coopReso: ["팀원 카드와 이어진 공명이면", "仲間のカードと繋がる共鳴なら", "it chains off an ally's card"],
};
const tx = (k, L, v = {}) => TX[k][L].replace(/\{(\w+)\}/g, (_, x) => (v[x] ?? ""));
const dot = (L) => (L === 2 ? ". " : L === 1 ? "。" : ". ");
function condText(c, L) { return tx("c_" + c.k, L, { s: SN(c.s, L), n: c.n ?? c.pct ?? c.m }); }
export function descOps(ops, L = 0, ctx = {}) {
  const parts = [];
  const N = (n) => (ctx.mult ? scaleN(n, ctx.mult) : n);
  for (const o of ops) {
    switch (o.op) {
      case "DAMAGE": {
        let n = N(o.n) + (ctx.str && !o.nostr ? ctx.str : 0), s;
        if (o.per?.k === "block") s = tx("dmgBlock", L);
        else if (o.per?.k === "spent") s = tx("perSpent", L, { m: o.per.m });
        else if (o.per?.k === "roll" && !o.n) s = tx("perRoll", L, { m: o.per.m });
        else if (o.per?.k === "consumedPow" && !o.n) s = tx("perCons", L, { m: o.per.m });
        else { const k = { all: "dmgAll", rand: "dmgRand", others: "dmgOthers", other: "dmgOther", lowest: "dmgLowest" }[o.tgt] || "dmg"; s = tx(k, L, { n }); if (o.per?.k === "tgtStatus") s += tx("perRift", L, { m: o.per.m }); if (o.per?.k === "played") s += tx("perPlayed", L, { m: o.per.m }); if (o.per?.k === "summons" || o.per?.k === "summonPow") s += tx("perSm", L, { m: o.per.m }); if (o.per?.k === "allPoison") s += tx("perAllPoison", L, { m: o.per.m }); if (o.per?.k === "res" && o.per.res === "luck") s += tx("perLuck", L, { m: o.per.m }); }
        if (o.leech) s += tx("leech", L, { n: o.leech });
        parts.push(s); break;
      }
      case "REPEAT": { const x = descOps(o.ops, L, ctx).replace(/[.。]\s*$/, ""); parts.push(typeof o.times === "number" ? tx("times", L, { x, t: o.times }) : tx("timesSpent", L, { x, b: o.times.base })); break; }
      case "BLOCK": { const n = N(o.n); if (o.per?.k === "roll" && !o.n) parts.push(tx("perRollB", L, { m: o.per.m })); else if (o.per?.k === "res" && o.per.res === "luck") parts.push(tx("blk", L, { n }) + tx("perLuck", L, { m: o.per.m })); else if (o.per?.k === "summons") parts.push(tx("blk", L, { n }) + tx("perSm", L, { m: o.per.m })); else if (o.per?.k === "res") parts.push(tx("blkSand", L, { n, m: o.per.m })); else parts.push(tx(o.tgt === "ally" ? "blkAlly" : o.tgt === "team" ? "blkTeam" : "blk", L, { n })); break; }
      case "HEAL": if (o.per?.k === "consumed") { parts.push(tx("perConsH", L, { m: o.per.m })); break; } parts.push(tx(o.tgt === "ally" ? "healAlly" : o.tgt === "team" ? "healTeam" : "heal", L, { n: N(o.n) })); break;
      case "DRAW": parts.push(tx("draw", L, { n: o.n })); break;
      case "DISCARD": parts.push(tx("disc", L, { n: o.n })); break;
      case "ENERGY": if (o.per?.k === "consumed") { parts.push(tx("perConsE", L, { m: o.per.m })); break; } parts.push(o.n >= 0 ? tx("en", L, { n: o.n }) : tx("enLose", L, { n: o.n, a: -o.n })); break;
      case "APPLY": { const k = o.tgt === "self" ? "apSelf" : o.tgt === "all" ? "apAll" : o.tgt === "rand" ? "apRand" : o.tgt === "team" ? "apTeam" : o.tgt === "last" ? "apLast" : "apEnemy"; parts.push(tx(k, L, { s: SN(o.s, L), n: N(o.n) })); break; }
      case "MULT_STATUS": parts.push(tx("mult", L, { s: SN(o.s, L), x: o.x })); break;
      case "IF": { let s = tx("if", L, { c: condText(o.cond, L), x: descOps(o.then, L, ctx).replace(/[.。]\s*$/, "") }); if (o.else?.length) s += tx("else", L, { x: descOps(o.else, L, ctx).replace(/[.。]\s*$/, "") }); parts.push(s); break; }
      case "DELAY": parts.push(tx((o.turns || 1) > 1 ? "delayN" : "delay1", L, { t: o.turns, x: descOps(o.ops, L, ctx).replace(/[.。]\s*$/, "") })); break;
      case "POWER": parts.push(D.POWERS[o.id].d[L].replace("{n}", o.n)); break;
      case "GAIN": parts.push(tx(o.res === "luck" ? "luck" : "sand", L, { n: o.n })); break;
      case "SPEND": parts.push(tx(o.res === "luck" ? "spendLuck" : "spendAll", L, { x: descOps(o.then, L, ctx).replace(/[.。]\s*$/, "") })); break;
      case "SELF_DAMAGE": parts.push(tx("selfdmg", L, { n: o.n })); break;
      case "DETONATE": parts.push(tx(o.tgt === "all" ? "detoAll" : "deto", L, { m: o.m })); break;
      case "CONSUME": parts.push(o.m ? tx(o.tgt === "all" ? "consumeAll" : "consume", L, { s: SN(o.s, L), m: o.m }) : tx("consume0", L, { s: SN(o.s, L) })); break;
      case "POISON_BURST": parts.push(tx("pburst", L)); break;
      case "CLEANSE": parts.push(tx(o.tgt === "team" ? "cleanseTeam" : "cleanse", L)); break;
      case "COPY": parts.push(tx("copy", L)); break;
      case "TRANSFORM": parts.push(tx("transform", L, { n: o.n })); break;
      case "COST": parts.push(tx("cost", L, { n: o.n })); break;
      case "RECALL": parts.push(tx("recall", L, { n: o.n })); break;
      case "REWIND": parts.push(tx("rewind", L)); break;
      case "ADD_CARD": parts.push(o.id === "potion" ? tx("addPotion", L, { n: o.n || 1 }) : tx("addCard", L, { n: o.n || 1, c: CARD[o.id]?.n[L] || o.id })); break;
      case "SUMMON": { const k = { spirit: "smSpirit", turret: "smTurret", shield: "smShield", battery: "smBattery" }[o.k]; const x = tx(k, L, { v: N(o.v) }); parts.push((o.n || 1) > 1 ? tx("smTimes", L, { x, n: o.n }) : x); break; }
      case "TRIGGER_SUMMONS": parts.push(tx("trig", L)); break;
      case "BUFF_SUMMONS": parts.push(o.kind ? tx("buffSmK", L, { k: SMK[o.kind][L], n: o.n }) : tx("buffSm", L, { n: o.n })); break;
      case "CONSUME_SUMMONS": { const x = descOps(o.then, L, ctx).replace(/[.。]\s*$/, ""); parts.push(o.kind ? tx("consumeK", L, { k: SMK[o.kind][L], x }) : tx("consume", L, { x })); break; }
      case "CHANCE": { let x = tx("chance", L, { p: o.p, x: descOps(o.then, L, ctx).replace(/[.。]\s*$/, "") }); if (o.else?.length) x += tx("chanceElse", L, { x: descOps(o.else, L, ctx).replace(/[.。]\s*$/, "") }); parts.push(x); break; }
      case "ROLL": parts.push(tx("roll", L, { d: o.d, n: o.n || 1, x: descOps(o.then, L, ctx).replace(/[.。]\s*$/, "") })); break;
      case "RANDOM_OF": parts.push(tx("randOf", L, { x: o.list.map((x) => descOps(x, L, ctx).replace(/[.。]\s*$/, "")).join(tx("or", L)) })); break;
      case "DRAWBONUS": parts.push(tx("drawbonus", L, { n: o.n })); break;
      default: break;
    }
  }
  return parts.length ? parts.join(dot(L)) + (L === 1 ? "。" : ".") : "";
}
export function cardText(inst, L = 0, ctx = {}) {
  const d = CARD[inst.id]; if (!d) return "";
  if (d.unplay) return tx("unplay", L) + (d.id === "cu_doubt" ? dot(L) + tx("doubt", L) : "") + (L === 1 ? "。" : ".");
  let s = descOps(cardOps(inst), L, ctx);
  if (d.ex) s += (L === 1 ? "" : " ") + tx("ex", L) + (L === 1 ? "。" : ".");
  return s;
}
