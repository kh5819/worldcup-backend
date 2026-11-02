// =========================
// 플듀 심리전 — 2~8인 실시간 대결 (mm:* 소켓)
// 서버 권위: 시나리오·비밀 패·타이머·채점 전부 서버. Socket.IO 방으로 격리.
// 게임 두 종류
//  group  = 사람끼리 직접(동시 제출→잠금→마감 후 공개): 배신의 계약·다수의 함정·블러핑 대결·비밀 경매
//  parallel = 모두 같은 시드·같은 난이도의 AI 상대·시나리오를 각자 동시에 (진행 중 남의 답·정오답 안 보임)
// 흐름: lobby → [intro → play → result] × N → final
// 개인 화면·비밀 정보는 mm:you로 본인 소켓에만, 방 전체에는 제출 여부·점수판만
// =========================
import * as C from "./mind-core.js";
import * as G from "./mind-games.js";
import { memberProfile, sanitizeProfile, sanitizePrefs, resultId } from "./iq.js";
import { buildRow, publicRow, insertResults } from "./mind.js";

const ROOMS = new Map(), CODES = new Map(), USER_ROOM = new Map();
const MAX_PLAYERS = 8, MAX_SPECS = 50;
const fast = (ms) => { const f = process.env.MIND_FAST; return f ? Math.max(30, ms * (f === "1" ? 0.02 : Number(f))) : ms; };
const INTRO_MS = 7000, RESULT_MS = 7000, GRACE_MS = 1500;
const LOBBY_DROP_MS = 20000, EMPTY_TTL_MS = 90000;
const CAP_SEC = { liar: 130, bluff: 170, predict: 130, rps: 110, auction: 110, contract: 100, suspect: 160, nego: 170, trap: 70, maze: 110, fake: 170, final: 90 };
const JOIN_FAIL_MAX = 8, JOIN_FAIL_WIN = 60000, JOIN_BLOCK_MS = 60000, IP_WIN = 600000, IP_MAX = 15;
const joinFails = new Map(), ipMakes = new Map();
const now = () => Date.now();
const sockRoom = (id) => `mm:${id}`;
const newSeed = () => (Math.floor(Math.random() * 0xffffffff) >>> 0) || 11;
function genCode() { for (let i = 0; i < 60; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!CODES.has(c)) return c; } return String(now()).slice(-7); }
function sockIp(s) { const h = s.handshake?.headers || {}; const cf = String(h["cf-connecting-ip"] || "").trim(); if (cf) return cf; const x = String(h["x-forwarded-for"] || "").split(",")[0].trim(); return x || String(s.handshake?.address || ""); }
const isGroup = (g) => !!C.GAMES[g].group;

function pubPlayer(r, uid) {
  const p = r.players.get(uid); if (!p) return null;
  return {
    id: uid, nick: p.profile?.nick || p.name, avatar: p.profile?.avatar || null, avatarUrl: p.avatarUrl || null, age: p.prefs?.shareMulti ? p.profile?.age || null : null,
    hasProfile: !!p.profile, isGuest: p.isGuest, device: p.device, connected: p.connected, ready: p.ready, host: r.host === uid, pts: Math.round(p.pts * 10) / 10, streak: p.streak || 0,
    status: r.phase === "play" ? (p.finished || p.locked ? "done" : "playing") : null, // 답·정오답은 안 알려 줌
  };
}
function pubRoom(r) {
  return {
    id: r.id, code: r.isPublic ? r.code : r.code, isPublic: r.isPublic, host: r.host, maxPlayers: r.maxPlayers, lv: r.lv, rounds: r.mode, plan: (r.plan || C.MULTI_PLANS[r.mode]).map((g) => ({ g, name: C.GAMES[g].name, group: !!C.GAMES[g].group })),
    phase: r.phase, round: r.round, g: r.round >= 0 ? r.plan?.[r.round] : null, phaseEnd: r.phaseEnd, tickEnd: r.tickEnd, tick: r.tick || 0, gameResult: r.phase === "result" || r.phase === "final" ? r.lastGame : null,
    lastTick: r.phase === "play" ? r.lastTick || null : null,
    final: r.phase === "final" && r.final ? { groupId: r.final.groupId, report: r.final.report, players: r.final.players, saved: r.final.saved } : null,
    players: r.order.map((u) => pubPlayer(r, u)).filter(Boolean), specs: r.specs.size, serverNow: now(),
  };
}
const emitRoom = (io, r) => io.to(sockRoom(r.id)).emit("mm:room", pubRoom(r));
function clearT(r) { if (r.timer) { clearTimeout(r.timer); r.timer = null; } }
function schedule(io, r, at, fn) { clearT(r); r.timer = setTimeout(() => { r.timer = null; try { fn(); } catch (e) { console.error("[mm] timer", e); } }, Math.max(0, at - now())); }
function deleteRoom(io, r, reason) {
  clearT(r); if (r.emptyTimer) clearTimeout(r.emptyTimer);
  ROOMS.delete(r.id); CODES.delete(r.code);
  for (const u of r.order) if (USER_ROOM.get(u) === r.id) USER_ROOM.delete(u);
  for (const u of r.specs) if (USER_ROOM.get(u) === r.id) USER_ROOM.delete(u);
  io.to(sockRoom(r.id)).emit("mm:closed", { reason }); io.in(sockRoom(r.id)).socketsLeave(sockRoom(r.id));
}
function checkEmpty(io, r) {
  const any = [...r.players.values()].some((p) => p.connected);
  if (any) { if (r.emptyTimer) { clearTimeout(r.emptyTimer); r.emptyTimer = null; } return; }
  if (!r.emptyTimer) r.emptyTimer = setTimeout(() => { if (ROOMS.get(r.id) && ![...r.players.values()].some((p) => p.connected)) deleteRoom(io, r, "EMPTY"); }, EMPTY_TTL_MS);
}
const pickHost = (r) => { if (r.players.get(r.host)?.connected) return; const next = r.order.find((u) => r.players.get(u)?.connected); if (next) r.host = next; };
function removePlayer(io, r, uid) {
  r.players.delete(uid); r.order = r.order.filter((u) => u !== uid); r.specs.delete(uid);
  if (USER_ROOM.get(uid) === r.id) USER_ROOM.delete(uid);
  if (!r.order.length) return deleteRoom(io, r, "EMPTY");
  if (r.host === uid) r.host = r.order.find((u) => r.players.get(u)?.connected) || r.order[0];
  if (r.groupSt && r.groupSt.ids.includes(uid)) { r.groupSt.gone ||= new Set(); r.groupSt.gone.add(uid); }
  if (r.phase === "play") maybeAdvance(io, r);
  emitRoom(io, r);
}
const newPlayer = (name, isGuest, socketId, dev) => ({ name: String(name || "참가자").slice(0, 12), isGuest, socketId, connected: true, ready: false, device: dev, profile: null, prefs: {}, avatarUrl: null, pts: 0, games: {}, streak: 0, finished: false, locked: false, act: null, g: null, seen: new Set() });
const sendYou = (io, p, payload) => { if (p.connected && p.socketId) io.to(p.socketId).emit("mm:you", payload); };

function personal(r, u) {
  const p = r.players.get(u); if (!p || r.phase !== "play") return { idle: true, round: r.round, phase: r.phase };
  if (isGroup(r.plan[r.round])) return { round: r.round, tick: r.tick, group: true, view: r.groupSt?.done ? null : G.groupView(r.groupSt, u), locked: p.locked, lockedAction: p.act, tickEnd: r.tickEnd, row: r.lastPersonal?.[u] || null };
  return { round: r.round, group: false, view: p.g && !p.g.done ? G.viewOf(p.g) : null, seq: p.g ? p.g.acts : 0, finished: p.finished, gameEnd: r.gameEnd, stepAt: p.stepAt };
}
function startGame(io, r, i) {
  r.round = i; r.phase = "intro"; r.lastGame = null; r.lastTick = null; r.lastPersonal = null;
  const g = r.plan[i]; r.gameSeed = (r.seed + i * 104729) >>> 0;
  for (const p of r.players.values()) { p.finished = false; p.locked = false; p.act = null; p.g = null; }
  r.phaseEnd = now() + fast(INTRO_MS); r.groupSt = null;
  emitRoom(io, r);
  schedule(io, r, r.phaseEnd, () => {
    r.phase = "play"; r.tick = 0;
    if (isGroup(g)) { r.groupSt = G.createGroup(g, r.gameSeed, r.order); startTick(io, r); }
    else {
      r.gameEnd = now() + fast(CAP_SEC[g] * 1000);
      for (const u of r.order) { const p = r.players.get(u); p.g = G.createGame(g, { seed: r.gameSeed, lv: r.lv, mp: true }); p.stepAt = now(); sendYou(io, p, personal(r, u)); }
      emitRoom(io, r);
      schedule(io, r, r.gameEnd + GRACE_MS, () => endParallel(io, r));
    }
  });
}
// ---------- 사람끼리 게임: 틱마다 전원 제출 또는 마감 → 동시 공개 ----------
function startTick(io, r) {
  const st = r.groupSt, g = st.g;
  const lim = G.GROUP[g].view(st, st.ids[0]).lim || 15;
  r.tickEnd = now() + fast(lim * 1000); r.tick = (r.tick || 0) + 1;
  for (const p of r.players.values()) { p.locked = false; p.act = null; }
  emitRoom(io, r);
  for (const u of r.order) sendYou(io, r.players.get(u), personal(r, u));
  schedule(io, r, r.tickEnd + GRACE_MS, () => resolveTick(io, r));
}
function resolveTick(io, r) {
  if (r.phase !== "play" || !r.groupSt) return;
  const st = r.groupSt, acts = {};
  for (const u of st.ids) { const p = r.players.get(u); acts[u] = p?.act || {}; }
  const row = G.GROUP[st.g].tick(st, acts);
  // 공개: 모두 제출·마감 뒤에만 (게임별로 공개 범위 제한 — 블러핑 대결 선언 단계는 선언만, 카드는 판정 뒤)
  r.lastPersonal = {};
  r.lastTick = pubTick(st.g, row, r);
  emitRoom(io, r);
  if (st.done) return schedule(io, r, now() + fast(3000), () => endGroup(io, r));
  schedule(io, r, now() + fast(st.g === "mduel" && row.phase === "claim" ? 800 : 3500), () => startTick(io, r));
}
function pubTick(g, row, r) {
  const nick = (u) => r.players.get(u)?.profile?.nick || r.players.get(u)?.name || "?";
  if (g === "mcontract") return { g, moves: r.order.map((u) => ({ id: u, nick: nick(u), m: row.moves[u], gain: row.gains[u] })), d: row.d, c: row.c, over: row.over };
  if (g === "mtrap") return { g, q: row.q, options: row.options, cnt: row.cnt, winners: row.winners, rows: r.order.map((u) => ({ id: u, nick: nick(u), pick: row.picks[u], gain: row.gains[u] })) };
  if (g === "mauction") return { g, lot: row.lot, bids: r.order.map((u) => ({ id: u, nick: nick(u), bid: row.bids[u] })), winner: row.winner ? nick(row.winner) : null, gain: row.gain, tie: row.tie };
  if (g === "mduel") { if (row.phase === "claim") return { g, phase: "claim" }; return { g, phase: "judge", rows: r.order.map((u) => ({ id: u, nick: nick(u), card: row.cards[u], claim: row.claims[u], gain: row.gains[u], lied: (row.cards[u] >= 6 ? "high" : "low") !== row.claims[u], right: row.rows[u].right })) }; }
  return { g };
}
function endGroup(io, r) { const st = r.groupSt; const res = {}; for (const u of st.ids) res[u] = G.groupResult(st, u); for (const u of st.ids) res[u].lv = r.lv; finishGame(io, r, res); }
// ---------- 같은 시나리오 게임 ----------
function maybeAdvance(io, r) {
  if (r.phase !== "play") return;
  const g = r.plan[r.round];
  if (isGroup(g)) { const wait = r.order.some((u) => { const p = r.players.get(u); return p.connected && !p.locked; }); if (!wait) { clearT(r); resolveTick(io, r); } }
  else { const wait = r.order.some((u) => { const p = r.players.get(u); return p.connected && !p.finished; }); if (!wait) { clearT(r); endParallel(io, r); } }
}
function endParallel(io, r) {
  if (r.phase !== "play") return;
  const res = {};
  for (const u of r.order) {
    const p = r.players.get(u);
    if (!p.g) p.g = G.createGame(r.plan[r.round], { seed: r.gameSeed, lv: r.lv, mp: true });
    let guard = 0; while (!p.g.done && guard++ < 300) { const x = G.applyAction(p.g, null); if (x.error) break; }
    if (!p.g.done) p.g.done = true;
    res[u] = G.resultOf(p.g);
  }
  finishGame(io, r, res);
}
function rankMap(r) { const arr = r.order.map((u) => ({ u, pts: r.players.get(u).pts })).sort((a, b) => b.pts - a.pts); const m = {}; let rank = 0, prev = null; arr.forEach((x, k) => { if (x.pts !== prev) rank = k + 1; m[x.u] = rank; prev = x.pts; }); return m; }
function finishGame(io, r, res) {
  const i = r.round, g = r.plan[i], before = rankMap(r);
  const rows = [];
  for (const u of r.order) {
    const p = r.players.get(u), x = res[u]; if (!x) continue;
    p.games[i] = x; const score = C.gameScore(g, x.perf, x.win, r.lv); p.pts += score; p.lastScore = score;
    p.streak = x.win ? (p.streak || 0) + 1 : 0; p.finished = true;
  }
  const after = rankMap(r), top = Math.max(...r.order.map((u) => r.players.get(u).lastScore || 0));
  for (const u of r.order) { const p = r.players.get(u); rows.push({ id: u, nick: p.profile?.nick || p.name, score: p.lastScore, total: Math.round(p.pts * 10) / 10, win: !!res[u]?.win, detail: res[u]?.detail || "", rank: after[u], up: before[u] - after[u], streak: p.streak, best: p.lastScore === top && top > 0 }); }
  rows.sort((a, b) => a.rank - b.rank || b.score - a.score);
  const comeback = rows.find((x) => x.rank === 1 && x.up > 0) || null;
  r.lastGame = { round: i, g, name: C.GAMES[g].name, rows, comeback: comeback ? comeback.nick : null, streak: rows.filter((x) => x.streak >= 3).map((x) => ({ nick: x.nick, n: x.streak })) };
  r.phase = "result"; r.phaseEnd = now() + fast(RESULT_MS); r.groupSt = null;
  emitRoom(io, r);
  schedule(io, r, r.phaseEnd, () => { if (r.round + 1 < r.plan.length) startGame(io, r, r.round + 1); else finish(io, r).catch((e) => console.error("[mm] finish", e)); });
}
async function finish(io, r) {
  r.phase = "final"; r.phaseEnd = null;
  const groupId = resultId(), scores = r.order.map((u) => ({ u, pts: r.players.get(u).pts })).sort((a, b) => b.pts - a.pts);
  const rankOf = {}; let rk = 0, prev = null; scores.forEach((x, k) => { if (x.pts !== prev) rk = k + 1; rankOf[x.u] = rk; prev = x.pts; });
  const rows = [], individual = {}, people = [];
  for (const u of r.order) {
    const p = r.players.get(u), results = r.plan.map((_, i) => p.games[i]).filter(Boolean);
    const prof = p.profile || { nick: p.name, age: null, avatar: { skin: 0, hc: 0, hs: 0, shirt: 0, pants: 0, hat: 0 } };
    const row = buildRow({ id: resultId(), key: p.isGuest ? `g:${u}` : `u:${u}`, me: { isGuest: p.isGuest, id: u }, prof, prefs: p.prefs || {}, mode: r.mode, lv: r.lv, dev: p.device, results, seed: C.hashSeed(groupId + u), rank: rankOf[u], of: r.order.length, groupId, avatarUrl: p.avatarUrl });
    rows.push(row); individual[u] = publicRow(row, { owner: true }); people.push({ u, p, row });
  }
  const players = people.map(({ u, p, row }) => ({ id: u, resultId: row.id, nick: row.nickname, avatar: row.avatar, avatarUrl: p.avatarUrl, rank: rankOf[u], pts: Math.round(p.pts * 10) / 10, total: row.total, type: row.diag.type.name, typeId: row.diag.type.id, tier: row.diag.tier.name, wins: row.wins, areas: row.areas })).sort((a, b) => a.rank - b.rank);
  // 영역별 1위와 MVP 칭호
  const kings = {}; for (const a of C.AREAS) { let best = null; for (const x of players) { const v = x.areas?.[a]; if (Number.isFinite(v) && v > 0 && (!best || v > best.v)) best = { nick: x.nick, v }; } if (best) kings[a] = best; }
  const mvp = players[0] ? { nick: players[0].nick, title: players[0].rank === 1 ? `${C.AREA_NAME[Object.entries(players[0].areas).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1])[0]?.[0]] || "심리전"} MVP` : "MVP" } : null;
  const report = { ranking: players.map((x) => ({ id: x.id, rank: x.rank, nick: x.nick, pts: x.pts })), kings, mvp, n: players.length };
  r.final = { groupId, report, players, individual, saved: false };
  emitRoom(io, r);
  for (const { u, p } of people) if (p.connected && p.socketId) io.to(p.socketId).emit("mm:mine", individual[u]);
  if (r.sb) {
    try {
      const { error: e1 } = await insertResults(r.sb, rows);
      const { error: e2 } = await r.sb.from("mind_groups").insert({ id: groupId, host_key: r.hostKey, mode: r.mode, lv: r.lv, players: players.map(({ areas, ...x }) => x), report });
      if (e1 || e2) console.error("[mm] save", e1?.message, e2?.message);
      else { r.final.saved = true; io.to(sockRoom(r.id)).emit("mm:saved", { groupId }); }
    } catch (e) { console.error("[mm] save", e?.message); }
  }
}

export function registerMindMulti(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    let win = now(), cnt = 0;
    const limited = (ev) => { if (ev === "mm:time") return false; const n = now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > Number(process.env.MIND_RL || 60); };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      if (limited(ev)) return reply({ ok: false, error: "RATE_LIMITED" });
      try { await fn(p || {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); }
    });
    const myRoom = () => { const id = USER_ROOM.get(me.id); return id ? ROOMS.get(id) : null; };
    const attach = (r) => { socket.join(sockRoom(r.id)); USER_ROOM.set(me.id, r.id); };
    async function applyMember(pl, p) {
      const prof = sanitizeProfile(p.profile), mp = await memberProfile(supabaseAdmin, me);
      if (prof && mp?.nickname) prof.nick = String(mp.nickname).slice(0, 12);
      if (prof) { pl.profile = prof; pl.name = prof.nick; } else if (mp?.nickname) pl.name = String(mp.nickname).slice(0, 12);
      if (mp) pl.avatarUrl = mp.avatar_url || null;
      if (p.prefs) pl.prefs = sanitizePrefs(p.prefs);
    }
    const dev = (p) => (p.device === "mobile" ? "mobile" : "pc");

    on("mm:time", (_p, reply) => reply({ ok: true, now: now() }));
    on("mm:mine", (_p, reply) => { const r = myRoom(); const x = r?.final?.individual?.[me.id]; if (!x) return reply({ ok: false, error: "NO_RESULT" }); reply({ ok: true, result: x }); });
    on("mm:list", (_p, reply) => {
      const rows = [...ROOMS.values()].filter((r) => r.isPublic && r.phase === "lobby" && r.order.length < r.maxPlayers).slice(0, 30)
        .map((r) => ({ code: r.code, host: r.players.get(r.host)?.profile?.nick || r.players.get(r.host)?.name || "방장", n: r.order.length, max: r.maxPlayers, mode: r.mode, lv: r.lv }));
      reply({ ok: true, rows });
    });
    on("mm:create", async (p, reply) => {
      if (me.isGuest) { const ip = sockIp(socket), arr = (ipMakes.get(ip) || []).filter((t) => now() - t < IP_WIN); if (arr.length >= IP_MAX) return reply({ ok: false, error: "RATE_LIMITED" }); arr.push(now()); ipMakes.set(ip, arr); if (ipMakes.size > 5000) ipMakes.clear(); }
      const old = myRoom(); if (old) removePlayer(io, old, me.id);
      const id = "mm" + now().toString(36) + Math.random().toString(36).slice(2, 6);
      const mode = C.MULTI_PLANS[p.rounds] ? p.rounds : "m5";
      const r = { id, code: genCode(), host: me.id, hostKey: me.isGuest ? `g:${me.id}` : `u:${me.id}`, isPublic: !!p.isPublic, maxPlayers: Math.min(MAX_PLAYERS, Math.max(2, Number(p.maxPlayers) || 8)), lv: Math.min(3, Math.max(1, Number(p.lv ?? 1))), mode, phase: "lobby", round: -1, players: new Map(), order: [], specs: new Set(), plan: null, seed: newSeed(), sb: supabaseAdmin, timer: null, emptyTimer: null };
      ROOMS.set(id, r); CODES.set(r.code, id);
      const pl = newPlayer(p.profile?.nick, !!me.isGuest, socket.id, dev(p)); await applyMember(pl, p);
      r.players.set(me.id, pl); r.order.push(me.id); attach(r);
      reply({ ok: true, me: me.id, room: pubRoom(r) }); emitRoom(io, r);
    });
    on("mm:join", async (p, reply) => {
      const jf = joinFails.get(me.id);
      if (jf && jf.until > now()) return reply({ ok: false, error: "RATE_LIMITED" });
      const rid = CODES.get(String(p.code || "").trim()), r = rid ? ROOMS.get(rid) : null;
      if (!r) { const f = jf && now() - jf.at < JOIN_FAIL_WIN ? jf : { n: 0, at: now(), until: 0 }; f.n++; if (f.n >= JOIN_FAIL_MAX) { f.until = now() + JOIN_BLOCK_MS; f.n = 0; f.at = now(); } joinFails.set(me.id, f); if (joinFails.size > 20000) joinFails.clear(); return reply({ ok: false, error: "NO_ROOM" }); }
      const ex = r.players.get(me.id);
      if (ex) { if (ex.dropTimer) { clearTimeout(ex.dropTimer); ex.dropTimer = null; } ex.connected = true; ex.socketId = socket.id; attach(r); checkEmpty(io, r); reply({ ok: true, me: me.id, room: pubRoom(r), you: personal(r, me.id), rejoined: true }); return emitRoom(io, r); }
      const old = myRoom(); if (old && old.id !== r.id) removePlayer(io, old, me.id);
      if (p.spectate || r.phase !== "lobby" || r.order.length >= r.maxPlayers) {
        if (!p.spectate && r.phase === "lobby") return reply({ ok: false, error: "ROOM_FULL" });
        if (r.specs.size >= MAX_SPECS) return reply({ ok: false, error: "ROOM_FULL" });
        r.specs.add(me.id); attach(r); reply({ ok: true, me: me.id, room: pubRoom(r), spectator: true }); return emitRoom(io, r);
      }
      const pl = newPlayer(p.profile?.nick, !!me.isGuest, socket.id, dev(p)); await applyMember(pl, p);
      r.players.set(me.id, pl); r.order.push(me.id); attach(r); checkEmpty(io, r);
      reply({ ok: true, me: me.id, room: pubRoom(r) }); emitRoom(io, r);
    });
    on("mm:rejoin", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.specs.has(me.id)) { attach(r); return reply({ ok: true, me: me.id, room: pubRoom(r), spectator: true }); }
      const ex = r.players.get(me.id); if (!ex) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (ex.dropTimer) { clearTimeout(ex.dropTimer); ex.dropTimer = null; }
      ex.connected = true; ex.socketId = socket.id; if (p.device) ex.device = dev(p);
      attach(r); checkEmpty(io, r);
      reply({ ok: true, me: me.id, room: pubRoom(r), you: personal(r, me.id) }); emitRoom(io, r);
    });
    on("mm:profile", async (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.phase !== "lobby" && r.phase !== "final") return reply({ ok: false, error: "NOT_LOBBY" });
      const pl = r.players.get(me.id); if (!pl) return reply({ ok: false, error: "NOT_IN_ROOM" }); await applyMember(pl, p);
      if (!pl.profile) return reply({ ok: false, error: "BAD_PROFILE" });
      if (p.device) pl.device = dev(p);
      reply({ ok: true }); emitRoom(io, r);
    });
    on("mm:options", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" });
      if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      if (C.MULTI_PLANS[p.rounds]) r.mode = p.rounds;
      if (p.lv != null) r.lv = Math.min(3, Math.max(1, Number(p.lv) || 1));
      if (p.isPublic != null) r.isPublic = !!p.isPublic;
      if (p.maxPlayers) r.maxPlayers = Math.min(MAX_PLAYERS, Math.max(r.order.length, 2, Number(p.maxPlayers) || r.maxPlayers));
      reply({ ok: true }); emitRoom(io, r);
    });
    on("mm:ready", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      const pl = r.players.get(me.id); if (!pl?.profile) return reply({ ok: false, error: "NEED_PROFILE" });
      pl.ready = !!p.ready; reply({ ok: true }); emitRoom(io, r);
    });
    on("mm:host", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" });
      if (!r.players.has(p.to) || p.to === me.id) return reply({ ok: false, error: "BAD_TARGET" });
      r.host = p.to; reply({ ok: true }); emitRoom(io, r);
    });
    on("mm:kick", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.host !== me.id || p.id === me.id) return reply({ ok: false, error: "NOT_HOST" });
      if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      const t = r.players.get(p.id); if (!t) return reply({ ok: false, error: "BAD_TARGET" });
      io.to(t.socketId).emit("mm:kicked", {}); io.sockets.sockets.get(t.socketId)?.leave(sockRoom(r.id));
      removePlayer(io, r, p.id); reply({ ok: true });
    });
    on("mm:start", (_p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" });
      if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      const live = r.order.filter((u) => r.players.get(u).connected);
      if (live.length < 2) return reply({ ok: false, error: "NEED_2" });
      if (live.some((u) => !r.players.get(u).profile)) return reply({ ok: false, error: "NEED_PROFILE" });
      if (live.some((u) => u !== r.host && !r.players.get(u).ready)) return reply({ ok: false, error: "NOT_READY" });
      for (const u of [...r.order]) if (!r.players.get(u).connected) { r.players.delete(u); r.order = r.order.filter((x) => x !== u); USER_ROOM.delete(u); }
      r.plan = [...C.MULTI_PLANS[r.mode]]; r.seed = newSeed(); r.final = null; r.lastGame = null;
      for (const p of r.players.values()) { p.games = {}; p.pts = 0; p.streak = 0; p.ready = false; p.lastScore = 0; }
      reply({ ok: true }); startGame(io, r, 0);
    });
    on("mm:view", (_p, reply) => { const r = myRoom(), pl = r?.players.get(me.id); if (!pl || r.phase !== "play" || !pl.g || pl.g.done) return reply({ ok: false, error: "NOT_PLAYING" }); if (!pl.stepAt) pl.stepAt = now(); reply({ ok: true, view: G.viewOf(pl.g), seq: pl.g.acts, elapsed: now() - pl.stepAt, round: r.round, gameEnd: r.gameEnd }); });
    on("mm:you", (_p, reply) => { const r = myRoom(); if (!r || !r.players.has(me.id)) return reply({ ok: false, error: "NOT_IN_ROOM" }); reply({ ok: true, you: personal(r, me.id) }); });
    // 행동: 관전자·다른 라운드·중복 제출은 서버가 막음
    on("mm:act", (p, reply) => {
      const r = myRoom(); if (!r || !r.players.has(me.id)) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.phase !== "play" || (p.round | 0) !== r.round) return reply({ ok: false, error: "NOT_PLAYING" });
      const pl = r.players.get(me.id), g = r.plan[r.round];
      let action = p.action ?? null; try { if (JSON.stringify(action)?.length > 2000) action = null; } catch { action = null; }
      if (isGroup(g)) {
        if ((p.tick | 0) !== r.tick) return reply({ ok: false, error: "NOT_PLAYING" });
        if (pl.locked) return reply({ ok: true, dup: true, locked: true });
        if (now() > r.tickEnd + GRACE_MS) return reply({ ok: false, error: "TIME_UP" });
        if (!action || typeof action !== "object") return reply({ ok: false, error: "BAD_ACTION" });
        pl.act = action; pl.locked = true;
        reply({ ok: true, locked: true }); emitRoom(io, r); return maybeAdvance(io, r);
      }
      if (!pl.g || pl.g.done) return reply({ ok: true, dup: true, finished: true });
      if ((p.seq | 0) !== pl.g.acts) return reply({ ok: true, dup: true, seq: pl.g.acts });
      const lim = G.viewOf(pl.g).lim, late = (!!pl.stepAt && now() - pl.stepAt > lim * 1000 + GRACE_MS * 2) || now() > r.gameEnd + GRACE_MS;
      const x = G.applyAction(pl.g, late ? null : action);
      if (x.error) return reply({ ok: false, error: x.error });
      if (!x.stay) pl.stepAt = 0;
      const done = pl.g.done;
      reply({ ok: true, fb: x.fb, seq: pl.g.acts, stay: !!x.stay, view: x.stay && !done ? G.viewOf(pl.g) : null, finished: done });
      if (done) { pl.finished = true; emitRoom(io, r); maybeAdvance(io, r); }
    });
    const EMOTES = ["wow", "laugh", "sus", "clap", "angry", "party", "think"], SAFE_IN_PLAY = ["think", "clap"];
    let emoteAt = 0;
    on("mm:emote", (p, reply) => {
      const r = myRoom(); if (!r || !r.players.has(me.id)) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (!EMOTES.includes(p.e)) return reply({ ok: false, error: "BAD_EMOTE" });
      if (now() - emoteAt < 2500) return reply({ ok: false, error: "COOLDOWN" });
      if (r.phase === "play" && !SAFE_IN_PLAY.includes(p.e)) return reply({ ok: false, error: "EMOTE_LOCKED" });   // 결과 공개 전 민감한 반응 제한
      emoteAt = now(); io.to(sockRoom(r.id)).emit("mm:emote", { id: me.id, e: p.e }); reply({ ok: true });
    });
    on("mm:rematch", (_p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" });
      if (r.phase !== "final") return reply({ ok: false, error: "NOT_FINAL" });
      r.phase = "lobby"; r.round = -1; r.final = null; r.lastGame = null; r.plan = null; r.phaseEnd = null;
      for (const u of [...r.order]) { const pl = r.players.get(u); Object.assign(pl, { ready: false, games: {}, pts: 0, streak: 0, g: null, finished: false, locked: false, act: null }); if (!pl.connected) { r.players.delete(u); r.order = r.order.filter((x) => x !== u); USER_ROOM.delete(u); } }
      reply({ ok: true }); emitRoom(io, r);
    });
    on("mm:leave", (_p, reply) => { const r = myRoom(); if (!r) return reply({ ok: true }); socket.leave(sockRoom(r.id)); if (r.specs.has(me.id)) { r.specs.delete(me.id); USER_ROOM.delete(me.id); emitRoom(io, r); } else removePlayer(io, r, me.id); reply({ ok: true }); });

    socket.on("disconnect", () => {
      const r = myRoom(); if (!r) return;
      if (r.specs.has(me.id)) { r.specs.delete(me.id); USER_ROOM.delete(me.id); return emitRoom(io, r); }
      const pl = r.players.get(me.id); if (!pl || pl.socketId !== socket.id) return;
      pl.connected = false;
      if (r.phase === "lobby") { pl.ready = false; pl.dropTimer = setTimeout(() => { const rr = ROOMS.get(r.id); if (rr && rr.phase === "lobby" && rr.players.get(me.id) && !rr.players.get(me.id).connected) removePlayer(io, rr, me.id); }, LOBBY_DROP_MS); }
      pickHost(r);
      if (r.phase === "play") maybeAdvance(io, r);
      checkEmpty(io, r); emitRoom(io, r);
    });
  });
}
export const _mmTest = { ROOMS, CODES, USER_ROOM };
