// 운명의 균열 규칙 엔진 시험: node scripts/test-rift-core.mjs
// 공용 파일 같은지 · 데이터 개수 · 카드 설명 3개 언어 · 봇으로 혼자·협동 수백 판 · 결정성(같은 시드+같은 행동=같은 결과) · 무한 루프 방지
import fs from "fs";
import DATA from "../src/rift-data.js"; import * as R from "../src/rift-core.js"; import { botAction, botTeam } from "../src/rift-bot.js";
R.setData(DATA);
let pass = 0, fail = 0; const fails = new Map(); const ok = (c, m) => { if (c) pass++; else { fail++; fails.set(m, (fails.get(m) || 0) + 1); } };
const rng = (s) => { let a = s >>> 0 || 7; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
// 1) 공용 파일
for (const f of ["rift-core.js", "rift-data.js", "rift-bot.js"]) { const fr = `../홈페이지 제작/js/rift/${f}`; if (fs.existsSync(fr)) ok(fs.readFileSync(fr, "utf8") === fs.readFileSync(`src/${f}`, "utf8"), `화면·서버 공용 파일 다름: ${f}`); }
// 2) 데이터
const cards = DATA.CARDS.filter((c) => c.t !== "cur" && c.r !== "special");   // 물약(임시 카드) 제외
const CH = Object.keys(DATA.CHARS); ok(CH.length === 6, `캐릭터 6종 (${CH.length})`);
ok(CH.every((c) => cards.filter((x) => x.c === c).length === 30), "캐릭터마다 전용 카드 30장"); ok(cards.filter((c) => c.c === "common").length >= 20, "공용 카드");
console.log(`  카드 ${cards.length}장 (캐릭터 ${CH.length} × 30 + 공용 ${cards.filter((c) => c.c === "common").length}) · 물약 ${DATA.CARDS.filter((c) => c.c === "potion").length}`);
for (const c of CH) { const ch = DATA.CHARS[c]; ok(ch.start.every((id) => DATA.CARDS.find((x) => x.id === id && x.c === c)), "시작 덱 카드 " + c); ok(DATA.RELICS.find((r) => r.id === ch.relic), "시작 유물 " + c); }
ok(new Set(DATA.CARDS.map((c) => c.id)).size === DATA.CARDS.length, "카드 ID 중복 없음");
ok(DATA.RELICS.length === 90, `유물 90종 (${DATA.RELICS.length})`); ok(cards.length === 240, `카드 240장 (${cards.length})`);

ok(DATA.RESON.length >= 30, `공명 30종 이상 (${DATA.RESON.length})`);
ok(DATA.EVENTS.filter((e) => !e.stream).length === 100, `이벤트 100 (${DATA.EVENTS.length})`); ok(DATA.ORDER.length === 4 && DATA.ORDER.every((r) => DATA.REGIONS[r]), "지역 4개");
const EN = Object.values(DATA.ENEMIES).filter((e) => !e.ghost); ok(EN.filter((e) => !e.elite && !e.boss && !e.minion).length === 42 && EN.filter((e) => e.elite).length === 10 && EN.filter((e) => e.boss).length === 8, "적: 일반 42·엘리트 10·보스 8");
for (const r of DATA.ORDER) { const G = DATA.REGIONS[r]; for (const id of [...G.easy, ...G.normal, ...G.elites].flat().concat(G.bosses)) ok(DATA.ENEMIES[id], "지역 적 " + r + ":" + id); }
ok(Object.keys(DATA.ENGRAVE).length === 8, "각인 8종");
ok(cards.filter((c) => c.evo).length >= 1, "진화 경로 있는 카드");
// 3) 설명 (3개 언어, 빈 설명·치환 안 된 {x} 없음)
for (const c of DATA.CARDS) for (const L of [0, 1, 2]) for (const up of [0, 1]) {
  const inst = { id: c.id, up, evo: null }; const t = R.cardText(inst, L); ok(t.length > 2, `설명 비어 있음 ${c.id} L${L}`); ok(!/\{\w+\}/.test(t) && !/undefined|NaN/.test(t), `설명 치환 실패 ${c.id} L${L}: ${t}`);
  ok(c.n[L] && c.n[L].length, `이름 없음 ${c.id} L${L}`);
  if (c.evo) for (const k of Object.keys(c.evo)) { const t2 = R.cardText({ id: c.id, evo: k }, L); ok(t2.length > 2 && !/\{\w+\}|undefined/.test(t2), `진화 설명 ${c.id}.${k}`); }
}
for (const r of DATA.RELICS) for (const L of [0, 1, 2]) ok(r.n[L] && r.d[L], `유물 글 ${r.id}`);
for (const e of DATA.EVENTS) for (const L of [0, 1, 2]) { ok(e.n[L] && e.d[L], `이벤트 글 ${e.id}`); for (const o of e.opts) ok(o.t[L], `이벤트 선택지 ${e.id}`); }
for (const e of EN) for (const L of [0, 1, 2]) ok(e.n[L], "적 이름");
// 유물 90종: 하나씩 넣고 실제 판에서 발동하는지 (발동 시점이 있는 유물은 사건이 나와야 함)
{ const fired = new Set(), CH2 = Object.keys(DATA.CHARS);
  for (const [k, r] of DATA.RELICS.entries()) {
    const run = R.newRun({ seed: 700 + k, chars: [CH2[k % CH2.length]], mode: "solo" }), p = run.players[0], mh = p.maxHp, gold = p.gold, deckN = p.deck.length;
    try { R.giveRelic(run, p, r.id); } catch (e) { ok(false, "유물 얻기 오류 " + r.id + " " + e.message); continue; }
    if (r.onPick?.maxhp) ok(p.maxHp === Math.max(1, mh + r.onPick.maxhp), "얻을 때 최대 체력 " + r.id);
    if (r.onPick?.gold) ok(p.gold === gold + r.onPick.gold, "얻을 때 골드 " + r.id);
    if (r.onPick?.card || r.onPick?.curse) ok(p.deck.length === deckN + 1, "얻을 때 카드 " + r.id);
    const rr = rng(k + 3); let n = 0, combats = 0;
    while (!run.over && n++ < 3000 && combats < 4) { const a = botAction(run, 0, rr); if (!a) break; const x = R.act(run, 0, a); if (!x.ok) R.act(run, 0, { t: "end" }); for (const e of x.ev) { if (e.k === "relic") fired.add(e.id); if (e.k === "victory") combats++; } }
  }
  const timed = DATA.RELICS.filter((r) => ["combatStart", "turnStart", "turnEnd", "combatEnd"].includes(r.hook));
  const miss = timed.filter((r) => !fired.has(r.id)).map((r) => r.id); ok(!miss.length, "발동 안 한 유물: " + miss.join(","));
  console.log(`  유물 ${DATA.RELICS.length}종 · 실제 발동 확인 ${fired.size}종 (시점 유물 ${timed.length}종 전부 ${miss.length ? "아님" : "발동"})`); }
// 모든 카드(+강화·진화)를 직접 한 번씩 써 보기: 오류 없이 쓰이고 상태가 정상 범위
{ let n = 0; const CH3 = Object.keys(DATA.CHARS);
  for (const d of DATA.CARDS.filter((c) => !c.unplay)) for (const v of [{ up: 0 }, { up: 1 }, ...Object.keys(d.evo || {}).map((e) => ({ evo: e }))]) {
    const run = R.newRun({ seed: 900 + n, chars: [CH3.includes(d.c) ? d.c : "knight", "chrono"], mode: "coop" }); const first = Object.values(run.map.nodes).find((x) => x.r === 0); first.type = "F";
    R.act(run, -1, { t: "path", node: first.id }); const cp = run.cb.ps[0]; cp.energy = 9; cp.hand = [{ u: 99999, id: d.id, up: v.up || 0, evo: v.evo || null }]; cp.sm.push({ k: "spirit", v: 2 }); cp.res.sand = 5; cp.res.luck = 3; run.cb.en[0].st.poison = 3;
    const x = R.act(run, 0, { t: "play", u: 99999, tgt: d.tgt === "enemy" ? 0 : d.tgt === "ally" ? 1 : null });
    ok(x.ok, `카드 쓰기 실패 ${d.id} ${JSON.stringify(v)} ${x.err}`); ok(run.players.every((p) => p.hp >= 0 && p.hp <= p.maxHp) && cp.energy >= 0, "카드 뒤 상태 " + d.id); n++; }
  console.log(`  카드 직접 사용 ${n}번 (강화·진화 포함)`); }
// 4) 봇 플레이
const used = new Set(), resoSeen = new Set(); let wins = 0, games = 0, limits = 0, maxOps = 0, floors = 0, coopWins = 0;
function playOut(run, r, maxSteps = 30000) {
  let steps = 0;
  while (!run.over && steps++ < maxSteps) {
    let did = false;
    if (run.mode === "coop") { const ta = botTeam(run, r); if (ta) { const x = R.act(run, -1, ta); ok(x.ok, `팀 행동 실패 ${x.err} ${run.phase}`); did = true; collect(x); continue; } }
    for (const p of run.players) { const a = botAction(run, p.i, r); if (!a) continue; const x = R.act(run, p.i, a); if (!x.ok) { ok(false, `봇 행동 실패 ${a.t}:${x.err}`); const e2 = R.act(run, p.i, { t: "end" }); if (!e2.ok && run.phase === "combat") R.act(run, p.i, { t: "leave" }); } collect(x); did = true; if (run.over) break; }
    if (!did) { ok(false, `진행 막힘 ${run.phase}`); break; }
  }
  return steps;
}
function collect(x) { for (const e of x.ev) { if (e.k === "play") used.add(e.id); if (e.k === "reso") resoSeen.add(e.r); if (e.k === "limit") limits++; } }
const T0 = Date.now();
for (let g = 0; g < 600; g++) {
  const char = CH[g % CH.length], diff = ["normal", "hard", "night"][g % 3];
  const r = rng(g + 11), run = R.newRun({ seed: g * 7919 + 3, chars: [char], diff });
  // 다양한 카드가 나오게: 덱에 무작위 카드 섞기 (시험 전용)
  if (g % 4 === 0) { const pool = DATA.CARDS.filter((c) => c.t !== "cur" && (c.c === char || c.c === "common")); for (let k = 0; k < 8; k++) run.players[0].deck.push({ u: run.nuid++, id: pool[Math.floor(r() * pool.length)].id, up: r() < 0.3 ? 1 : 0, evo: null, eng: r() < 0.3 ? Object.keys(DATA.ENGRAVE)[Math.floor(r() * 8)] : null }); for (const c of run.players[0].deck) if (c.eng && !R.engOk({ ...c, eng: null }, c.eng)) c.eng = null; }
  playOut(run, r); games++; if (run.over?.win) wins++; floors += run.floor + 1; (globalThis.__reg ||= {})[run.ri + 1] = ((globalThis.__reg ||= {})[run.ri + 1] || 0) + 1;
  ok(!!run.over, `판이 안 끝남 g${g} ${run.phase}`); if (!run.over && !globalThis.__dbg) { globalThis.__dbg = 1; const cp = run.cb?.ps[0]; console.log("DBG", g, run.phase, run.floor, run.cb?.turn, JSON.stringify(run.cb?.en.map((e) => [e.id, e.hp, e.block, e.st])), "hp", run.players[0].hp, "ready", cp?.ready, "hand", JSON.stringify(cp?.hand.map((c) => [c.id, R.costOf(cp, c), c.eng])), "en", cp?.energy, "log", run.log.length); }
  ok(run.players.every((p) => p.hp >= 0 && p.hp <= p.maxHp && p.gold >= 0), "체력·골드 범위");
  // 결정성: 기록으로 다시 돌리면 똑같아야 함 (시험용 덱 섞기 판은 제외)
  if (g % 4 !== 0 && g % 3 === 1) { const rp = R.replay({ seed: run.seed, chars: [char], diff }, run.log); ok(rp.ok, `다시 돌리기 실패 ${rp.err}`); ok(rp.ok && JSON.stringify(R.summary(rp.run)) === JSON.stringify(R.summary(run)), `다시 돌리면 결과 다름 g${g}`); }
}
// 협동 2~4인
for (let g = 0; g < 60; g++) {
  const n = 2 + (g % 3), chars = Array.from({ length: n }, (_, i) => CH[(i + g) % CH.length]);
  const r = rng(g + 999), run = R.newRun({ seed: g * 31 + 5, chars, mode: "coop" });
  ok(run.hpMult > 1 && run.dmgMult > 1, "협동 적 강화");
  playOut(run, r, 40000); if (run.over?.win) coopWins++;
  ok(!!run.over, `협동 판이 안 끝남 ${run.phase}`);
  const rp = R.replay({ seed: run.seed, chars, mode: "coop" }, run.log); ok(rp.ok && JSON.stringify(R.summary(rp.run)) === JSON.stringify(R.summary(run)), "협동 다시 돌리기 같음");
}
// 5) 잘못된 행동은 거절, 상태 안 바뀜
{ const run = R.newRun({ seed: 5, chars: ["knight"] }); const before = JSON.stringify(run);
  for (const a of [null, {}, { t: "play", u: 999 }, { t: "path", node: "9-9" }, { t: "buy", kind: "card", idx: 0 }, { t: "reward", pick: 0 }, { t: "end" }, { t: "rest", kind: "heal" }]) { const x = R.act(run, 0, a); ok(!x.ok, `거절해야 함 ${JSON.stringify(a)}`); }
  ok(JSON.stringify(run) === before, "거절된 행동은 상태를 안 바꿈");
  const x = R.act(run, 0, { t: "path", node: R.nextNodes(run)[0] }); ok(x.ok && run.phase === "combat", "첫 칸 전투");
  const cp = run.cb.ps[0]; cp.energy = 0; const c = cp.hand.find((h) => R.costOf(cp, h) > 0); if (c) ok(!R.act(run, 0, { t: "play", u: c.u, tgt: 0 }).ok, "에너지 부족이면 못 씀");
  ok(!R.act(run, 1, { t: "end" }).ok, "없는 플레이어 거절"); }
// 6) 공명 직접 확인: 빙결 → 번개 = 과부하
{ const run = R.newRun({ seed: 77, chars: ["chrono"] }); R.act(run, 0, { t: "path", node: R.nextNodes(run)[0] }); const cp = run.cb.ps[0]; cp.energy = 9;
  cp.hand = [{ u: 9001, id: "c_frost", up: 0 }, { u: 9002, id: "x_bolt", up: 0 }]; const e0 = run.cb.en.reduce((s, e) => s + e.hp, 0);
  R.act(run, 0, { t: "play", u: 9001, tgt: 0 }); const x = R.act(run, 0, { t: "play", u: 9002 }); ok(x.ev.some((e) => e.k === "reso" && DATA.RESON[e.r].a === "ice" && DATA.RESON[e.r].b === "bolt"), "빙결→번개 공명 발동"); }
// 7) 무한 루프 방지: 되감기만 손에 잔뜩
{ const run = R.newRun({ seed: 3, chars: ["chrono"] }); R.act(run, 0, { t: "path", node: R.nextNodes(run)[0] }); const cp = run.cb.ps[0]; cp.energy = 99; cp.hand = Array.from({ length: 10 }, (_, k) => ({ u: 8000 + k, id: "c_rewind", up: 1 })); let n = 0; for (const c of [...cp.hand]) { const t0 = Date.now(); R.act(run, 0, { t: "play", u: c.u }); n += Date.now() - t0; } ok(n < 500, "되감기 연속도 빨리 끝남"); }
// 8) 스트리머 모드 개입
{ const run = R.newRun({ seed: 91, chars: ["knight"] });
  ok(R.streamApply(run, "enc", { ids: ["cultist", "cultist"] }).ok, "다음 적 지정"); ok(R.streamApply(run, "bless", { id: "b_block" }).ok && R.streamApply(run, "curse", { id: "c_rage" }).ok, "축복·저주 쌓기");
  ok(R.streamApply(run, "nick", { nick: "후원자왕" }).ok, "닉네임 몬스터 쌓기"); ok(!R.streamApply(run, "bless", { id: "없음" }).ok, "없는 축복 거절");
  const first = Object.values(run.map.nodes).find((n) => n.r === 0); first.type = "F";
  const x = R.act(run, 0, { t: "path", node: first.id }); const en = run.cb.en;
  ok(en.filter((e) => e.id === "cultist").length === 2, "지정한 적이 나옴"); ok(en.some((e) => e.nick === "후원자왕"), "닉네임 몬스터 합류");
  ok(run.cb.ps[0].block >= 14, "축복 방어도 적용"); ok(en.filter((e) => !e.nick).every((e) => (e.st.str || 0) >= 2), "저주: 적 힘 +2");
  ok(x.ev.some((e) => e.k === "bless") && x.ev.some((e) => e.k === "curse"), "연출 사건");
  const y = R.streamApply(run, "curse", { id: "c_poison" }); ok(y.ok && run.cb.ps[0].st.poison === 4, "전투 중 저주는 바로 적용");
  const run2 = R.newRun({ seed: 92, chars: ["chrono"] }); R.streamApply(run2, "event", { id: "spring" }); const ev1 = Object.values(run2.map.nodes).find((n) => n.r === 0); ev1.type = "?"; R.act(run2, 0, { t: "path", node: ev1.id }); ok(run2.room?.ev === "spring", "지정한 이벤트가 나옴");
  R.act(run2, 0, { t: "event", opt: 0 }); R.act(run2, 0, { t: "leave" }); ok(run2.phase === "map", "이벤트 뒤 지도");
  const g = R.streamApply(run2, "gift", { nick: "선물러" }); ok(g.ok && run2.phase === "event" && run2.room.ev === "sv_gift", "후원 특별 이벤트 바로 열림");
  { const mh = run2.players[0].maxHp; ok(R.act(run2, 0, { t: "event", opt: 1 }).ok && run2.players[0].maxHp === mh + 8, "특별 이벤트 선택 적용"); }
  const run3 = R.newRun({ seed: 93, chars: ["knight"] }); R.streamApply(run3, "boss", { id: "bb_hp" }); R.streamApply(run3, "boss", { id: "bb_str" }); run3.at = Object.values(run3.map.nodes).find((n) => n.r === run3.map.rows - 1).id; run3.phase = "map";
  R.act(run3, 0, { t: "path", node: "boss" }); const b = run3.cb.en.find((e) => DATA.ENEMIES[e.id].boss); ok(b.maxHp >= Math.round(DATA.ENEMIES[b.id].hp[0] * (DATA.REGIONS[run3.region].hpMul || 1) * 1.25) - 1 && b.st.str >= 3, "보스 강화 적용");
  for (const e of [...DATA.BLESS, ...DATA.CURSES, ...DATA.BOSSBUFF]) for (const L of [0, 1, 2]) ok(e.n[L], "방송 효과 글 " + e.id); }
// ---------- 일일 도전 · 덱 배틀 ----------
{
  const days = ["2026-11-26", "2026-11-27", "2027-01-01", "2027-02-28"];
  for (const day of days) {
    const di = R.dailyInfo(day); ok(DATA.CHARS[di.char] && di.mods.length === 2 && di.mods[0] !== di.mods[1] && di.mods.every((m) => DATA.DAILY_MODS[m]), "일일 정보 " + day);
    ok(JSON.stringify(R.dailyInfo(day)) === JSON.stringify(di), "일일 정보 항상 같음 " + day);
    const run = R.newRun({ seed: 123, chars: ["knight"], daily: day }); ok(run.players[0].char === di.char && run.seed === di.seed && run.daily === day, "일일: 날짜가 시드·캐릭터 정함 " + day);
    const r = rng(day.length + 7); let n = 0; while (!run.over && n++ < 30000) { const a = botAction(run, 0, r); if (!a) break; if (!R.act(run, 0, a).ok) R.act(run, 0, { t: "end" }); }
    const rp = R.replay({ daily: day }, run.log); ok(rp.ok && rp.run.over && R.summary(rp.run).score === R.summary(run).score && typeof R.summary(run).score === "number", "일일: 다시 돌리면 같은 점수 " + day);
  }
  for (const m of Object.keys(DATA.DAILY_MODS)) ok(DATA.DAILY_MODS[m].n.length === 3 && DATA.DAILY_MODS[m].d.length === 3, "일일 규칙 글 3개 언어 " + m);
  let duels = 0, done = 0, limitHit = 0;
  for (let g = 0; g < 30; g++) {
    const chars = Object.keys(DATA.CHARS), runs = chars.map((c) => R.newRun({ seed: 77 + g, chars: [c], mode: "battle" })), rs = runs.map((_, i) => rng(g * 31 + i));
    ok(runs.every((x) => x.phase === "bwait" && x.diff === "normal"), "배틀 판은 기다림에서 시작");
    ok(new Set(runs.map((x) => JSON.stringify(Object.keys(x.map.nodes).sort()))).size === 1, "배틀: 모두 같은 지도");
    for (let round = 1; round <= 5; round++) {
      runs.forEach((run, i) => { ok(R.battleRound(run, 2), "라운드 시작"); let n = 0; while (run.phase !== "bwait" && n++ < 5000) { const a = botAction(run, 0, rs[i]); if (!a) break; const x = R.act(run, 0, a); if (!x.ok) { if (x.err === "TURN_LIMIT") limitHit++; R.act(run, 0, { t: "end" }); } } ok(run.phase === "bwait" && run.bt.done === 2 && !run.over, "준비: 칸 2개 지나면 기다림 (쓰러져도 안 끝남)"); });
      const gh = runs.map((run, i) => R.ghostOf(run, "P" + i));
      ok(gh.every((x) => x.deck.length > 0 && x.hp >= 20 && x.deck.every((c) => DATA.CARDS.some((d) => d.id === c.id))), "그림자 = 상대 덱 요약");
      runs.forEach((run, i) => {
        const hp0 = run.players[0].hp, x = R.startDuel(run, gh[(i + 1) % runs.length]);
        ok(x.ok && run.cb.kind === "duel" && run.cb.en[0].gname === "P" + ((i + 1) % runs.length), "결투 시작"); ok(!R.startDuel(run, gh[0]).ok, "결투 중엔 또 못 함"); ok(!R.battleRound(run, 2), "결투 중엔 라운드 못 시작");
        let n = 0; while (run.phase !== "bwait" && n++ < 5000) { const a = botAction(run, 0, rs[i]); if (!a) break; if (!R.act(run, 0, a).ok) R.act(run, 0, { t: "end" }); }
        duels++; const res = run.bt.res; ok(res && typeof res.score === "number" && res.turns <= R.DUEL_TURNS, "결투 결과 · 최대 턴 지킴"); ok(run.players[0].hp === hp0 && run.players[0].alive, "결투가 끝나면 체력 원래대로"); if (res) done++;
      });
    }
    ok(runs.every((x) => x.bt.hist.length === 5), "결투 기록 5번");
  }
  ok(duels === done, "결투 모두 끝남");
  console.log(`  덱 배틀 결투 ${duels}번 · 일일 도전 날짜 ${days.length}개 다시 돌리기 확인 · 한 턴 카드 제한 걸림 ${limitHit}`);
}
console.log(`\n통과 ${pass} · 실패 ${fail} (${((Date.now() - T0) / 1000).toFixed(1)}초)`); for (const [m, n] of fails) console.log("  ✗", m, n > 1 ? `(${n}회)` : "");
console.log(`  지역 도달: ${JSON.stringify(globalThis.__reg || {})}`); console.log(`혼자 ${games}판: 클리어 ${wins} (${Math.round((wins / games) * 100)}%) · 평균 도달 층 ${(floors / games).toFixed(1)} · 협동 60판 클리어 ${coopWins}`);
console.log(`쓰인 카드 ${used.size}/${cards.length} · 발동한 공명 ${resoSeen.size}/${DATA.RESON.length} · 효과 상한 도달 ${limits}`);
const unused = cards.filter((c) => !used.has(c.id)).map((c) => c.id); if (unused.length) console.log("  안 쓰인 카드:", unused.join(", "));
process.exit(fail ? 1 : 0);
