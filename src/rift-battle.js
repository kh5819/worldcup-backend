// =========================
// 운명의 균열 — 덱 배틀 (1~50인 경쟁) 서버
// - 각자 자기 판(같은 시드 = 같은 지도)을 서버 규칙 엔진으로 진행. 클라는 행동만 보냄 (체력·카드·결과 조작 불가)
// - 라운드 5번: ① 준비(칸 2개를 지나며 덱 강화, 180초) → ② 결투(짝 상대 덱으로 만든 '그림자'와 싸움, 최대 10턴, 150초) → ③ 결과(10초)
//   결투 점수: 그림자를 쓰러뜨리면 1000 - 턴×40 + 남은 체력%, 못 쓰러뜨리면 준 피해%×6 → 짝끼리 점수 비교 (승 3점 · 무 1점)
//   짝은 점수 비슷한 사람끼리(같은 점수는 무작위). 홀수면 남는 한 명은 무작위 상대의 그림자와 싸우고 그 상대의 결투 점수와 비교
// - 시간이 지나면 남은 행동은 서버 봇이 대신 끝냄 (멈추지 않음) · 끊겨도 자리 유지, 다시 들어오면 이어서
// - AI 채우기: 방장이 AI 수를 정함 (혼자서도 가능) · AI는 서버 봇이 즉시 진행
// - 경쟁 모드 무한 콤보 제한: 한 턴 카드 30장 (엔진) · 결투는 10턴 끝
// =========================
import DATA from "./rift-data.js";
import * as R from "./rift-core.js";
import { botAction } from "./rift-bot.js";
R.setData(DATA);

const ROOMS = new Map();
const F = process.env.RIFT_FAST ? Number(process.env.RIFT_FAST) : 1;
export const B_ROUNDS = 5, B_QUOTA = 2, B_MAX = 50;
const BUILD_MS = 180000 * F, DUEL_MS = 150000 * F, RESULT_MS = 10000 * F, IDLE_DROP_MS = 15 * 60000, EMIT_GAP = 300;
const code5 = () => { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };
const clean = (s) => String(s || "").replace(/[<>\n\r\t]/g, "").trim().slice(0, 12);
const rnd = (n) => Math.floor(Math.random() * n);
const mkRng = (s) => { let a = s >>> 0 || 7; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const CHARS = () => Object.keys(DATA.CHARS);
const AI_NAMES = ["균열봇", "그림자봇", "운명봇", "톱니봇", "심연봇", "성채봇", "별빛봇", "번개봇"];

const pubRun = (run) => { if (!run) return null; const { log, ...rest } = run; return rest; };
function status(p) { const run = p.run; if (!run) return "lobby"; if (run.phase === "bwait") return "wait"; if (run.phase === "combat") return run.cb?.kind === "duel" ? "duel" : "fight"; return run.phase; }
function boardOf(r) {
  return { code: r.code, phase: r.phase, round: r.round, rounds: B_ROUNDS, deadline: r.deadline, host: r.players.findIndex((p) => p.uid === r.host),
    players: r.players.map((p) => ({ name: p.name, char: p.char, ai: !!p.ai, on: !!p.on || !!p.ai, ready: !!p.ready, pts: p.pts, sc: p.sc, st: status(p), hp: p.run?.players[0].hp ?? 0, maxHp: p.run?.players[0].maxHp ?? DATA.CHARS[p.char].hp, deck: p.run?.players[0].deck.length ?? 0, opp: p.opp, last: p.last || null })),
    final: r.final || null };
}
function sendBoard(io, r, now = false) {
  const go = () => { r.bt = null; const b = boardOf(r); for (const [sid, uid] of r.socks) io.to(sid).emit("rfb:room", { ...b, me: r.players.findIndex((p) => p.uid === uid) }); };
  if (now) { if (r.bt) { clearTimeout(r.bt); r.bt = null; } return go(); }
  if (!r.bt) r.bt = setTimeout(go, EMIT_GAP);
}
function sendState(io, r, p, ev = []) { if (!p.uid || !p.run) return; const run = pubRun(p.run); for (const [sid, uid] of r.socks) if (uid === p.uid) io.to(sid).emit("rfb:state", { code: r.code, run, ev }); }
// 봇이 대신 진행 (준비 단계 끝까지 또는 결투 끝까지)
function autoPlay(p) {
  const run = p.run; let n = 0;
  while (run.phase !== "bwait" && !run.over && n++ < 8000) { const a = botAction(run, 0, p.rng); if (!a) break; if (!R.act(run, 0, a).ok && !R.act(run, 0, { t: "end" }).ok) break; }
  if (run.phase !== "bwait") {   // 만약을 위한 안전장치: 절대 멈추지 않게
    if (run.cb?.kind === "duel" && !run.bt.res) run.bt.res = { kill: 0, dead: 0, turns: 0, dmgPct: 0, hpPct: 0, score: 0 };
    run.phase = "bwait"; run.room = { type: "bwait" }; run.cb = null;
  }
}
function startRound(io, r) {
  r.round++; r.phase = "build"; r.deadline = Date.now() + BUILD_MS;
  for (const p of r.players) { p.opp = null; R.battleRound(p.run, B_QUOTA); if (p.ai) autoPlay(p); }
  for (const p of r.players) sendState(io, r, p);
  sendBoard(io, r, true); checkPhase(io, r);
}
function startDuels(io, r) {
  r.phase = "duel"; r.deadline = Date.now() + DUEL_MS;
  for (const p of r.players) if (p.run.phase !== "bwait") autoPlay(p);
  // 짝: 점수 비슷한 사람끼리 (같은 점수 안에서는 무작위)
  const order = r.players.map((p, i) => ({ i, k: p.pts * 1000 + Math.random() })).sort((a, b) => b.k - a.k).map((x) => x.i);
  const ghosts = r.players.map((p) => R.ghostOf(p.run, p.name));
  r.pairs = []; for (let k = 0; k + 1 < order.length; k += 2) r.pairs.push([order[k], order[k + 1]]);
  r.bye = order.length % 2 ? order[order.length - 1] : null;
  for (const [a, b] of r.pairs) { r.players[a].opp = b; r.players[b].opp = a; }
  if (r.bye != null) { const others = order.filter((x) => x !== r.bye); r.players[r.bye].opp = others.length ? others[rnd(others.length)] : null; }
  for (const [i, p] of r.players.entries()) {
    const g = p.opp != null ? ghosts[p.opp] : R.ghostOf(p.run, p.name);   // (혼자 남은 경우 대비)
    const x = R.startDuel(p.run, g); if (p.ai) autoPlay(p); sendState(io, r, p, x.ev); void i;
  }
  sendBoard(io, r, true); checkPhase(io, r);
}
function resolve(io, r) {
  for (const p of r.players) if (p.run.phase !== "bwait" || !p.run.bt.res) autoPlay(p);
  const sc = (i) => r.players[i].run.bt.res?.score ?? 0;
  const give = (i, other, mine, theirs, byeRound = false) => {
    const p = r.players[i], res = mine > theirs ? "win" : mine < theirs ? "lose" : "draw";
    p.pts += res === "win" ? 3 : res === "draw" ? 1 : 0; p.sc += mine;
    p.last = { round: r.round, vs: other != null ? r.players[other].name : "", vsChar: other != null ? r.players[other].char : null, mine, theirs, res, kill: p.run.bt.res?.kill || 0, turns: p.run.bt.res?.turns || 0, bye: byeRound ? 1 : 0 };
  };
  for (const [a, b] of r.pairs) { give(a, b, sc(a), sc(b)); give(b, a, sc(b), sc(a)); }
  if (r.bye != null) { const o = r.players[r.bye].opp; give(r.bye, o, sc(r.bye), o != null ? sc(o) : 0, true); }
  r.phase = "result"; r.deadline = Date.now() + RESULT_MS; sendBoard(io, r, true);
}
async function finish(io, r) {
  r.phase = "end"; r.deadline = null;
  const st = r.players.map((p, i) => ({ i, name: p.name, char: p.char, ai: !!p.ai, pts: p.pts, sc: p.sc })).sort((a, b) => b.pts - a.pts || b.sc - a.sc);
  r.final = st.map((x, k) => ({ ...x, rank: k + 1 }));
  sendBoard(io, r, true);
  if (r.sb && !r.saved && r.players.some((p) => !p.ai)) {
    r.saved = true;
    try { await r.sb.from("rift_runs").insert({ mode: "battle", owner_key: r.players.filter((p) => !p.ai).map((p) => p.uid).join(",").slice(0, 2000), nickname: (r.final[0]?.name || "").slice(0, 60), chars: r.final.slice(0, 50).map((x) => x.char), diff: "normal", win: true, floor: B_ROUNDS, turns: 0, players: r.players.length, summary: { standings: r.final.slice(0, 50), humans: r.players.filter((p) => !p.ai).length }, created_at: new Date().toISOString() }); } catch {}
  }
}
// 모두 끝났으면 다음 단계로
function checkPhase(io, r) {
  if (r.phase === "build" && r.players.every((p) => p.run.phase === "bwait")) return startDuels(io, r);
  if (r.phase === "duel" && r.players.every((p) => p.run.phase === "bwait" && p.run.bt.res)) return resolve(io, r);
}
function onDeadline(io, r) {
  if (r.phase === "build") { for (const p of r.players) if (p.run.phase !== "bwait") { autoPlay(p); sendState(io, r, p); } return startDuels(io, r); }
  if (r.phase === "duel") { for (const p of r.players) if (p.run.phase !== "bwait") { autoPlay(p); sendState(io, r, p); } return resolve(io, r); }
  if (r.phase === "result") { if (r.round >= B_ROUNDS) return finish(io, r); return startRound(io, r); }
}
function setAi(r, n) {
  const humans = r.players.filter((p) => !p.ai); n = Math.max(0, Math.min(B_MAX - humans.length, n | 0));
  const ais = r.players.filter((p) => p.ai);
  while (ais.length > n) ais.pop();
  while (ais.length < n) { const k = ais.length; ais.push({ uid: null, ai: true, name: `${AI_NAMES[k % AI_NAMES.length]}${k >= AI_NAMES.length ? Math.floor(k / AI_NAMES.length) + 1 : ""}`, char: CHARS()[rnd(CHARS().length)], on: true, ready: true }); }
  r.players = [...humans, ...ais];
}

export function registerRiftBattle(io, supabaseAdmin) {
  setInterval(() => {
    const now = Date.now();
    for (const r of ROOMS.values()) {
      if (r.deadline && now > r.deadline && r.phase !== "lobby" && r.phase !== "end") { r.deadline = null; try { onDeadline(io, r); } catch (e) { console.error("[rfb] deadline", e); } }
      if (r.players.some((p) => !p.ai && p.on)) r.lastOn = now; else if (now - r.lastOn > IDLE_DROP_MS) ROOMS.delete(r.code);
    }
  }, F < 1 ? 50 : 1000).unref?.();

  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const uid = String(me.id);
    let win = Date.now(), cnt = 0;
    const limited = () => { const n = Date.now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > 150; };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => { const reply = typeof cb === "function" ? cb : () => {}; if (limited()) return reply({ ok: false, error: "RATE_LIMITED" }); try { await fn(p || {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); } });
    const room = (code) => { const r = ROOMS.get(String(code || "").toUpperCase()); return r && r.socks.has(socket.id) ? r : null; };
    const mine = (r) => r.players.find((p) => p.uid === uid) || null;
    const isHost = (r) => r.host === uid;

    on("rfb:create", (p, reply) => {
      for (const o of [...ROOMS.values()]) if (o.phase === "lobby" && o.host === uid && !o.players.some((x) => !x.ai && x.uid !== uid)) ROOMS.delete(o.code);   // 혼자 있는 내 대기실은 지움
      if (ROOMS.size >= 1000) return reply({ ok: false, error: "BUSY" });
      let code; do code = code5(); while (ROOMS.has(code));
      const r = { code, phase: "lobby", host: uid, round: 0, deadline: null, players: [{ uid, name: clean(p.name) || "모험가", char: "knight", on: true, ready: false, pts: 0, sc: 0 }], socks: new Map([[socket.id, uid]]), sb: supabaseAdmin, saved: false, lastOn: Date.now(), pairs: [], bye: null, final: null };
      ROOMS.set(code, r); reply({ ok: true, code, me: 0, board: { ...boardOf(r), me: 0 } }); sendBoard(io, r, true);   // 응답에도 방 정보 (이벤트 순서에 기대지 않게)
    });
    on("rfb:join", (p, reply) => {
      const r = ROOMS.get(String(p.code || "").toUpperCase()); if (!r) return reply({ ok: false, error: "NO_ROOM" });
      let pl = mine(r);
      if (!pl) {
        if (r.phase !== "lobby") return reply({ ok: false, error: "STARTED" });
        if (r.players.filter((x) => !x.ai).length >= B_MAX) return reply({ ok: false, error: "FULL" });
        pl = { uid, name: clean(p.name) || "모험가", char: CHARS()[rnd(CHARS().length)], on: true, ready: false, pts: 0, sc: 0 };
        const firstAi = r.players.findIndex((x) => x.ai); if (firstAi >= 0) r.players.splice(firstAi, 0, pl); else r.players.push(pl);
        if (r.players.length > B_MAX) { const k = r.players.map((x) => x.ai).lastIndexOf(true); if (k >= 0) r.players.splice(k, 1); }
      }
      pl.on = true; if (p.name && r.phase === "lobby") pl.name = clean(p.name) || pl.name;
      r.socks.set(socket.id, uid);
      reply({ ok: true, code: r.code, me: r.players.indexOf(pl), run: pubRun(pl.run), board: { ...boardOf(r), me: r.players.indexOf(pl) } }); sendBoard(io, r, true);
    });
    on("rfb:char", (p, reply) => { const r = room(p.code), pl = r && mine(r); if (!pl || r.phase !== "lobby" || !(typeof p.char === "string" && Object.hasOwn(DATA.CHARS, p.char))) return reply({ ok: false, error: "PHASE" }); pl.char = p.char; pl.ready = false; reply({ ok: true }); sendBoard(io, r); });
    on("rfb:ready", (p, reply) => { const r = room(p.code), pl = r && mine(r); if (!pl || r.phase !== "lobby") return reply({ ok: false, error: "PHASE" }); pl.ready = !!p.ready; reply({ ok: true }); sendBoard(io, r); });
    on("rfb:ai", (p, reply) => { const r = room(p.code); if (!r || !isHost(r) || r.phase !== "lobby") return reply({ ok: false, error: "NOT_HOST" }); setAi(r, p.n); reply({ ok: true }); sendBoard(io, r, true); });
    on("rfb:start", (p, reply) => {
      const r = room(p.code); if (!r || !isHost(r)) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "lobby") return reply({ ok: false, error: "STARTED" });
      if (r.players.length < 2) return reply({ ok: false, error: "NEED_2" });
      if (!r.players.every((x) => x.ai || x.ready || x.uid === uid || !x.on)) return reply({ ok: false, error: "NOT_READY" });
      r.players = r.players.filter((x) => x.ai || x.on);
      const seed = (Math.random() * 0xffffffff) >>> 0;
      r.players.forEach((x, i) => { x.run = R.newRun({ seed, chars: [x.char], names: [x.name], mode: "battle" }); x.rng = mkRng(seed + i * 7919); x.pts = 0; x.sc = 0; x.last = null; x.opp = null; });
      r.round = 0; r.final = null; r.saved = false; reply({ ok: true }); startRound(io, r);
    });
    on("rfb:act", (p, reply) => {
      const r = room(p.code), pl = r && mine(r); if (!pl || !pl.run) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.phase !== "build" && r.phase !== "duel") return reply({ ok: false, error: "PHASE" });
      const a = p.a && typeof p.a === "object" ? p.a : null; if (!a) return reply({ ok: false, error: "BAD_ACTION" });
      const res = R.act(pl.run, 0, a); if (!res.ok) return reply({ ok: false, error: res.err });
      reply({ ok: true }); sendState(io, r, pl, res.ev); sendBoard(io, r); checkPhase(io, r);
    });
    on("rfb:again", (p, reply) => { const r = room(p.code); if (!r || !isHost(r) || r.phase !== "end") return reply({ ok: false, error: "NOT_HOST" }); r.phase = "lobby"; r.round = 0; r.final = null; r.players.forEach((x) => { x.run = null; x.pts = 0; x.sc = 0; x.last = null; x.opp = null; if (!x.ai) x.ready = false; }); r.players = r.players.filter((x) => x.ai || x.on); reply({ ok: true }); sendBoard(io, r, true); });
    const leave = (r, hard) => {
      r.socks.delete(socket.id); if ([...r.socks.values()].includes(uid)) return;
      const pl = mine(r); if (!pl) return;
      if (r.phase === "lobby" && hard) r.players.splice(r.players.indexOf(pl), 1); else pl.on = false;
      if (r.host === uid) { const nh = r.players.find((x) => !x.ai && x.on); if (nh) r.host = nh.uid; }
      if (!r.players.some((x) => !x.ai && (x.on || r.phase !== "lobby"))) { ROOMS.delete(r.code); return; }
      sendBoard(io, r);
    };
    on("rfb:leave", (p, reply) => { const r = room(p.code); if (r) leave(r, true); reply({ ok: true }); });
    socket.on("disconnect", () => { for (const r of ROOMS.values()) if (r.socks.has(socket.id)) leave(r, false); });
  });
}
export const _rfbTest = { ROOMS, onDeadline };
