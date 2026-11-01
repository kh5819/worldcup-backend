// =========================
// 플듀 IQ 진단소 — 최대 8인 실시간 두뇌 대결 (iqm:*)
// 같은 문항을 동시에 · 서버 기준 시작/마감 · 각자 답 제출 → 서버 채점
// 진행 중에는 정답·정오답을 아무에게도 안 보냄(제출 여부만) → 라운드 결과 때 정답·해설·순위 변동 공개
// 흐름: lobby → [intro → play → result] × 문항 수 → final (8위→1위 공개는 화면에서)
// =========================
import * as C from "./iq-core.js?v=c2";
import * as G from "./iq-gen.js?v=g2";
import { makeItem, judgeItem, pointsOf, resultId, publicRow, memberProfile, sanitizeProfile, sanitizePrefs, buildRow, insertResults, hintFor } from "./iq.js";

const ROOMS = new Map(), CODES = new Map(), USER_ROOM = new Map();
const MAX_PLAYERS = 8;
const fast = (ms) => (process.env.IQ_FAST === "1" ? ms * 0.02 : ms);
const INTRO_MS = 3500;          // 같은 영역 다음 문항
const AREA_INTRO_MS = 6500;     // 영역이 바뀔 때(검사실 이동 연출)
const FIRST_INTRO_MS = 9000;
const RESULT_MS = 5500;
const GRACE_MS = 2500;
const LOBBY_DROP_MS = 20000, EMPTY_TTL_MS = 90000;
const JOIN_FAIL_MAX = 8, JOIN_FAIL_WIN = 60000, JOIN_BLOCK_MS = 60000;
const joinFails = new Map();
const MULTI_MODES = ["quick", "full"];

const now = () => Date.now();
const sockRoom = (id) => `iqm:${id}`;
function genCode() { for (let i = 0; i < 60; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!CODES.has(c)) return c; } return String(Math.floor(Math.random() * 1e7)).padStart(7, "0"); }
const newSeed = () => (Math.floor(Math.random() * 0xffffffff) >>> 0) || 11;

function pubPlayer(r, uid) {
  const p = r.players.get(uid); if (!p) return null;
  const cur = r.round >= 0 ? p.rounds[r.round] : null;
  return {
    id: uid, nick: p.profile?.nick || p.name, avatar: p.profile?.avatar || null, avatarUrl: p.avatarUrl || null,
    age: p.prefs?.shareMulti ? p.profile?.age || null : null, hasProfile: !!p.profile, isGuest: p.isGuest, device: p.device,
    connected: p.connected, ready: p.ready, host: r.host === uid, pts: Math.round(p.pts * 100) / 100, late: !!p.late,
    status: r.phase === "play" ? (cur ? "done" : p.late ? "skip" : "playing") : null,   // 정오답은 안 알려 줌
  };
}
function pubRoom(r) {
  const playing = r.phase === "play" || r.phase === "intro";
  return {
    id: r.id, code: r.code, host: r.host, maxPlayers: r.maxPlayers, mode: r.mode, n: r.plan?.length || C.PLANS[r.mode].length,
    plan: r.plan ? r.plan.map((x) => ({ type: x.type, d: x.d, area: C.TYPES[x.type].area })) : C.PLANS[r.mode].map(([t, d]) => ({ type: t, d, area: C.TYPES[t].area })),
    phase: r.phase, round: r.round, phaseEnd: r.phaseEnd, startAt: r.startAt, deadline: r.deadline,
    item: r.phase === "play" && r.item ? G.publicItem(r.item) : null,
    roundResult: r.phase === "result" || r.phase === "final" ? r.lastRound : null,
    final: r.phase === "final" && r.final ? { ...r.final, individual: undefined } : null,
    players: r.order.map((u) => pubPlayer(r, u)).filter(Boolean),
    serverNow: now(), playing,
  };
}
function emitRoom(io, r) { io.to(sockRoom(r.id)).emit("iqm:room", pubRoom(r)); }
function clearT(r) { if (r.timer) { clearTimeout(r.timer); r.timer = null; } }
function schedule(io, r, at, fn) { clearT(r); r.timer = setTimeout(() => { r.timer = null; try { fn(); } catch (e) { console.error("[iqm] timer", e); } }, Math.max(0, at - now())); }
function deleteRoom(io, r, reason) {
  clearT(r); if (r.emptyTimer) clearTimeout(r.emptyTimer);
  ROOMS.delete(r.id); CODES.delete(r.code);
  for (const u of r.order) if (USER_ROOM.get(u) === r.id) USER_ROOM.delete(u);
  io.to(sockRoom(r.id)).emit("iqm:closed", { reason }); io.in(sockRoom(r.id)).socketsLeave(sockRoom(r.id));
}
function checkEmpty(io, r) {
  const any = [...r.players.values()].some((p) => p.connected);
  if (any) { if (r.emptyTimer) { clearTimeout(r.emptyTimer); r.emptyTimer = null; } return; }
  if (!r.emptyTimer) r.emptyTimer = setTimeout(() => { if (ROOMS.get(r.id) && ![...r.players.values()].some((p) => p.connected)) deleteRoom(io, r, "EMPTY"); }, fast(EMPTY_TTL_MS));
}
function pickHost(r) { if (r.players.get(r.host)?.connected) return; const next = r.order.find((u) => r.players.get(u)?.connected); if (next) r.host = next; }
function removePlayer(io, r, uid) {
  r.players.delete(uid); r.order = r.order.filter((u) => u !== uid);
  if (USER_ROOM.get(uid) === r.id) USER_ROOM.delete(uid);
  if (!r.order.length) return deleteRoom(io, r, "EMPTY");
  if (r.host === uid) r.host = r.order.find((u) => r.players.get(u)?.connected) || r.order[0];
  if (r.phase === "play") maybeEndRound(io, r);
  emitRoom(io, r);
}
function newPlayer(name, isGuest, socketId, dev) { return { name: String(name || "참가자").slice(0, 12), isGuest, socketId, connected: true, ready: false, profile: null, prefs: sanitizePrefs({}), avatarUrl: null, device: dev, rounds: {}, st: {}, pts: 0, late: false, dropTimer: null }; }

function startRound(io, r, i) {
  r.round = i; r.phase = "intro"; r.item = makeItem(r.plan[i]);
  for (const p of r.players.values()) { p.late = !p.connected; p.st[i] = null; }
  const areaChange = i === 0 || C.TYPES[r.plan[i].type].area !== C.TYPES[r.plan[i - 1].type].area;
  r.phaseEnd = now() + fast(i === 0 ? FIRST_INTRO_MS : areaChange ? AREA_INTRO_MS : INTRO_MS);
  r.startAt = r.phaseEnd;
  r.deadline = r.startAt + r.item.lim + GRACE_MS;
  emitRoom(io, r);
  schedule(io, r, r.startAt, () => {
    r.phase = "play";
    for (const p of r.players.values()) p.st[i] = { at: r.startAt, act: {}, hint: false };
    emitRoom(io, r);
    schedule(io, r, r.deadline, () => endRound(io, r));
  });
}
function maybeEndRound(io, r) {
  if (r.phase !== "play") return;
  const waiting = r.order.some((u) => { const p = r.players.get(u); return p.connected && !p.late && !p.rounds[r.round]; });
  if (!waiting) endRound(io, r);
}
function endRound(io, r) {
  if (r.phase !== "play" && r.phase !== "intro") return;
  const i = r.round, it = r.item;
  const before = rankMap(r);
  for (const u of r.order) {
    const p = r.players.get(u);
    if (!p.rounds[i]) p.rounds[i] = { ...judgeItem(it, null, p.st[i] || { at: r.startAt }, r.startAt + it.lim + GRACE_MS + 1), missing: true, late: p.late };
    p.pts = Object.values(p.rounds).reduce((s, x) => s + C.itemPoints(x.d, x), 0);
  }
  const after = rankMap(r);
  const rows = r.order.map((u) => { const x = r.players.get(u).rounds[i]; return { id: u, ok: x.ok, part: x.part, ms: x.ms, hint: x.hint, timeout: x.timeout, pts: pointsOf(x), total: Math.round(r.players.get(u).pts * 100) / 100, rank: after[u], prevRank: before[u] }; })
    .sort((a, b) => b.pts - a.pts || a.ms - b.ms);
  const answers = {};
  for (const u of r.order) answers[u] = r.players.get(u).answers?.[i] ?? null;
  r.lastRound = { round: i, type: it.type, d: it.d, area: it.area, item: G.publicItem(it), reveal: G.revealOf(it), rows, answers, fastest: rows.filter((x) => x.ok).sort((a, b) => a.ms - b.ms)[0]?.id || null };
  r.phase = "result"; r.phaseEnd = now() + fast(RESULT_MS);
  emitRoom(io, r);
  schedule(io, r, r.phaseEnd, () => { if (r.round + 1 < r.plan.length) startRound(io, r, r.round + 1); else finish(io, r).catch((e) => console.error("[iqm] finish", e)); });
}
function rankMap(r) {
  const arr = r.order.map((u) => ({ u, pts: r.players.get(u).pts })).sort((a, b) => b.pts - a.pts);
  const m = {}; let rank = 0, prev = null;
  arr.forEach((x, k) => { if (x.pts !== prev) rank = k + 1; m[x.u] = rank; prev = x.pts; });
  return m;
}

async function finish(io, r) {
  r.phase = "final"; r.phaseEnd = null;
  const groupId = resultId();
  const people = r.order.map((u) => {
    const p = r.players.get(u);
    const results = r.plan.map((_, i) => { const x = p.rounds[i]; const { missing, late, ...rest } = x || {}; void missing; void late; return x ? rest : { type: r.plan[i].type, d: r.plan[i].d, area: C.TYPES[r.plan[i].type].area, ok: false, part: 0, ms: 0, lim: 60000, hint: false, timeout: true }; });
    const sc = C.scoreAll(results);
    return { id: u, p, results, total: sc.total, iq: sc.iq, areas: sc.areas, ms: sc.ms };
  });
  const report = C.groupReport(people, C.hashSeed(groupId));
  const rankOf = Object.fromEntries(report.ranking.map((x) => [x.id, x.rank]));
  const rows = [], individual = {};
  for (const x of people) {
    const prof = x.p.profile || { nick: x.p.name, age: null, avatar: { skin: 0, hc: 0, hs: 0, shirt: 0, pants: 0, hat: 0 } };
    const row = buildRow({ id: resultId(), key: x.p.isGuest ? `g:${x.id}` : `u:${x.id}`, me: { isGuest: x.p.isGuest, id: x.id }, prof, prefs: x.p.prefs, mode: r.mode, setKey: null, dev: x.p.device, plan: r.plan, results: x.results, seed: C.hashSeed(groupId + x.id), rank: rankOf[x.id], of: people.length, groupId, isPublic: true, avatarUrl: x.p.avatarUrl });
    rows.push(row);
    individual[x.id] = publicRow(row, { owner: true });
  }
  const playersPub = people.map((x) => { const I = individual[x.id]; return { id: x.id, resultId: I.id, nick: I.nick, avatar: I.avatar, avatarUrl: x.p.avatarUrl || null, isGuest: x.p.isGuest, device: x.p.device, total: I.total, iq: I.iq, areas: I.areas, correct: I.correct, title: I.diag.title, type: I.diag.type.name, i18n: I.diag.i18n || null, titles: I.diag.titles, rank: rankOf[x.id] }; });
  r.final = { groupId, report, players: playersPub, individual, saved: false };
  emitRoom(io, r);
  for (const x of people) if (x.p.connected && x.p.socketId) io.to(x.p.socketId).emit("iqm:mine", individual[x.id]);
  if (r.sb) {
    try {
      const { error: e1 } = await insertResults(r.sb, rows);
      const { error: e2 } = await r.sb.from("iq_groups").insert({ id: groupId, host_key: r.hostKey, mode: r.mode, players: playersPub, report });
      if (e1 || e2) console.error("[iqm] save", e1?.message, e2?.message);
      else { r.final.saved = true; io.to(sockRoom(r.id)).emit("iqm:saved", { groupId }); }
    } catch (e) { console.error("[iqm] save", e?.message); }
  }
}

export function registerIqMulti(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;
    let win = now(), cnt = 0;
    const limited = (ev) => { if (ev === "iqm:time") return false; const n = now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > 60; };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      if (limited(ev)) return reply({ ok: false, error: "RATE_LIMITED" });
      try { await fn(p || {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); }
    });
    const myRoom = () => { const id = USER_ROOM.get(me.id); return id ? ROOMS.get(id) : null; };
    const attach = (r) => { socket.join(sockRoom(r.id)); USER_ROOM.set(me.id, r.id); };
    async function applyMember(pl, p) {
      const prof = sanitizeProfile(p.profile);
      const mp = await memberProfile(supabaseAdmin, me);
      if (prof && mp?.nickname) prof.nick = String(mp.nickname).slice(0, 12);
      if (prof) { pl.profile = prof; pl.name = prof.nick; } else if (mp?.nickname) pl.name = String(mp.nickname).slice(0, 12);
      if (mp) pl.avatarUrl = mp.avatar_url || null;
      if (p.prefs) pl.prefs = sanitizePrefs(p.prefs);
    }

    on("iqm:time", (_p, reply) => reply({ ok: true, now: now() }));
    on("iqm:mine", (_p, reply) => { const r = myRoom(); if (!r?.final?.individual?.[me.id]) return reply({ ok: false, error: "NO_RESULT" }); reply({ ok: true, result: r.final.individual[me.id] }); });

    on("iqm:create", async (p, reply) => {
      if (me.isGuest) return reply({ ok: false, error: "GUEST_CANNOT_CREATE" });
      const old = myRoom(); if (old) removePlayer(io, old, me.id);
      const id = "iq" + now().toString(36) + Math.random().toString(36).slice(2, 6);
      const r = { id, code: genCode(), host: me.id, hostKey: `u:${me.id}`, maxPlayers: Math.min(MAX_PLAYERS, Math.max(1, Number(p.maxPlayers) || 8)), mode: MULTI_MODES.includes(p.mode) ? p.mode : "quick", plan: null, item: null, phase: "lobby", round: -1, players: new Map(), order: [], phaseEnd: null, startAt: null, deadline: null, lastRound: null, final: null, timer: null, emptyTimer: null, sb: supabaseAdmin };
      ROOMS.set(id, r); CODES.set(r.code, id);
      const pl = newPlayer(p.profile?.nick, false, socket.id, p.device === "mobile" ? "mobile" : "pc");
      await applyMember(pl, p);
      r.players.set(me.id, pl); r.order.push(me.id); attach(r);
      reply({ ok: true, me: me.id, room: pubRoom(r) }); emitRoom(io, r);
    });

    on("iqm:join", async (p, reply) => {
      const jf = joinFails.get(me.id);
      if (jf && jf.until > now()) return reply({ ok: false, error: "RATE_LIMITED" });
      const rid = CODES.get(String(p.code || "").trim()); const r = rid ? ROOMS.get(rid) : null;
      if (!r) {
        const f = jf && now() - jf.at < JOIN_FAIL_WIN ? jf : { n: 0, at: now(), until: 0 };
        f.n++; if (f.n >= JOIN_FAIL_MAX) { f.until = now() + JOIN_BLOCK_MS; f.n = 0; f.at = now(); }
        joinFails.set(me.id, f); if (joinFails.size > 20000) joinFails.clear();
        return reply({ ok: false, error: "NO_ROOM" });
      }
      const ex = r.players.get(me.id);
      if (ex) {   // 재접속
        if (ex.dropTimer) { clearTimeout(ex.dropTimer); ex.dropTimer = null; }
        ex.connected = true; ex.socketId = socket.id;
        if (r.phase === "play" && !ex.rounds[r.round]) ex.late = false;   // 문항 진행 중 재접속: 남은 시간 안에 풀 수 있음 (시간은 서버 기준 그대로)
        attach(r); checkEmpty(io, r);
        reply({ ok: true, me: me.id, room: pubRoom(r), rejoined: true, st: r.phase === "play" ? stPub(ex.st[r.round]) : null });
        return emitRoom(io, r);
      }
      if (r.phase !== "lobby") return reply({ ok: false, error: "ALREADY_STARTED" });
      if (r.order.length >= r.maxPlayers) return reply({ ok: false, error: "ROOM_FULL" });
      const old = myRoom(); if (old && old.id !== r.id) removePlayer(io, old, me.id);
      const pl = newPlayer(p.profile?.nick, !!me.isGuest, socket.id, p.device === "mobile" ? "mobile" : "pc");
      await applyMember(pl, p);
      r.players.set(me.id, pl); r.order.push(me.id); attach(r); checkEmpty(io, r);
      reply({ ok: true, me: me.id, room: pubRoom(r) }); emitRoom(io, r);
    });
    const stPub = (st) => (st ? { hint: st.hint, w: st.act?.w || null } : null);

    on("iqm:rejoin", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      const ex = r.players.get(me.id);
      if (ex.dropTimer) { clearTimeout(ex.dropTimer); ex.dropTimer = null; }
      ex.connected = true; ex.socketId = socket.id; ex.late = false;
      if (p.device) ex.device = p.device === "mobile" ? "mobile" : "pc";
      attach(r); checkEmpty(io, r);
      reply({ ok: true, me: me.id, room: pubRoom(r), st: r.phase === "play" ? stPub(ex.st[r.round]) : null });
      emitRoom(io, r);
    });

    on("iqm:profile", async (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.phase !== "lobby" && r.phase !== "final") return reply({ ok: false, error: "NOT_LOBBY" });
      const pl = r.players.get(me.id); await applyMember(pl, p);
      if (!pl.profile) return reply({ ok: false, error: "BAD_PROFILE" });
      if (p.device) pl.device = p.device === "mobile" ? "mobile" : "pc";
      reply({ ok: true }); emitRoom(io, r);
    });
    on("iqm:options", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" });
      if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      if (MULTI_MODES.includes(p.mode)) r.mode = p.mode;
      if (p.maxPlayers) r.maxPlayers = Math.min(MAX_PLAYERS, Math.max(r.order.length, 1, Number(p.maxPlayers) || r.maxPlayers));
      reply({ ok: true }); emitRoom(io, r);
    });
    on("iqm:ready", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      const pl = r.players.get(me.id); if (!pl.profile) return reply({ ok: false, error: "NEED_PROFILE" });
      pl.ready = !!p.ready; reply({ ok: true }); emitRoom(io, r);
    });
    on("iqm:host", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" });
      if (!r.players.has(p.to) || p.to === me.id) return reply({ ok: false, error: "BAD_TARGET" });
      r.host = p.to; reply({ ok: true }); emitRoom(io, r);
    });
    on("iqm:kick", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.host !== me.id || p.id === me.id) return reply({ ok: false, error: "NOT_HOST" });
      if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      const t = r.players.get(p.id); if (!t) return reply({ ok: false, error: "BAD_TARGET" });
      io.to(t.socketId).emit("iqm:kicked", {}); io.sockets.sockets.get(t.socketId)?.leave(sockRoom(r.id));
      removePlayer(io, r, p.id); reply({ ok: true });
    });
    on("iqm:start", (_p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" });
      if (r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      const live = r.order.filter((u) => r.players.get(u).connected);
      if (live.some((u) => !r.players.get(u).profile)) return reply({ ok: false, error: "NEED_PROFILE" });
      if (live.some((u) => u !== r.host && !r.players.get(u).ready)) return reply({ ok: false, error: "NOT_READY" });
      for (const u of [...r.order]) if (!r.players.get(u).connected) { r.players.delete(u); r.order = r.order.filter((x) => x !== u); USER_ROOM.delete(u); }
      r.plan = C.buildPlan(r.mode, newSeed());
      r.final = null; r.lastRound = null;
      for (const p of r.players.values()) { p.rounds = {}; p.st = {}; p.answers = {}; p.pts = 0; p.ready = false; }
      reply({ ok: true });
      startRound(io, r, 0);
    });

    // 문항 안 행동·힌트·답 — 지금 라운드만
    const curSt = (r) => { const pl = r.players.get(me.id); return pl?.st?.[r.round] || null; };
    on("iqm:act", (p, reply) => {
      const r = myRoom(); if (!r || r.phase !== "play" || (p.round | 0) !== r.round) return reply({ ok: false, error: "NOT_PLAYING" });
      const st = curSt(r); if (!st || r.players.get(me.id).rounds[r.round]) return reply({ ok: false, error: "NOT_PLAYING" });
      if (r.item.type !== "scale" || p.op !== "weigh") return reply({ ok: false, error: "BAD_ACT" });
      reply(G.scaleWeigh(r.item, st.act, p.L, p.R));
    });
    on("iqm:hint", (p, reply) => {
      const r = myRoom(); if (!r || r.phase !== "play" || (p.round | 0) !== r.round) return reply({ ok: false, error: "NOT_PLAYING" });
      const st = curSt(r); if (!st) return reply({ ok: false, error: "NOT_PLAYING" });
      if (!r.item.hint) return reply({ ok: false, error: "NO_HINT" });
      st.hint = true; reply({ ok: true, hint: hintFor(r.item) });
    });
    on("iqm:answer", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.phase !== "play" || (p.round | 0) !== r.round) return reply({ ok: false, error: "NOT_PLAYING" });
      const pl = r.players.get(me.id);
      if (pl.rounds[r.round]) return reply({ ok: true, dup: true });
      let ans = p.answer ?? null; try { if (JSON.stringify(ans).length > 20000) ans = null; } catch { ans = null; }
      pl.rounds[r.round] = judgeItem(r.item, ans, curSt(r) || { at: r.startAt });
      pl.answers ||= {}; pl.answers[r.round] = ans;
      reply({ ok: true, submitted: true });   // 정오답은 라운드가 끝나야 공개
      emitRoom(io, r); maybeEndRound(io, r);
    });

    on("iqm:rematch", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NOT_IN_ROOM" });
      if (r.host !== me.id) return reply({ ok: false, error: "NOT_HOST" });
      if (r.phase !== "final") return reply({ ok: false, error: "NOT_FINAL" });
      if (MULTI_MODES.includes(p.mode)) r.mode = p.mode;
      r.phase = "lobby"; r.round = -1; r.final = null; r.lastRound = null; r.plan = null; r.item = null; r.phaseEnd = null;
      for (const u of [...r.order]) { const pl = r.players.get(u); pl.ready = false; pl.rounds = {}; pl.st = {}; pl.answers = {}; pl.pts = 0; pl.late = false; if (!pl.connected) { r.players.delete(u); r.order = r.order.filter((x) => x !== u); USER_ROOM.delete(u); } }
      reply({ ok: true }); emitRoom(io, r);
    });
    on("iqm:leave", (_p, reply) => { const r = myRoom(); if (!r) return reply({ ok: true }); socket.leave(sockRoom(r.id)); removePlayer(io, r, me.id); reply({ ok: true }); });

    socket.on("disconnect", () => {
      const r = myRoom(); if (!r) return;
      const pl = r.players.get(me.id); if (!pl || pl.socketId !== socket.id) return;
      pl.connected = false;
      if (r.phase === "lobby") { pl.ready = false; pl.dropTimer = setTimeout(() => { const rr = ROOMS.get(r.id); if (rr && rr.phase === "lobby" && rr.players.get(me.id) && !rr.players.get(me.id).connected) removePlayer(io, rr, me.id); }, LOBBY_DROP_MS); }
      pickHost(r);
      if (r.phase === "play") maybeEndRound(io, r);
      checkEmpty(io, r); emitRoom(io, r);
    });
  });
}
export const _test = { ROOMS, CODES, USER_ROOM, consts: { INTRO_MS, AREA_INTRO_MS, FIRST_INTRO_MS, RESULT_MS, GRACE_MS } };
