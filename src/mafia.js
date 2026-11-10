// =========================
// 플듀 마피아 — 시청자 마을 v2 (방송 특화 소셜 추리)  이벤트 prefix: "mf:"
// 방 상태는 서버 메모리에만(DB 없음 → 서버 재시작 시 진행 중인 방은 사라짐). 5~30명, 봇 채우기.
// 보안: 직업·밤 결과·손에 든 증거는 본인 소켓으로만. 관전자·OBS·탈락자에게는 publicState()만.
// 진행: lobby → countdown → roles → night → morning → (case | hearing | discuss) → [nominate] → vote → defense → verdict → result → night … → end
// 밤 처리 순서(고정): 실종 제외 → ① 위장 → ② 보호(의무관·경호원·방탄) → ③ 습격 → ④ 정보(수사관·탐정·정보원·감시자·기자·분석가) → ⑤ 배신자 진영 변경
// =========================
import { ROLES, TEAM, buildRoles, INCIDENTS, STAFF_LOOKS, OPTIONAL_ROLES } from "./mafia-data.js";
import { makeCase, checkSolve, forgeClue, NPC } from "./mafia-cases.js";

const rooms = new Map(), userRoom = new Map();
export const MF_ALLOWED_MAX = [6, 8, 10, 12, 15, 20, 25, 30];
export const MF_MIN_START = 5;
const NICK_MAX = 12, EMPTY_TTL = 60_000, ENDED_TTL = 30 * 60_000, BIG = 16;
const BAD_NICK = /운영자|관리자|사회자|플듀|admin/i;
const CODE_CH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const now = () => Date.now();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sr = (c) => `mf:${c}`, srObs = (c) => `mf:obs:${c}`;
const rid = () => Math.random().toString(36).slice(2, 10);
let rnd = Math.random; export function _setRng(f) { rnd = f || Math.random; }
let TS = 1; export function _setTimeScale(s) { TS = s; }
const pickOne = (a) => a[Math.floor(rnd() * a.length)];
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function genCode() { for (let i = 0; i < 100; i++) { let c = ""; for (let j = 0; j < 6; j++) c += CODE_CH[Math.floor(Math.random() * CODE_CH.length)]; if (!rooms.has(c)) return c; } return "M" + Date.now().toString(36).toUpperCase().slice(-5); }
const cleanNick = (s) => String(s || "").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, NICK_MAX);
const cleanText = (s, n = 140) => String(s || "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, n);

const DEF = { revealOnDeath: true, juryWeight: 0, discuss: 1, vote: 1, deadSeeRoles: false, disabled: [], incidents: true, viewers: true, isPublic: false, title: "" };
function sanitizeSettings(s, prev = DEF) {
  s = s || {}; const b = (k) => (s[k] == null ? prev[k] : !!s[k]);
  return { revealOnDeath: b("revealOnDeath"), deadSeeRoles: b("deadSeeRoles"), incidents: b("incidents"), viewers: b("viewers"), isPublic: b("isPublic"),
    juryWeight: [0, 1].includes(Number(s.juryWeight)) ? Number(s.juryWeight) : prev.juryWeight,
    discuss: [0.7, 1, 1.4].includes(Number(s.discuss)) ? Number(s.discuss) : prev.discuss,
    vote: [0.7, 1, 1.4].includes(Number(s.vote)) ? Number(s.vote) : prev.vote,
    disabled: Array.isArray(s.disabled) ? s.disabled.filter((r) => OPTIONAL_ROLES.includes(r)).slice(0, 20) : prev.disabled,
    title: s.title != null ? cleanText(s.title, 30) : prev.title };
}

// ---------- 참가자 ----------
function newPlayer(uid, nick, o = {}) {
  return { uid, nick, isGuest: !!o.isGuest, bot: !!o.bot, connected: !o.offline, socketId: o.socketId || null, seat: 0, ready: !!o.bot,
    alive: true, role: null, look: 0, results: [], uses: {}, lastProtect: null, silencedDay: 0, deathDay: 0, deathBy: null, converted: false,
    goal: null, achieved: false, solved: 0, lastChat: 0, burst: 0, stats: { votesOnMafia: 0, votes: 0, solves: 0, saves: 0, finds: 0, kills: 0 } };
}
const P = (room, u) => room.players.get(u);
const humans = (r) => r.order.map((u) => P(r, u)).filter((p) => p && !p.bot);
const alive = (r) => r.order.map((u) => P(r, u)).filter((p) => p && p.alive);
const teamOf = (p) => (!p?.role ? null : p.role === "traitor" ? (p.converted ? TEAM.MAFIA : TEAM.TOWN) : ROLES[p.role].team);
const isMafia = (p) => teamOf(p) === TEAM.MAFIA;
const seatList = (r) => r.order.forEach((u, i) => { const p = P(r, u); if (p) p.seat = i + 1; });
const usesLeft = (p) => { const max = ROLES[p.role]?.uses; return max == null ? Infinity : max - (p.uses[p.role] || 0); };

function createRoom(host, nick, o) {
  const code = genCode();
  const room = { code, hostId: host.id, hostMode: ["mc", "watch"].includes(o.hostMode) ? o.hostMode : "play", mcNick: null, mcSocket: null, status: "lobby",
    max: MF_ALLOWED_MAX.includes(Number(o.max)) ? Number(o.max) : 12, settings: sanitizeSettings(o.settings), streamer: !!o.streamer,
    players: new Map(), order: [], spectators: new Map(), queue: [], obsKey: rid() + rid(),
    phase: { name: "lobby", day: 0, endsAt: 0, paused: false, remain: 0, seq: 0, planned: 0 }, timer: null,
    night: null, votes: new Map(), noms: new Map(), cands: null, verdict: new Map(), voteFlags: {}, news: [], log: [], chat: { all: [], mafia: [], dead: [] },
    case: null, caseN: 0, forged: [], reinv: new Set(), comeback: {}, incident: null, forcedIncident: null, nightFlags: {}, dayFlags: {}, usedInc: [],
    view: { jury: new Map(), predict: new Map(), team: new Map(), poll: null, seal: new Set() }, winner: null, game: 0, history: [], createdAt: now(),
    emptyTimer: null, endedTimer: null, simTime: 0 };
  rooms.set(code, room);
  if (room.hostMode !== "play") { room.mcNick = nick; room.mcSocket = o.socketId || null; }
  else { const p = newPlayer(host.id, nick, { isGuest: host.isGuest, socketId: o.socketId }); p.ready = true; room.players.set(host.id, p); room.order.push(host.id); seatList(room); userRoom.set(host.id, code); }
  return room;
}
function addNews(room, item) { const n = { id: rid(), t: now(), day: room.phase.day, ...item }; room.news.push(n); if (room.news.length > 40) room.news.shift(); if (item.key) { room.log.push(n); if (room.log.length > 60) room.log.shift(); } }

// ---------- 공개 정보 ----------
function shownRole(room, p) { if (room.status === "ended") return p.role; if (!p.alive && room.settings.revealOnDeath && !["kick", "left"].includes(p.deathBy)) return p.role; return null; }
function tally(map) { const o = {}; for (const [, t] of map) o[t] = (o[t] || 0) + 1; return o; }
export function publicState(room) {
  const ph = room.phase, c = room.case, V = room.view;
  const counts = {}; let skip = 0; for (const [, t] of room.votes) { if (t === "skip") skip++; else if (t !== "void") counts[t] = (counts[t] || 0) + 1; }
  const vt = tally(room.verdict);
  return {
    code: room.code, status: room.status, hostMode: room.hostMode, hostId: room.hostId, mcNick: room.mcNick, max: room.max, game: room.game, streamer: room.streamer,
    settings: { ...room.settings },
    phase: { name: ph.name, day: ph.day, endsAt: ph.endsAt, paused: ph.paused, remain: ph.remain, seq: ph.seq, serverNow: now() },
    players: room.order.map((u) => { const p = P(room, u); return { uid: p.uid, seat: p.seat, nick: p.nick, alive: p.alive, connected: p.connected || p.bot, bot: p.bot, ready: p.ready,
      isHost: room.hostId === p.uid, silenced: ph.day > 0 && p.silencedDay === ph.day, deathDay: p.deathDay, deathBy: p.deathBy, role: shownRole(room, p), look: p.look }; }),
    news: room.news.slice(-14),
    vote: ["nominate", "vote", "defense", "verdict", "result"].includes(ph.name) ? { counts, skip, total: room.votes.size, noms: tally(room.noms), cands: room.cands,
      verdict: { yes: vt.yes || 0, no: vt.no || 0, total: room.verdict.size }, accused: room.voteFlags.accused || null, anonymous: !!room.voteFlags.anonymous,
      majority: !!room.voteFlags.majority, voided: room.voteFlags.voided || 0, outcome: room.voteFlags.outcome || null,
      voters: ph.name === "result" && !room.voteFlags.anonymous ? [...room.votes].filter(([, t]) => t !== "void").map(([v, t]) => ({ v, t })) : null } : null,
    hearing: room.dayFlags.hearing ? { witness: room.voteFlags.accused || null, result: room.dayFlags.hearingResult || null } : null,
    viewers: room.settings.viewers ? { jury: tally(new Map([...V.jury].map(([k, v]) => [k, v]))), juryTotal: V.jury.size, predictTotal: V.predict.size,
      predict: topCounts(V.predict, (x) => x.seat), team: tally(new Map([...V.team])), teamTotal: V.team.size, poll: V.poll ? { kind: V.poll.kind, options: V.poll.options, counts: tally(V.poll.votes), total: V.poll.votes.size, closed: !!V.poll.closed, winner: V.poll.winner ?? null } : null,
      seal: c && c.sealed ? { need: sealNeed(room), have: V.seal.size, open: !!c.sealOpen } : null, weight: room.settings.juryWeight } : null,
    incident: room.incident ? { id: room.incident.id, title: room.incident.title, desc: room.incident.desc, text: room.incident.text || "", kind: INCIDENTS[room.incident.id]?.kind } : null,
    case: c ? { mg: c.mg, title: c.title, scene: c.scene, crimeRoom: c.crimeRoom, crimeTime: c.crimeTime, suspects: c.suspects, puzzle: c.puzzle, solveKind: c.solveKind,
      shared: c.shared.map((id) => c.byId[id]).filter(Boolean).map((x) => ({ ...x, forged: undefined })), sharedBy: c.sharedBy,
      accuse: tally(c.accuse), accuseTotal: c.accuse.size, solvers: c.solvers.size, result: c.result || null, comeback: !!c.comeback,
      sealOpen: c.sealOpen ? c.byId[c.sealed] : null } : null,
    comeback: { ...room.comeback, reinvAvail: !!reinvAvail(room), reinvHave: room.reinv.size, reinvNeed: reinvNeed(room) },
    winner: room.winner || null, log: room.status === "ended" ? room.log.slice(-20) : null,
    queue: room.queue.map((q) => ({ uid: q.uid, nick: q.nick })), spectators: room.spectators.size,
  };
}
function topCounts(map, key) { const o = {}; for (const [, v] of map) { const k = key(v); o[k] = (o[k] || 0) + 1; } return o; }

// ---------- 개인 정보 ----------
function privateState(room, uid) {
  const p = P(room, uid);
  if (!p) return { uid, spectator: true, isHost: room.hostId === uid, mc: room.hostId === uid && room.hostMode !== "play", inQueue: room.queue.some((q) => q.uid === uid), obsKey: room.hostId === uid ? room.obsKey : undefined };
  const me = { uid, seat: p.seat, alive: p.alive, isHost: room.hostId === uid, obsKey: room.hostId === uid ? room.obsKey : undefined, ready: p.ready,
    role: p.role, team: teamOf(p), converted: p.converted, look: p.look, results: p.results.slice(-14), usesLeft: p.role ? (usesLeft(p) === Infinity ? null : usesLeft(p)) : null,
    lastProtect: p.lastProtect, silenced: room.phase.day > 0 && p.silencedDay === room.phase.day, goal: p.goal, achieved: p.achieved };
  if (p.role && isMafia(p)) me.teammates = room.order.map((u) => P(room, u)).filter((q) => q.uid !== uid && isMafia(q)).map((q) => ({ uid: q.uid, role: q.role, alive: q.alive }));
  if (!p.alive && room.settings.deadSeeRoles) me.allRoles = room.order.map((u) => ({ uid: u, role: P(room, u).role }));
  if (room.phase.name === "night" && room.night) { me.act = actOf(room, p); const a = room.night.acts.get(uid); me.actTarget = me.act === "kill" ? room.night.kills.get(uid) ?? null : a ? a.t : null; me.actTarget2 = a ? a.t2 || null : null; if (me.act === "kill") me.killVotes = [...room.night.kills].map(([v, t]) => ({ v, t })); me.missing = room.nightFlags.missing === uid; }
  if (["vote", "nominate"].includes(room.phase.name)) me.myVote = (room.phase.name === "vote" ? room.votes : room.noms).get(uid) ?? null;
  if (room.phase.name === "verdict") me.myVerdict = room.verdict.get(uid) ?? null;
  if (room.case) { const c = room.case;
    me.hand = (c.hand.get(uid) || []).map((id) => { const x = c.byId[id]; return x ? { ...x, forged: p.role === "forger" ? !!x.forged : undefined } : null; }).filter(Boolean);
    if (p.role === "detective") me.suspicious = c.shared.filter((id) => c.byId[id]?.forged);
    me.myAccuse = c.accuse.get(uid) ?? null; me.solveTries = c.tries.get(uid) || 0; me.solved = c.solvers.has(uid);
    if (c.culpritId === uid && !c.result) me.culprit = true;
    if (p.role === "tipster" && p.alive) me.truthMemo = c.truthMemo;
  }
  me.can = { scoop: p.alive && p.role === "reporter" && !p.uses.scoop && p.results.some((r) => r.type === "follow" && r.visited && !["blocked", "blackout"].includes(r.visited)),
    negotiate: p.alive && p.role === "negotiator" && usesLeft(p) > 0 && ["vote", "verdict"].includes(room.phase.name),
    forge: p.alive && p.role === "forger" && usesLeft(p) > 0 && room.phase.name === "case",
    testify: p.alive && p.role === "tipster" && usesLeft(p) > 0 && room.phase.name === "case",
    reinv: p.alive && !!reinvAvail(room) && !room.reinv.has(uid) && ["discuss", "case"].includes(room.phase.name) };
  return me;
}

function emitState(io, room) {
  const pub = publicState(room);
  io.to(sr(room.code)).emit("mf:pub", pub);
  io.to(srObs(room.code)).emit("mf:obs", obsView(pub));
  for (const p of room.players.values()) if (p.socketId && p.connected && !p.bot) io.to(p.socketId).emit("mf:me", privateState(room, p.uid));
  for (const [sid, s] of room.spectators) io.to(sid).emit("mf:me", privateState(room, s.uid));
  if (room.mcSocket) io.to(room.mcSocket).emit("mf:me", privateState(room, room.hostId));
}
// OBS: 공개 정보 중에서도 방송에 필요한 것만. 사건 증거는 '공개된 증거 제목'만, 대기열·설정 없음
export function obsView(pub) {
  const v = { ...pub, queue: undefined, settings: undefined, log: pub.log };
  if (v.case) v.case = { ...v.case, puzzle: undefined, shared: v.case.shared.map((x) => ({ id: x.id, kind: x.kind, title: x.title })), sealOpen: v.case.sealOpen ? { title: v.case.sealOpen.title } : null };
  return v;
}
function fx(io, room, type, data = {}) { const e = { type, ...data, seq: room.phase.seq, t: now() }; io.to(sr(room.code)).emit("mf:fx", e); io.to(srObs(room.code)).emit("mf:fx", e); }

// ---------- 시간 ----------
function dur(room) {
  const a = alive(room).length, s = room.settings;
  return { countdown: 5, roles: 11, morning: 7, result: 7, defense: 15, verdict: 12, nominate: 20,
    night: clamp(Math.round(20 + a), 25, a >= BIG ? 32 : 40), discuss: clamp(Math.round((40 + a * 5) * s.discuss), 45, a >= BIG ? 100 : 150), vote: clamp(Math.round((18 + a * 0.6) * s.vote), 20, 35) };
}
function setPhase(io, room, name, sec) {
  clearTimeout(room.timer);
  const ph = room.phase; ph.name = name; ph.seq++; ph.paused = false; ph.remain = 0; ph.planned = sec || 0;
  room.simTime += sec || 0;
  ph.endsAt = sec ? now() + Math.round(sec * 1000 * TS) : 0;
  if (sec) { const seq = ph.seq; room.timer = setTimeout(() => advance(io, room, seq), Math.round(sec * 1000 * TS)); }
  botsAct(io, room);
  emitState(io, room);
}
function advance(io, room, seq) {
  if (rooms.get(room.code) !== room || room.phase.paused) return;
  if (seq != null && seq !== room.phase.seq) return;
  try {
    if (room.status === "lobby" && room.phase.name === "countdown") return startGame(io, room);
    if (room.status !== "playing") return;
    switch (room.phase.name) {
      case "roles": return startNight(io, room);
      case "night": return resolveNight(io, room);
      case "morning": return startDay(io, room);
      case "discuss": return startVote(io, room);
      case "case": return endCase(io, room);
      case "nominate": return endNominate(io, room);
      case "vote": return endVote(io, room);
      case "defense": return startVerdict(io, room);
      case "verdict": return endVerdict(io, room);
      case "hearing": return endHearingPick(io, room);
      case "result": return checkWin(io, room) ? null : startNight(io, room);
    }
  } catch (e) { console.error("[mafia] advance", room.phase.name, e); }
}
function shortenTo(io, room, sec) {
  const ph = room.phase; if (ph.paused || !ph.endsAt || ph.endsAt - now() <= sec * 1000 * TS) return;
  room.simTime -= Math.max(0, (ph.endsAt - now()) / 1000 / TS - sec);
  clearTimeout(room.timer); ph.endsAt = now() + Math.round(sec * 1000 * TS); const seq = ph.seq;
  room.timer = setTimeout(() => advance(io, room, seq), Math.round(sec * 1000 * TS));
}

// ---------- 시작 ----------
function startGame(io, room) {
  const ps = room.order.map((u) => P(room, u));
  if (ps.length < MF_MIN_START) { room.phase.name = "lobby"; return emitState(io, room); }
  const roles = shuffle(buildRoles(ps.length, new Set(room.settings.disabled)));
  Object.assign(room, { status: "playing", winner: null, news: [], log: [], case: null, caseN: 0, forged: [], reinv: new Set(), comeback: {}, usedInc: [], incident: null, forcedIncident: null,
    nightFlags: {}, dayFlags: {}, votes: new Map(), noms: new Map(), cands: null, verdict: new Map(), voteFlags: {}, chat: { all: [], mafia: [], dead: [] }, simTime: 0, startedAt: now() });
  room.view = { jury: new Map(), predict: new Map(), team: new Map(), poll: null, seal: new Set() };
  room.game++; room.phase.day = 0;
  const looks = shuffle([...Array(STAFF_LOOKS.length).keys()]);
  ps.forEach((p, i) => Object.assign(p, { role: roles[i], alive: true, results: [], uses: {}, lastProtect: null, silencedDay: 0, deathDay: 0, deathBy: null, converted: false, goal: null, achieved: false, look: looks[i % looks.length],
    stats: { votesOnMafia: 0, votes: 0, solves: 0, saves: 0, finds: 0, kills: 0 } }));
  for (const p of ps) if (p.role === "opportunist") { const t = pickOne(ps.filter((q) => q !== p)); p.goal = { target: t.uid }; }
  room.queue = room.queue.filter((q) => !room.players.has(q.uid));
  addNews(room, { kind: "start", key: true, text: `${ps.length}명의 출연자가 방송국에 모였습니다. 이 중에 조작단이 숨어 있습니다.` });
  fx(io, room, "roles");
  setPhase(io, room, "roles", dur(room).roles);
}

// ---------- 밤 ----------
function killers(room) {
  const m = alive(room).filter(isMafia);
  for (const r of ["mafia", "traitor", "negotiator", "forger", "informant", "disguiser"]) { const k = m.filter((p) => p.role === r); if (k.length) return k; }
  return [];
}
function actOf(room, p) {
  if (!p?.alive || !p.role) return null;
  if (room.nightFlags.missing === p.uid) return null;
  if (killers(room).includes(p)) return "kill";
  const a = ROLES[p.role].act; if (!a || a === "kill") return null;
  if (usesLeft(p) <= 0) return null;
  return a;
}
function startNight(io, room) {
  // 잠수·무응답 대비: 4일 동안 아무도 하차하지 않으면 방송 시간 초과(무승부)
  const lastDeath = Math.max(0, ...room.order.map((u) => P(room, u)).filter((p) => !p.alive).map((p) => p.deathDay || 0));
  if (room.phase.day - lastDeath >= 4) return endGame(io, room, "none", "4일 동안 아무도 하차하지 않아 방송 시간이 초과됐습니다 (무승부).");
  room.phase.day++;
  room.night = { acts: new Map(), kills: new Map() };
  Object.assign(room, { votes: new Map(), noms: new Map(), cands: null, verdict: new Map(), voteFlags: {}, case: null, incident: null });
  room.dayFlags = {}; room.view.jury = new Map(); room.reinvLost = new Set();
  fx(io, room, "night", { day: room.phase.day });
  setPhase(io, room, "night", dur(room).night);
}
function nightDoneCheck(io, room) {
  if (room.phase.name !== "night") return;
  const need = alive(room).filter((p) => !p.bot && actOf(room, p));
  if (need.length && need.every((p) => (actOf(room, p) === "kill" ? room.night.kills.has(p.uid) : room.night.acts.has(p.uid)))) shortenTo(io, room, 3 + rnd() * 3);
}
function apparentTeam(p, disguised) { let t = teamOf(p); if (disguised.has(p.uid)) t = t === TEAM.MAFIA ? TEAM.TOWN : TEAM.MAFIA; return t; }
function resolveNight(io, room) {
  const N = room.night, F = room.nightFlags, day = room.phase.day, g = (u) => P(room, u);
  room.nightFlags = {};
  const acts = new Map([...N.acts].filter(([u, a]) => u !== F.missing && g(u)?.alive && actOf(room, g(u)) === a.a && (!F.missing || (a.t !== F.missing && a.t2 !== F.missing)) && g(a.t)?.alive));
  const kills = new Map([...N.kills].filter(([u, t]) => u !== F.missing && g(u)?.alive && t !== F.missing && g(t)?.alive && !isMafia(g(t))));
  const visits = [];
  // ① 위장
  const disguised = new Set();
  for (const [u, a] of acts) if (a.a === "disguise") { disguised.add(a.t); visits.push({ v: u, t: a.t }); }
  // ② 보호
  const prot = new Set(), guards = new Map(), vests = new Set();
  for (const [u, a] of acts) {
    if (a.a === "protect") { visits.push({ v: u, t: a.t }); if (F.noProtect !== a.t) prot.add(a.t); g(u).lastProtect = a.t; }
    if (a.a === "guard") { visits.push({ v: u, t: a.t }); if (!guards.has(a.t)) guards.set(a.t, u); }
    if (a.a === "vest") { vests.add(u); g(u).uses.survivor = (g(u).uses.survivor || 0) + 1; }
  }
  for (const p of alive(room)) if (p.role === "medic" && !acts.has(p.uid)) p.lastProtect = null;
  // ③ 습격 (큰 방에서 조작단이 4명 이상이면 2명까지)
  const t0 = {}; for (const [, t] of kills) t0[t] = (t0[t] || 0) + 1;
  const ranked = Object.entries(t0).sort((a, b) => b[1] - a[1] || rnd() - 0.5).map(([t]) => t);
  const nKill = 1;   // 큰 판 2명 습격은 시뮬레이션에서 조작단 압승이라 폐지(11-10)
  const deaths = [], saved = [];
  for (const kt of ranked.slice(0, nKill)) {
    const ex = [...kills].filter(([, t]) => t === kt).map(([u]) => u); const exec = pickOne(ex); visits.push({ v: exec, t: kt });
    if (guards.has(kt) && g(guards.get(kt))?.alive) { const bg = g(guards.get(kt)); bg.alive = false; bg.deathDay = day; bg.deathBy = "night"; deaths.push(bg.uid); saved.push(kt); bg.stats.saves++; addNews(room, { kind: "guard", key: true, text: `경호원이 몸을 던져 ${g(kt).nick} 님을 지켰습니다.`, target: kt }); }
    else if (prot.has(kt) || vests.has(kt)) { saved.push(kt); for (const [u, a] of acts) if (a.a === "protect" && a.t === kt) g(u).stats.saves++; }
    else { const v = g(kt); v.alive = false; v.deathDay = day; v.deathBy = "night"; deaths.push(kt); g(exec).stats.kills++; }
  }
  // ④ 정보
  const blind = !!F.blackout, camOff = blind || !!F.cctvOff;
  for (const [u, a] of acts) {
    const p = g(u), tp = g(a.t);
    if (a.a === "check") { const r = blind ? "blackout" : apparentTeam(tp, disguised) === TEAM.MAFIA ? "mafia" : "town"; p.results.push({ day, type: "check", target: a.t, result: r }); if (r === "mafia" && isMafia(tp)) p.stats.finds++; }
    else if (a.a === "compare") { const t2 = g(a.t2); p.results.push({ day, type: "compare", target: a.t, target2: a.t2, result: blind || !t2 ? "blackout" : apparentTeam(tp, disguised) === apparentTeam(t2, disguised) ? "same" : "diff" }); }
    else if (a.a === "spy") p.results.push({ day, type: "spy", target: a.t, result: blind ? "blackout" : tp.role });
    else if (a.a === "watch") p.results.push({ day, type: "watch", target: a.t, visitors: camOff ? "blackout" : shuffle([...new Set(visits.filter((x) => x.t === a.t && x.v !== u).map((x) => x.v))]) });
    else if (a.a === "follow") { const went = visits.filter((x) => x.v === a.t).map((x) => x.t); p.results.push({ day, type: "follow", target: a.t, visited: camOff ? "blackout" : went[0] || null }); }
    else if (a.a === "analyze") { const trace = disguised.has(a.t) || (tp.role === "disguiser" && acts.has(a.t)) || room.forged.some((f) => f.by === a.t && f.day >= day - 1); p.results.push({ day, type: "analyze", target: a.t, result: blind ? "blackout" : trace ? "trace" : "clean" }); if (trace && isMafia(tp)) p.stats.finds++; }
    else if (a.a === "protect" || a.a === "guard") p.results.push({ day, type: a.a, target: a.t, result: saved.includes(a.t) ? "saved" : "quiet" });
    else if (a.a === "disguise") p.results.push({ day, type: "disguise", target: a.t });
    else if (a.a === "vest") p.results.push({ day, type: "vest", result: saved.includes(u) ? "saved" : "quiet" });
  }
  for (const k of killers(room)) if (N.kills.has(k.uid)) k.results.push({ day, type: "kill", target: N.kills.get(k.uid), result: deaths.length ? "done" : saved.length ? "saved" : "none" });
  room.night = null;
  for (const d of deaths) if (g(d).role !== "bodyguard" || !saved.length) addNews(room, { kind: "death", key: true, text: `${g(d).nick} 님이 밤사이 방송국에서 사라졌습니다.`, target: d, role: room.settings.revealOnDeath ? g(d).role : null });
  if (!deaths.length) addNews(room, saved.length ? { kind: "saved", key: true, text: "누군가 습격당했지만 무사합니다." } : { kind: "quiet", text: "조용한 밤이었습니다. 아무도 사라지지 않았습니다." });
  // ⑤ 배신자
  convertTraitor(room);
  fx(io, room, "morning", { deaths, saved: saved.length > 0 });
  if (checkWin(io, room)) return;
  room.incident = rollIncident(room);
  setPhase(io, room, "morning", dur(room).morning + (room.incident ? 6 : 0));
}
function convertTraitor(room, force) {
  const t = alive(room).find((p) => p.role === "traitor" && !p.converted); if (!t) return false;
  if (!force && alive(room).filter(isMafia).length !== 1) return false;
  t.converted = true; t.results.push({ day: room.phase.day, type: "convert" });
  for (const m of alive(room).filter(isMafia)) if (m !== t) m.results.push({ day: room.phase.day, type: "newmate", target: t.uid });
  return true;
}

// ---------- 특별 사건 ----------
const CASE_PRI = ["alibi_clash", "fake_news", "sns_post", "access_log", "contract", "secret_msg", "evidence_damage", "fake_id"];
function eligible(room, id) {
  const A = alive(room), maf = A.filter(isMafia), non = A.filter((p) => !isMafia(p)), I = INCIDENTS[id], has = (r) => A.some((p) => p.role === r);
  if (room.usedInc.includes(id) && I.kind !== "case") return false;
  if (I.kind === "case") return A.length >= 4 && room.caseN < (room.order.length >= 12 ? 3 : 2);
  switch (id) {
    case "threat": return non.length >= 2 && has("medic");
    case "cctv_broken": return has("watcher") || has("reporter");
    case "missing": return A.length >= 6;
    case "blackout": return ["investigator", "detective", "watcher", "reporter", "analyst", "informant"].some(has);
    case "anon_tip": return non.length >= 2;
    case "secret_meeting": return maf.length >= 1 && non.length >= 1;
    case "donation": return room.order.some((u) => P(room, u).role === "negotiator");
    case "whistle": return room.order.some((u) => ROLES[P(room, u).role].team === "neutral");
    case "betrayal": return A.some((p) => p.role === "traitor" && !p.converted) && maf.length >= 1;
    default: return true;
  }
}
function comebackOpen(room) {
  const A = alive(room), maf = A.filter(isMafia).length; return room.phase.day >= 3 && maf >= 1 && maf / A.length >= 0.3;
}
function rollIncident(room) {
  const day = room.phase.day; room.dayFlags = {};
  if (!room.settings.incidents && !room.forcedIncident) return null;
  let id = null;
  if (room.forcedIncident && (eligible(room, room.forcedIncident) || INCIDENTS[room.forcedIncident].kind === "comeback")) id = room.forcedIncident;
  room.forcedIncident = null;
  const poll = room.view.poll; if (!id && poll?.kind === "incident" && poll.closed && poll.winner != null) { const w = poll.options[poll.winner]?.id; if (w && eligible(room, w)) id = w; room.view.poll = null; }
  if (!id && room.comeback.pending) { id = room.comeback.pending; room.comeback.pending = null; }
  if (!id && comebackOpen(room) && !room.comeback.used && rnd() < 0.5) { id = alive(room).length >= 6 && rnd() < 0.5 ? "hearing" : "key_evidence"; room.comeback.used = id; }
  if (!id && day >= 2 && room.caseN === 0 && alive(room).length >= 4) id = pickOne(CASE_PRI.slice(0, 4));
  if (!id && day >= 2 && rnd() < 0.5) {
    const pool = Object.entries(INCIDENTS).filter(([k, v]) => v.w > 0 && eligible(room, k) && !(v.kind === "case" && room.caseN > 0 && day - (room.lastCaseDay || 0) < 2));
    const tot = pool.reduce((s, [, v]) => s + v.w, 0); let r = rnd() * tot;
    for (const [k, v] of pool) { r -= v.w; if (r <= 0) { id = k; break; } }
  }
  if (!id) return null;
  room.usedInc.push(id);
  return applyIncident(room, id);
}
function applyIncident(room, id) {
  const I = INCIDENTS[id], inc = { id, title: I.title, desc: I.desc, text: "" }, A = alive(room), maf = A.filter(isMafia), non = A.filter((p) => !isMafia(p));
  switch (id) {
    case "leak": inc.text = `방송국 안에 조작단이 ${maf.length}명 남아 있습니다.`; break;
    case "threat": { const v = pickOne(non); room.nightFlags.noProtect = v.uid; inc.text = `협박장 수신자: ${v.nick}. 오늘 밤 이 사람은 보호받을 수 없습니다.`; inc.target = v.uid; break; }
    case "cctv_broken": room.nightFlags.cctvOff = true; break;
    case "anon_tip": { const v = pickOne(non); inc.text = `${v.nick} 님은 조작단이 아닙니다(검증된 제보).`; inc.target = v.uid; break; }
    case "broadcast_fail": room.dayFlags.anonymous = true; break;
    case "missing": { const v = pickOne(A); room.nightFlags.missing = v.uid; inc.text = `${v.nick} 님과 연락이 끊겼습니다. 오늘 밤 행동할 수도, 대상이 될 수도 없습니다.`; inc.target = v.uid; break; }
    case "secret_meeting": { const a = pickOne(maf), b = pickOne(non), pair = shuffle([a, b]); inc.text = `${pair[0].nick} 님과 ${pair[1].nick} 님이 몰래 만났습니다. 둘 중 정확히 한 명이 조작단입니다.`; break; }
    case "donation": inc.text = `협상가는 지금 ${A.some((p) => p.role === "negotiator") ? "살아 있습니다" : "방송국에 없습니다"}.`; break;
    case "whistle": inc.text = `살아 있는 중립 인원: ${A.filter((p) => ROLES[p.role].team === "neutral" && !(p.role === "traitor")).length + A.filter((p) => p.role === "traitor" && !p.converted).length}명.`; break;
    case "blackout": room.nightFlags.blackout = true; break;
    case "betrayal": convertTraitor(room, true); inc.text = "누군가 진영을 바꿨습니다."; break;
    case "hearing": room.dayFlags.hearing = true; room.comeback.used = "hearing"; break;
    case "reinvestigate": { const f = room.forged.find((x) => !x.exposed); if (f) { f.exposed = true; const by = P(room, f.by); inc.text = `조작된 증거 '${f.title}'이(가) 밝혀졌습니다. 조작범은 ${by?.nick} 님입니다!`; inc.target = f.by; if (by) by.stats.exposed = 1; } room.reinv = new Set(); break; }
  }
  if (I.kind === "case" || id === "key_evidence") room.dayFlags.caseId = id;
  addNews(room, { kind: "incident", key: true, text: `[속보] ${I.title} — ${inc.text || I.desc}`, incident: id, target: inc.target });
  return inc;
}
const reinvAvail = (room) => room.forged.find((f) => !f.exposed && room.status === "playing");
const reinvNeed = (room) => Math.max(2, Math.ceil(alive(room).length * 0.25));

// ---------- 낮 ----------
function startDay(io, room) {
  const d = dur(room);
  if (room.dayFlags.caseId) return startCase(io, room, room.dayFlags.caseId, d.discuss + 40);
  if (room.dayFlags.hearing) { fx(io, room, "hearing"); room.noms = new Map(); return setPhase(io, room, "hearing", Math.max(40, Math.round(d.discuss * 0.6))); }
  fx(io, room, "day", { day: room.phase.day });
  setPhase(io, room, "discuss", d.discuss);
}
function startCase(io, room, id, sec) {
  const A = alive(room), I = INCIDENTS[id], comeback = id === "key_evidence";
  const maf = A.filter(isMafia), non = A.filter((p) => !isMafia(p)), r = rnd();
  let culprit;
  if (comeback && maf.length) culprit = pickOne(maf);
  else if (r < 0.2) culprit = NPC; else if (r < 0.62 && maf.length) culprit = pickOne(maf); else culprit = pickOne(non.length ? non : maf);
  const pool = shuffle(A.filter((p) => p !== culprit)).slice(0, culprit === NPC ? 4 : 3).map((p) => ({ id: p.uid, nick: p.nick }));
  const suspects = shuffle([...pool, culprit === NPC ? { ...NPC } : { id: culprit.uid, nick: culprit.nick }]);
  if (culprit !== NPC && !suspects.some((s) => s.id === "npc") && rnd() < 0.5) suspects.push({ ...NPC });
  const c = makeCase(I.mg, suspects, culprit === NPC ? "npc" : culprit.uid, rnd);
  c.incident = id; c.comeback = comeback;
  c.byId = Object.fromEntries(c.clues.map((x) => [x.id, x])); if (c.reward) c.byId[c.reward.id] = c.reward;
  c.shared = c.clues.filter((x) => x.public).map((x) => x.id); c.sharedBy = {};
  c.accuse = new Map(); c.hand = new Map(); c.tries = new Map(); c.solvers = new Set();
  const priv = shuffle(c.clues.filter((x) => !x.public).map((x) => x.id));
  // 봉인 증거: 시청자 투표로만 열리는 증거 1장(손패에서 빼지 않음 — 시민이 정보를 잃지 않게 복사본)
  if (room.settings.viewers && priv.length) c.sealed = pickOne(priv);
  const holders = shuffle(A.map((p) => p.uid));
  priv.forEach((cid, i) => { const u = holders[i % holders.length]; if (!c.hand.has(u)) c.hand.set(u, []); c.hand.get(u).push(cid); });
  for (const p of A) if (p.role === "reporter" && priv.length) { const extra = pickOne(priv); const h = c.hand.get(p.uid) || []; if (!h.includes(extra)) h.push(extra); c.hand.set(p.uid, h); }
  room.case = c; room.caseN++; room.lastCaseDay = room.phase.day; room.view.seal = new Set();
  fx(io, room, "case", { title: c.title, mg: c.mg, comeback });
  setPhase(io, room, "case", sec);
}
const sealNeed = (room) => Math.max(5, Math.min(30, Math.ceil(room.view.predict.size * 0.1)));
function endCase(io, room) {
  const c = room.case; if (!c) return startVote(io, room);
  const counts = tally(c.accuse), top = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  let res;
  if (!top.length || (top[1] && top[1][1] === top[0][1])) res = { ok: false, tie: true };
  else if (top[0][0] === c.culpritId) {
    if (c.culpritId === "npc") { res = { ok: true, npc: true }; addNews(room, { kind: "case", key: true, text: `[사건 해결] ${c.title}의 범인은 외부 업체 직원이었습니다! 보상: 남은 조작단 ${alive(room).filter(isMafia).length}명 공개.` }); }
    else { const cp = P(room, c.culpritId); cp.silencedDay = room.phase.day; const team = teamOf(cp);
      res = { ok: true, team }; addNews(room, { kind: "case", key: true, text: `[사건 해결] ${c.title}의 범인은 ${cp.nick}! 소속: ${team === "mafia" ? "조작단" : team === "neutral" ? "중립" : "시민팀"}. 오늘 투표권을 잃습니다.`, target: cp.uid }); }
    for (const p of alive(room)) if (p.role === "tipster") p.achieved = true;
    for (const [u, t] of c.accuse) if (t === c.culpritId && P(room, u)) P(room, u).stats.solves++;
  } else {
    const w = P(room, top[0][0]);
    if (w) w.silencedDay = room.phase.day;
    res = { ok: false, wrong: top[0][0] };
    addNews(room, { kind: "case", key: true, text: `[오보] ${w ? w.nick + " 님이" : "외부 업체 직원이"} 범인으로 몰렸지만 진범은 따로 있었습니다.${w ? " 가짜 뉴스 피해로 오늘 투표권을 잃습니다." : ""}`, target: top[0][0] });
  }
  res.culprit = c.culpritId; c.result = res;
  fx(io, room, "caseEnd", res);
  startVote(io, room, 4);
}
function startNominate(io, room) { room.noms = new Map(); room.cands = null; fx(io, room, "nominate"); setPhase(io, room, "nominate", dur(room).nominate); }
function endNominate(io, room) {
  const t = Object.entries(tally(room.noms)).filter(([u]) => P(room, u)?.alive).sort((a, b) => b[1] - a[1]);
  room.cands = t.length ? t.filter(([, n], i) => i < 3 || n === t[2]?.[1]).slice(0, 4).map(([u]) => u) : null;
  startVote(io, room);
}
function startVote(io, room, delay = 0) {
  room._mafVote = null; room.votes = new Map(); room.verdict = new Map(); room.view.jury = new Map();
  room.voteFlags = { anonymous: !!room.dayFlags.anonymous, majority: !!room.dayFlags.majority, voided: 0, locked: new Set() };
  fx(io, room, "vote");
  setPhase(io, room, "vote", dur(room).vote + delay);
}
const canVote = (room, p) => p?.alive && p.silencedDay !== room.phase.day && !room.reinvLost?.has(p.uid);
function voteDoneCheck(io, room, map) { const el = alive(room).filter((p) => canVote(room, p) && !room.voteFlags.locked?.has(p.uid)); if (el.length && el.every((p) => map.has(p.uid))) shortenTo(io, room, 2.5); }
function endVote(io, room) {
  const counts = {}; let skip = 0;
  for (const [v, t] of room.votes) { if (!canVote(room, P(room, v)) || t === "void") continue; if (t === "skip") skip++; else if (P(room, t)?.alive) { counts[t] = (counts[t] || 0) + 1; } }
  let jury = null;
  if (room.settings.viewers && room.settings.juryWeight === 1 && room.view.jury.size >= 3) {
    const jt = Object.entries(tally(room.view.jury)).sort((a, b) => b[1] - a[1]);
    if (jt.length && !(jt[1] && jt[1][1] === jt[0][1])) { const p = alive(room).find((q) => q.seat === Number(jt[0][0])); if (p && (!room.cands || room.cands.includes(p.uid))) { jury = p.uid; counts[p.uid] = (counts[p.uid] || 0) + 1; } }
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const voters = alive(room).filter((p) => canVote(room, p)).length;
  let why = "pick", acc = null;
  if (!top.length) why = "novotes"; else if (top[1] && top[1][1] === top[0][1]) why = "tie"; else if (top[0][1] <= skip) why = "skip";
  else if (room.voteFlags.majority && top[0][1] <= voters / 2) why = "majority"; else acc = top[0][0];
  room.voteFlags.outcome = { why, top: top[0] ? top[0][1] : 0, skip, jury };
  for (const [v, t] of room.votes) { const p = P(room, v); if (p && t !== "skip" && t !== "void") { p.stats.votes++; if (isMafia(P(room, t))) p.stats.votesOnMafia++; } }
  if (!acc) return noElimination(io, room, why);
  if (alive(room).length >= 18 && !room.voteFlags.majority) return bigElimination(io, room, top, skip);
  room.voteFlags.accused = acc;
  fx(io, room, "accused", { uid: acc });
  setPhase(io, room, "defense", dur(room).defense);
}
function startVerdict(io, room) {
  if (room.dayFlags.hearing) room.voteFlags.hearingVote = true;
  room.verdict = new Map(); room.voteFlags.locked = new Set(); fx(io, room, "verdict");
  setPhase(io, room, "verdict", dur(room).verdict);
}
function endVerdict(io, room) {
  const acc = room.voteFlags.accused, a = P(room, acc);
  let yes = 0, no = 0; for (const [v, t] of room.verdict) { if (!canVote(room, P(room, v)) || v === acc) continue; if (t === "yes") yes++; else if (t === "no") no++; }
  if (room.dayFlags.hearing) {
    const pass = yes > no && yes > alive(room).length / 2 - 0.5;
    room.dayFlags.hearingResult = pass ? { pass, team: teamOf(a) } : { pass };
    addNews(room, { kind: "hearing", key: true, text: pass ? `[청문회] ${a.nick} 님의 진영은 '${teamOf(a) === "mafia" ? "조작단" : teamOf(a) === "neutral" ? "중립" : "시민팀"}'입니다!` : `[청문회] 찬성이 부족해 ${a.nick} 님의 진영은 공개되지 않았습니다.`, target: acc });
    fx(io, room, "hearingEnd", { uid: acc, pass, team: pass ? teamOf(a) : null });
    room.voteFlags.outcome = { why: "hearing", yes, no };
    return setPhase(io, room, "result", dur(room).result);
  }
  if (!a?.alive || yes <= no) return noElimination(io, room, "acquit", { yes, no });
  a.alive = false; a.deathDay = room.phase.day; a.deathBy = "vote";
  room.voteFlags.outcome = { why: "out", out: acc, yes, no };
  addNews(room, { kind: "out", key: true, text: `찬성 ${yes} · 반대 ${no} — ${a.nick} 님이 방송에서 하차합니다.`, target: acc, role: room.settings.revealOnDeath ? a.role : null });
  for (const p of alive(room).concat(a)) if (p.role === "opportunist" && p.goal?.target === acc && p.alive) { p.achieved = true; p.results.push({ day: room.phase.day, type: "goal" }); }
  convertTraitor(room);
  fx(io, room, "out", { uid: acc, role: room.settings.revealOnDeath ? a.role : null, yes, no });
  setPhase(io, room, "result", dur(room).result + 3);
}
// 큰 판 템포(생존 18명↑): 상위 2명(각 2표 이상·건너뛰기보다 많음, 2위 동점이면 1명만) 바로 하차
function bigElimination(io, room, top, skip) {
  const outs = [top[0][0]];
  if (top[1] && top[1][1] >= 2 && top[1][1] > skip && !(top[2] && top[2][1] === top[1][1])) outs.push(top[1][0]);
  for (const u of outs) {
    const a = P(room, u); a.alive = false; a.deathDay = room.phase.day; a.deathBy = "vote";
    addNews(room, { kind: "out", key: true, text: `투표 결과 ${a.nick} 님이 방송에서 하차합니다.`, target: u, role: room.settings.revealOnDeath ? a.role : null });
    for (const p of room.order.map((x) => P(room, x))) if (p.role === "opportunist" && p.goal?.target === u && p.alive) { p.achieved = true; p.results.push({ day: room.phase.day, type: "goal" }); }
  }
  convertTraitor(room);
  room.voteFlags.outcome = { why: "out2", outs };
  for (const u of outs) fx(io, room, "out", { uid: u, role: room.settings.revealOnDeath ? P(room, u).role : null, yes: tally(room.votes)[u] || 0, no: 0, big: true });
  setPhase(io, room, "result", dur(room).result + 3);
}
function noElimination(io, room, why, ex = {}) {
  room.voteFlags.outcome = { ...(room.voteFlags.outcome || {}), why, ...ex };
  const T = { tie: "동점! 아무도 하차하지 않습니다.", skip: "건너뛰기 표가 많아 아무도 하차하지 않습니다.", majority: "과반 득표가 나오지 않아 아무도 하차하지 않습니다.", acquit: "반대가 많아 무죄! 아무도 하차하지 않습니다.", novotes: "투표가 없어 아무도 하차하지 않습니다." };
  addNews(room, { kind: "noout", text: T[why] || "아무도 하차하지 않습니다." });
  fx(io, room, "noout", { why });
  setPhase(io, room, "result", dur(room).result);
}
function endHearingPick(io, room) {
  const t = Object.entries(tally(room.noms)).filter(([u]) => P(room, u)?.alive).sort((a, b) => b[1] - a[1]);
  if (!t.length || (t[1] && t[1][1] === t[0][1])) { addNews(room, { kind: "hearing", text: "[청문회] 증인을 정하지 못했습니다." }); return setPhase(io, room, "result", dur(room).result); }
  room.voteFlags = { accused: t[0][0], locked: new Set() };
  fx(io, room, "accused", { uid: t[0][0], hearing: true });
  setPhase(io, room, "defense", dur(room).defense);
}

// ---------- 승리 ----------
function checkWin(io, room) {
  const A = alive(room), maf = A.filter(isMafia).length, other = A.length - maf;
  let team = null, reason = "";
  if (maf === 0) { team = "town"; reason = "조작단이 모두 하차했습니다."; } else if (maf >= other) { team = "mafia"; reason = "조작단이 방송국을 장악했습니다."; }
  if (!team) return false;
  endGame(io, room, team, reason); return true;
}
function endGame(io, room, team, reason) {
  clearTimeout(room.timer); room.status = "ended";
  const all = room.order.map((u) => P(room, u));
  const winners = all.filter((p) => {
    if (p.role === "survivor") return p.alive; if (p.role === "opportunist" || p.role === "tipster") return p.achieved;
    return teamOf(p) === team;
  }).map((p) => p.uid);
  const mafSeats = new Set(all.filter(isMafia).map((p) => p.seat));
  const V = room.view, hits = [...V.predict].filter(([, s]) => mafSeats.has(s.seat)), teamHits = [...V.team].filter(([, t]) => t === team).length;
  // MVP: 승리팀에서 기여 점수 최고 (조작단 적중 표·사건 해결·보호·발견·습격)
  const score = (p) => p.stats.votesOnMafia * 2 + p.stats.solves * 3 + p.stats.saves * 4 + p.stats.finds * 4 + p.stats.kills * 2 + (p.alive ? 1 : 0);
  const mvpP = all.filter((p) => winners.includes(p.uid)).sort((a, b) => score(b) - score(a))[0] || null;
  room.winner = { team, reason, winners, mvp: mvpP ? { uid: mvpP.uid, why: mvpP.stats.finds ? "조작단 발견" : mvpP.stats.saves ? "동료 구출" : mvpP.stats.solves ? "사건 해결" : mvpP.stats.kills ? "완벽한 습격" : mvpP.stats.votesOnMafia ? "날카로운 투표" : "끝까지 생존" } : null,
    predict: { total: V.predict.size, hits: hits.length, names: hits.slice(0, 10).map(([, s]) => s.nick), teamTotal: V.team.size, teamHits }, days: room.phase.day, simSec: Math.round(room.simTime) };
  addNews(room, { kind: "end", key: true, text: `${team === "town" ? "시민팀" : team === "mafia" ? "조작단" : ""} 승리! ${reason}` });
  room.phase.name = "end"; room.phase.seq++; room.phase.endsAt = 0;
  room.history.push({ game: room.game, team, at: now() }); if (room.history.length > 20) room.history.shift();
  for (const p of all) p.ready = p.bot || room.hostId === p.uid;
  fx(io, room, "win", { team, winners, mvp: room.winner.mvp });
  emitState(io, room);
  clearTimeout(room.endedTimer);
  room.endedTimer = setTimeout(() => { const r = rooms.get(room.code); if (r && r.status === "ended" && !humans(r).some((p) => p.connected) && !r.mcSocket) deleteRoom(io, r, "ENDED_IDLE"); }, ENDED_TTL);
  room.onEnd?.(room);
}

// ---------- 봇 (시뮬레이션용 단순 추리) ----------
const BOT_NAMES = ["봇 하루", "봇 도윤", "봇 서아", "봇 지호", "봇 민준", "봇 유나", "봇 시우", "봇 하린", "봇 예준", "봇 수아", "봇 이안", "봇 채원", "봇 준우", "봇 다은", "봇 건우", "봇 소율", "봇 은우", "봇 지안", "봇 로이", "봇 나은", "봇 태오", "봇 리아", "봇 우진", "봇 아린", "봇 선우", "봇 시아", "봇 현우", "봇 가온", "봇 라온"];
const BOT_LINES = ["저는 아니에요!", "어젯밤 너무 조용했는데…", "증거부터 보죠.", "저 사람 말이 좀 이상해요.", "기자님 정보 있어요?", "일단 넘기고 내일 봐요."];
function suspicion(room) {
  // 공개된 사실 + 봇이 공개적으로 말한 조사 결과로 의심 점수
  const s = {};
  const add = (u, v) => { if (u) s[u] = (s[u] || 0) + v; };
  for (const n of room.news) { if (n.kind === "incident" && n.incident === "anon_tip") add(n.target, -9); if (n.kind === "case" && /조작단/.test(n.text) && n.target) add(n.target, 9); if (n.kind === "hearing" && /조작단/.test(n.text)) add(n.target, 9); if (n.kind === "hearing" && /시민팀/.test(n.text)) add(n.target, -6); if (n.incident === "reinvestigate") add(n.target, 9); }
  for (const c of room.claims || []) add(c.t, c.v);
  return s;
}
function botsAct(io, room) {
  if (room.status !== "playing") return;
  const name = room.phase.name, seq = room.phase.seq, left = Math.max(2, room.phase.endsAt - now());
  for (const p of room.players.values()) {
    if (!p.bot || !p.alive) continue;
    const later = (fn, f = 0.7) => setTimeout(() => { if (rooms.get(room.code) === room && room.phase.seq === seq && p.alive) { try { fn(); emitState(io, room); } catch (e) { console.error("[mafia] bot", e); } } }, left * (0.1 + rnd() * f));
    const others = () => alive(room).filter((q) => q.uid !== p.uid);
    const sus = () => suspicion(room);
    const myInfo = (u) => { let v = 0; for (const r of p.results) { if (r.target === u && r.type === "check") v += r.result === "mafia" ? 8 : r.result === "town" ? -8 : 0; if (r.target === u && r.type === "analyze" && r.result === "trace") v += 4; } return v; };
    const townPick = (list) => { const S = sus(); const sc = list.map((q) => ({ q, v: (S[q.uid] || 0) + myInfo(q.uid) + rnd() * 2 })).sort((a, b) => b.v - a.v); return sc[0]?.v > 3 ? sc[0].q : null; };
    const townVote = (list) => { const S = sus(); const sc = list.map((q) => ({ q, v: (S[q.uid] || 0) + myInfo(q.uid) + rnd() * 3 })).filter((x) => x.v > -4).sort((a, b) => b.v - a.v); return sc[0]?.q || null; };
    if (name === "night") {
      const a = actOf(room, p); if (!a) continue;
      later(() => {
        let ts = others();
        if (a === "kill") { ts = ts.filter((q) => !isMafia(q)); const claimed = ts.filter((q) => (room.claimers || new Set()).has(q.uid)); if (claimed.length && rnd() < 0.45) ts = claimed; }
        if (a === "protect") { ts = alive(room).filter((q) => q.uid !== p.lastProtect); const cl = ts.filter((q) => (room.claimers || new Set()).has(q.uid)); if (cl.length && rnd() < 0.35) ts = cl; }
        if (a === "vest") { if (rnd() < 0.35) room.night.acts.set(p.uid, { a, t: p.uid }); return; }
        if (a === "check") { const done = new Set(p.results.filter((r) => r.type === "check").map((r) => r.target)); const fresh = ts.filter((q) => !done.has(q.uid)); if (fresh.length) ts = fresh; }
        if (!ts.length) return; const t = pickOne(ts).uid;
        if (a === "kill") room.night.kills.set(p.uid, t);
        else if (a === "compare") { const t2 = pickOne(others().filter((q) => q.uid !== t)); if (t2) room.night.acts.set(p.uid, { a, t, t2: t2.uid }); }
        else room.night.acts.set(p.uid, { a, t });
      });
    } else if (name === "morning") {
      // 정보 직업 봇은 결과를 공개적으로 말함(조작단 봇은 가끔 거짓말)
      const last = p.results[p.results.length - 1];
      if (last && last.day === room.phase.day - 0 && (last.type === "check" || last.type === "analyze") && rnd() < 0.75 && !isMafia(p)) {
        later(() => { (room.claims ||= []).push({ t: last.target, v: last.result === "mafia" || last.result === "trace" ? 6 : last.result === "town" ? -5 : 0 }); (room.claimers ||= new Set()).add(p.uid); pushChat(io, room, p, "all", `${P(room, last.target)?.nick} 님 조사 결과: ${last.result === "mafia" ? "조작단" : last.result === "trace" ? "조작 흔적" : "시민"}`); }, 0.5);
      } else if (isMafia(p) && rnd() < 0.15) {
        later(() => { const v = pickOne(others().filter((q) => !isMafia(q))); if (v) { (room.claims ||= []).push({ t: v.uid, v: 4 }); pushChat(io, room, p, "all", `${v.nick} 님이 수상해요. 제가 조사했어요!`); } }, 0.5);
      }
    } else if (name === "nominate" || name === "hearing") {
      later(() => { const ts = others().filter((q) => !(isMafia(p) && isMafia(q))); const t = (!isMafia(p) && townPick(ts)) || pickOne(ts); if (t) room.noms.set(p.uid, t.uid); });
    } else if (name === "vote") {
      if (!canVote(room, p)) continue;
      later(() => { let ts = others(); if (room.cands) ts = ts.filter((q) => room.cands.includes(q.uid)); ts = ts.filter((q) => !(isMafia(p) && isMafia(q)));
        const t = isMafia(p) ? (rnd() < 0.85 ? (room._mafVote && ts.find((q) => q.uid === room._mafVote)) || ((room._mafVote = pickOne(ts.filter((q) => !isMafia(q)))?.uid), ts.find((q) => q.uid === room._mafVote)) : null) : rnd() < 0.08 ? null : (() => { const c = {}; for (const [v, x] of room.votes) if (x !== "skip" && x !== "void" && x !== p.uid) c[x] = (c[x] || 0) + 1; const lead = Object.entries(c).sort((a, b) => b[1] - a[1])[0]; const S = sus(); if (lead && lead[1] >= 2 && (S[lead[0]] || 0) + myInfo(lead[0]) > -4 && rnd() < 0.55) return ts.find((q) => q.uid === lead[0]) || townVote(ts); return townVote(ts); })();
        room.votes.set(p.uid, t ? t.uid : "skip"); voteDoneCheck(io, room, room.votes); });
    } else if (name === "verdict") {
      if (!canVote(room, p) || room.voteFlags.accused === p.uid) continue;
      later(() => { const acc = P(room, room.voteFlags.accused); const S = sus(); const v = isMafia(p) ? (isMafia(acc) ? "no" : "yes") : ((S[acc.uid] || 0) + myInfo(acc.uid) > -3 ? (rnd() < 0.75 ? "yes" : "no") : "no"); room.verdict.set(p.uid, v); voteDoneCheck(io, room, room.verdict); });
    } else if (name === "case") {
      later(() => { const c = room.case; if (!c) return;
        // 봇의 퍼즐 풀이 능력: 40%가 정답을 찾음 → 시민은 공유, 조작단은 숨기고 엉뚱한 사람 지목
        if (rnd() < 0.4) { c.solvers.add(p.uid); if (!isMafia(p)) { c.shared.includes(c.reward.id) || c.shared.push(c.reward.id); c.sharedBy[c.reward.id] = p.uid; } }
        const knows = c.shared.includes(c.reward?.id) && !isMafia(p);
        const opts = c.suspects.filter((s) => s.id !== p.uid);
        let t = knows ? c.culpritId : (isMafia(p) ? pickOne(opts.filter((s) => !(P(room, s.id) && isMafia(P(room, s.id))))) : pickOne(opts))?.id ?? c.culpritId;
        if (t === p.uid) t = pickOne(opts).id; c.accuse.set(p.uid, t);
      });
    } else if (name === "discuss" && rnd() < 0.3) later(() => pushChat(io, room, p, "all", pickOne(BOT_LINES)));
  }
}

// ---------- 채팅 ----------
function chatCh(room, p, want) {
  if (room.status !== "playing") return "all";
  if (!p.alive) return "dead";
  if (room.phase.name === "night") return isMafia(p) && want === "mafia" ? "mafia" : null;
  return want === "mafia" && isMafia(p) ? "mafia" : "all";
}
function pushChat(io, room, p, ch, text, o = {}) {
  const msg = { id: rid(), ch, uid: p ? p.uid : room.hostId, nick: p ? p.nick : room.mcNick || "사회자", seat: p ? p.seat : 0, text, t: now(), mc: !!o.mc };
  room.chat[ch].push(msg); if (room.chat[ch].length > 60) room.chat[ch].shift();
  if (ch === "all") return io.to(sr(room.code)).emit("mf:chat", msg);
  for (const q of room.players.values()) { if (!q.socketId || !q.connected) continue; if ((ch === "mafia" && isMafia(q)) || (ch === "dead" && !q.alive)) io.to(q.socketId).emit("mf:chat", msg); }
}
function chatHistory(room, uid) { const p = uid && P(room, uid); let o = room.chat.all.slice(-40); if (p && isMafia(p)) o = o.concat(room.chat.mafia.slice(-30)); if (p && !p.alive) o = o.concat(room.chat.dead.slice(-30)); return o.sort((a, b) => a.t - b.t); }

// ---------- 정리 ----------
function deleteRoom(io, room, reason) {
  clearTimeout(room.timer); clearTimeout(room.emptyTimer); clearTimeout(room.endedTimer);
  rooms.delete(room.code); for (const u of room.order) if (userRoom.get(u) === room.code) userRoom.delete(u);
  io.to(sr(room.code)).emit("mf:closed", { reason }); io.in(sr(room.code)).socketsLeave(sr(room.code)); io.in(srObs(room.code)).socketsLeave(srObs(room.code));
}
function maybeEmpty(io, room) {
  clearTimeout(room.emptyTimer);
  if (humans(room).some((p) => p.connected) || room.mcSocket || room.spectators.size) return;
  room.emptyTimer = setTimeout(() => { const r = rooms.get(room.code); if (r && !humans(r).some((p) => p.connected) && !r.mcSocket && !r.spectators.size) deleteRoom(io, r, "EMPTY"); }, EMPTY_TTL);
}
function passHost(room) { const n = humans(room).find((p) => p.connected && p.uid !== room.hostId); if (!n) return false; room.hostId = n.uid; if (room.hostMode !== "play") { room.hostMode = "play"; room.mcNick = null; room.mcSocket = null; } return true; }
function removePlayer(io, room, uid, why) {
  const p = P(room, uid); if (!p) return;
  if (room.status === "playing") {
    if (p.alive) { p.alive = false; p.deathDay = room.phase.day; p.deathBy = why === "kick" ? "kick" : "left"; addNews(room, { kind: "left", text: `${p.nick} 님이 방송국을 떠났습니다.`, target: uid }); }
    p.connected = false; p.socketId = null; userRoom.delete(uid);
    if (room.night) { room.night.acts.delete(uid); room.night.kills.delete(uid); }
    room.votes.delete(uid); room.verdict.delete(uid);
    if (room.voteFlags.accused === uid && ["defense", "verdict"].includes(room.phase.name)) { noElimination(io, room, "left"); return; }
    if (!checkWin(io, room)) emitState(io, room);
    return;
  }
  room.players.delete(uid); room.order = room.order.filter((u) => u !== uid); seatList(room); userRoom.delete(uid);
  if (room.phase.name === "countdown" && room.players.size < MF_MIN_START) { clearTimeout(room.timer); room.phase.name = "lobby"; room.phase.endsAt = 0; }
}

// ---------- 방송 채팅 (치지직·SOOP·씨미 다리에서 호출) ----------
// !3 · !투표 3 : 배심원(투표 시간) / !예측 3 : 조작단 예측 / !승리 시민·마피아 : 진영 예측 / !사건 2 · !이벤트 1 : 진행자가 연 투표 / !봉인 : 봉인 증거 공개 투표
const CHAT_CAP = 100000;
export function mfExists(code) { return rooms.has(String(code || "").toUpperCase()); }
export function mfChatCommand(code, chatId, nick, text) {
  const room = rooms.get(String(code || "").toUpperCase()); if (!room || room.status !== "playing" || !room.settings.viewers) return null;
  const V = room.view, t = String(text || "").normalize("NFKC").trim(); if (!/^[!！]/.test(t)) return null;
  const capOk = (m) => m.size < CHAT_CAP || m.has(chatId);
  const seatP = (n) => room.order.map((u) => P(room, u)).find((q) => q.seat === Number(n));
  let m;
  if ((m = t.match(/^[!！]\s*예측\s*(\d{1,2})$/))) { const p = seatP(m[1]); if (!p || !capOk(V.predict)) return { ok: false }; V.predict.set(chatId, { seat: p.seat, nick: String(nick || "익명").slice(0, 16) }); room._dirty = true; return { ok: true, kind: "predict" }; }
  if ((m = t.match(/^[!！]\s*승리\s*(시민|마피아|조작단)$/))) { if (!capOk(V.team)) return { ok: false }; V.team.set(chatId, m[1] === "시민" ? "town" : "mafia"); room._dirty = true; return { ok: true, kind: "team" }; }
  if ((m = t.match(/^[!！]\s*(사건|이벤트)\s*(\d)$/))) { const pl = V.poll; if (!pl || pl.closed || (pl.kind === "incident") !== (m[1] === "사건")) return { ok: false }; const i = Number(m[2]) - 1; if (!pl.options[i] || !capOk(pl.votes)) return { ok: false }; pl.votes.set(chatId, i); room._dirty = true; return { ok: true, kind: "poll" }; }
  if (/^[!！]\s*봉인$/.test(t)) { const c = room.case; if (!c?.sealed || c.sealOpen || room.phase.name !== "case") return { ok: false }; if (!capOk(V.seal)) return { ok: false }; V.seal.add(chatId); if (V.seal.size >= sealNeed(room)) { c.sealOpen = true; if (!c.shared.includes(c.sealed)) { c.shared.push(c.sealed); c.sharedBy[c.sealed] = "viewers"; } room._fx = { type: "seal" }; } room._dirty = true; return { ok: true, kind: "seal" }; }
  if ((m = t.match(/^[!！]\s*(?:투표\s*)?(\d{1,2})$/)) && room.phase.name === "vote") { const p = seatP(m[1]); if (!p?.alive || !capOk(V.jury)) return { ok: false }; const dup = V.jury.get(chatId) === p.seat; V.jury.set(chatId, p.seat); room._dirty = true; return { ok: true, kind: "jury", dup }; }
  return null;
}
const EVENT_OPTS = [{ id: "more_talk", label: "토론 30초 연장" }, { id: "question", label: "즉석 질문 카드" }, { id: "spotlight", label: "스포트라이트(무작위 1명 발언권)" }];
const QUESTIONS = ["어젯밤 가장 의심스러웠던 사람은?", "지금 가장 믿는 사람 한 명은?", "당신의 직업을 한 단어 힌트로 말한다면?", "오늘 투표에서 건너뛰기를 해야 할까?", "사건 증거 중 가장 중요한 것은?"];

// ---------- 등록 ----------
let SB = null;
function logStreamer(room) {
  if (!SB || !room.streamer || room.logged) return; room.logged = true;
  const hostP = room.players.get(room.hostId), nick = room.mcNick || hostP?.nick || "방장", guest = String(room.hostId).startsWith("guest_");
  const mode = room.hostMode === "mc" ? "사회자" : room.hostMode === "watch" ? "관전" : "참가자";
  Promise.resolve(SB.from("streamer_chat_log").insert({ platform: "mafia", channel_id: room.code, nickname: nick, content_id: null, content_title: `플듀 마피아 (${room.max}명·${mode})`, content_mode: room.hostMode, room_code: room.code, host_user_id: guest ? null : room.hostId, host_nick: guest ? `게스트 ${nick}` : nick }))
    .then((r) => r?.error && console.error("[mafia] streamer log", r.error.message), () => {});
}
export function registerMafia(io, supabaseAdmin) {
  SB = supabaseAdmin || null;
  setInterval(() => { for (const r of rooms.values()) if (r._dirty) { r._dirty = false; if (r._fx) { fx(io, r, r._fx.type); r._fx = null; } const pub = publicState(r); io.to(sr(r.code)).emit("mf:pub", pub); io.to(srObs(r.code)).emit("mf:obs", obsView(pub)); } }, 800).unref?.();

  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const last = new Map(); const rl = (k, ms) => { const t = now(); if (t - (last.get(k) || 0) < ms) return false; last.set(k, t); return true; };
    const myRoom = () => { const c = userRoom.get(me.id); const r = c && rooms.get(c); if (r) return r; for (const x of rooms.values()) if (x.hostId === me.id) return x; return null; };
    const specRoom = () => [...rooms.values()].find((r) => r.spectators.has(socket.id));
    const isHost = (r) => r && r.hostId === me.id;
    const done = (cb, room, res = { ok: true }) => { cb?.(res); if (room) emitState(io, room); };

    socket.on("mf:create", (pl, cb) => {
      try {
        if (!rl("create", 800)) return cb?.({ ok: false, error: "SLOW" });
        const nick = cleanNick(pl?.nick); if (!nick) return cb?.({ ok: false, error: "NEED_NICK" }); if (BAD_NICK.test(nick)) return cb?.({ ok: false, error: "BAD_NICK" });
        const old = myRoom(); if (old) { if (old.hostId === me.id) { old.mcSocket = null; removePlayer(io, old, me.id, "left"); if (!passHost(old)) deleteRoom(io, old, "HOST_LEFT"); else emitState(io, old); } else { removePlayer(io, old, me.id, "left"); emitState(io, old); } socket.leave(sr(old.code)); }
        const room = createRoom(me, nick, { ...pl, socketId: socket.id });
        socket.join(sr(room.code));
        cb?.({ ok: true, code: room.code, obsKey: room.obsKey }); emitState(io, room); logStreamer(room);
      } catch (e) { console.error("[mf:create]", e); cb?.({ ok: false, error: "INTERNAL" }); }
    });

    socket.on("mf:join", (pl, cb) => {
      try {
        if (!rl("join", 300)) return cb?.({ ok: false, error: "SLOW" });
        const code = String(pl?.code || "").trim().toUpperCase(), room = rooms.get(code);
        if (!room) return cb?.({ ok: false, error: "NOT_FOUND" });
        socket.join(sr(code));
        if (room.players.has(me.id)) { const p = P(room, me.id); p.connected = true; p.socketId = socket.id; userRoom.set(me.id, code); clearTimeout(room.emptyTimer); cb?.({ ok: true, code, rejoin: true, chat: chatHistory(room, me.id) }); return emitState(io, room); }
        if (room.hostId === me.id && room.hostMode !== "play") { room.mcSocket = socket.id; clearTimeout(room.emptyTimer); cb?.({ ok: true, code, mc: true, chat: chatHistory(room, null) }); return emitState(io, room); }
        const nick = cleanNick(pl?.nick);
        const asSpec = (why) => { room.spectators.set(socket.id, { uid: me.id, nick: nick || "관전자" }); clearTimeout(room.emptyTimer); cb?.({ ok: true, code, spectator: true, why, chat: chatHistory(room, null) }); emitState(io, room); };
        if (pl?.spectate) return asSpec("spectate");
        if (room.status !== "lobby") return asSpec("playing");
        if (!nick) return cb?.({ ok: false, error: "NEED_NICK" }); if (BAD_NICK.test(nick)) return cb?.({ ok: false, error: "BAD_NICK" });
        if ([...room.players.values()].some((p) => p.nick === nick) || nick === room.mcNick) return cb?.({ ok: false, error: "NICK_TAKEN" });
        if (room.players.size >= room.max) return asSpec("full");
        const old = myRoom(); if (old && old !== room) { removePlayer(io, old, me.id, "left"); emitState(io, old); }
        room.players.set(me.id, newPlayer(me.id, nick, { isGuest: me.isGuest, socketId: socket.id })); room.order.push(me.id); seatList(room); userRoom.set(me.id, code);
        room.queue = room.queue.filter((q) => q.uid !== me.id); for (const [sid, s] of room.spectators) if (s.uid === me.id) room.spectators.delete(sid);
        clearTimeout(room.emptyTimer);
        fx(io, room, "enter", { uid: me.id });
        cb?.({ ok: true, code, chat: chatHistory(room, me.id) }); emitState(io, room);
      } catch (e) { console.error("[mf:join]", e); cb?.({ ok: false, error: "INTERNAL" }); }
    });

    socket.on("mf:ready", (pl, cb) => { const room = myRoom(); const p = room && P(room, me.id); if (!p || room.status === "playing") return cb?.({ ok: false }); p.ready = !!pl?.ready; done(cb, room); });

    socket.on("mf:queue", (pl, cb) => {
      const room = rooms.get(String(pl?.code || "").toUpperCase()); if (!room) return cb?.({ ok: false, error: "NOT_FOUND" });
      const nick = cleanNick(pl?.nick); if (!nick || BAD_NICK.test(nick)) return cb?.({ ok: false, error: "NEED_NICK" });
      if (room.players.has(me.id)) return cb?.({ ok: false, error: "ALREADY_PLAYER" });
      if (pl?.leave) room.queue = room.queue.filter((q) => q.uid !== me.id);
      else { const q = room.queue.find((x) => x.uid === me.id); if (q) { q.socketId = socket.id; q.nick = nick; } else { if (room.queue.length >= 60) return cb?.({ ok: false, error: "QUEUE_FULL" }); room.queue.push({ uid: me.id, nick, socketId: socket.id, at: now() }); } }
      done(cb, room);
    });

    socket.on("mf:obs", (pl, cb) => {
      const room = rooms.get(String(pl?.code || "").toUpperCase());
      if (!room || pl?.key !== room.obsKey) return cb?.({ ok: false, error: "BAD_KEY" });
      socket.join(srObs(room.code)); cb?.({ ok: true, state: obsView(publicState(room)) });
    });

    socket.on("mf:leave", (_pl, cb) => {
      const sp = specRoom(); if (sp) { sp.spectators.delete(socket.id); socket.leave(sr(sp.code)); emitState(io, sp); maybeEmpty(io, sp); }
      const room = myRoom(); if (!room) return cb?.({ ok: true });
      if (room.hostId === me.id) { room.mcSocket = null; removePlayer(io, room, me.id, "left"); if (!passHost(room)) { deleteRoom(io, room, "HOST_LEFT"); return cb?.({ ok: true }); } }
      else removePlayer(io, room, me.id, "left");
      socket.leave(sr(room.code)); emitState(io, room); maybeEmpty(io, room); cb?.({ ok: true });
    });

    socket.on("mf:settings", (pl, cb) => {
      const room = myRoom(); if (!isHost(room)) return cb?.({ ok: false, error: "NOT_HOST" }); if (room.status === "playing") return cb?.({ ok: false, error: "PLAYING" });
      room.settings = sanitizeSettings(pl?.settings, room.settings);
      if (MF_ALLOWED_MAX.includes(Number(pl?.max)) && Number(pl.max) >= room.players.size) room.max = Number(pl.max);
      if (pl?.streamer != null) room.streamer = !!pl.streamer;
      done(cb, room); logStreamer(room);
    });

    socket.on("mf:bots", (pl, cb) => {
      const room = myRoom(); if (!isHost(room)) return cb?.({ ok: false, error: "NOT_HOST" }); if (room.status === "playing") return cb?.({ ok: false, error: "PLAYING" });
      if (pl?.remove) { for (const p of [...room.players.values()]) if (p.bot) { room.players.delete(p.uid); room.order = room.order.filter((u) => u !== p.uid); } seatList(room); return done(cb, room); }
      const n = clamp(Number(pl?.n) || 1, 1, 30), used = new Set([...room.players.values()].map((p) => p.nick));
      for (let i = 0; i < n && room.players.size < room.max; i++) { const nm = BOT_NAMES.find((x) => !used.has(x)) || `봇 ${rid().slice(0, 3)}`; used.add(nm); const id = "bot_" + rid(); room.players.set(id, newPlayer(id, nm, { bot: true })); room.order.push(id); }
      seatList(room); done(cb, room);
    });

    socket.on("mf:kick", (pl, cb) => {
      const room = myRoom(); if (!isHost(room)) return cb?.({ ok: false, error: "NOT_HOST" });
      const uid = String(pl?.uid || ""); if (uid === me.id || !room.players.has(uid)) return cb?.({ ok: false, error: "BAD_TARGET" });
      const sid = P(room, uid).socketId; removePlayer(io, room, uid, "kick");
      if (sid) { io.to(sid).emit("mf:kicked", {}); io.in(sid).socketsLeave(sr(room.code)); }
      done(cb, room);
    });

    socket.on("mf:start", (pl, cb) => {
      const room = myRoom(); if (!isHost(room)) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing" || room.phase.name === "countdown") return cb?.({ ok: false, error: "PLAYING" });
      if (room.status === "ended") { for (const p of [...room.players.values()]) if (!p.bot && !p.connected) { room.players.delete(p.uid); room.order = room.order.filter((u) => u !== p.uid); userRoom.delete(p.uid); } room.status = "lobby"; room.phase.name = "lobby"; room.winner = null; seatList(room); }
      if (pl?.fillQueue) {
        for (const q of [...room.queue]) {
          if (room.players.size >= room.max) break;
          const s = io.sockets.sockets.get(q.socketId); room.queue = room.queue.filter((x) => x !== q); if (!s || userRoom.has(q.uid)) continue;
          if ([...room.players.values()].some((p) => p.nick === q.nick)) q.nick = (q.nick + rid().slice(0, 2)).slice(0, NICK_MAX);
          room.players.set(q.uid, newPlayer(q.uid, q.nick, { socketId: q.socketId, isGuest: s.user?.isGuest })); room.order.push(q.uid); userRoom.set(q.uid, room.code);
          for (const [sid, sp] of room.spectators) if (sp.uid === q.uid) room.spectators.delete(sid);
          io.to(q.socketId).emit("mf:promoted", { code: room.code });
        }
        seatList(room);
      }
      if (room.players.size < MF_MIN_START) { emitState(io, room); return cb?.({ ok: false, error: "NEED_PLAYERS", need: MF_MIN_START }); }
      const notReady = humans(room).filter((p) => !p.ready && p.uid !== room.hostId && p.connected);
      if (notReady.length && !pl?.force) return cb?.({ ok: false, error: "NOT_READY", n: notReady.length });
      fx(io, room, "countdown"); setPhase(io, room, "countdown", dur(room).countdown); cb?.({ ok: true });
    });

    socket.on("mf:host", (pl, cb) => {
      const room = myRoom(); if (!isHost(room)) return cb?.({ ok: false, error: "NOT_HOST" });
      const ph = room.phase, cmd = pl?.cmd;
      if (cmd === "cancel" && ph.name === "countdown") { clearTimeout(room.timer); ph.name = "lobby"; ph.endsAt = 0; return done(cb, room); }
      if (room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      if (cmd === "extend" && ph.endsAt && !ph.paused) { clearTimeout(room.timer); ph.endsAt += 30000 * TS; room.simTime += 30; const seq = ph.seq; room.timer = setTimeout(() => advance(io, room, seq), ph.endsAt - now()); }
      else if (cmd === "skip") { if (!rl("skip", 1200)) return cb?.({ ok: false, error: "SLOW" }); ph.paused = false; clearTimeout(room.timer); advance(io, room, ph.seq); return cb?.({ ok: true }); }
      else if (cmd === "pause" && !ph.paused && ph.endsAt) { clearTimeout(room.timer); ph.paused = true; ph.remain = Math.max(1000, ph.endsAt - now()); }
      else if (cmd === "resume" && ph.paused) { ph.paused = false; ph.endsAt = now() + ph.remain; const seq = ph.seq; room.timer = setTimeout(() => advance(io, room, seq), ph.remain); ph.remain = 0; }
      else if (cmd === "incident" && INCIDENTS[pl?.id] && INCIDENTS[pl.id].kind !== "comeback") room.forcedIncident = pl.id;
      else if (cmd === "poll" && room.settings.viewers) {
        if (pl?.kind === "incident") { const opts = shuffle(Object.keys(INCIDENTS).filter((k) => INCIDENTS[k].kind !== "comeback" && eligible(room, k))).slice(0, 3).map((k) => ({ id: k, label: INCIDENTS[k].title })); if (opts.length < 2) return cb?.({ ok: false, error: "NO_OPTIONS" }); room.view.poll = { kind: "incident", options: opts, votes: new Map() }; }
        else room.view.poll = { kind: "event", options: EVENT_OPTS, votes: new Map() };
        fx(io, room, "poll", { kind: room.view.poll.kind });
      }
      else if (cmd === "closePoll" && room.view.poll && !room.view.poll.closed) {
        const pl2 = room.view.poll; pl2.closed = true; const t = Object.entries(tally(pl2.votes)).sort((a, b) => b[1] - a[1]); pl2.winner = t.length ? Number(t[0][0]) : null;
        if (pl2.kind === "event" && pl2.winner != null) { const ev = pl2.options[pl2.winner].id;
          if (ev === "more_talk" && ["discuss", "case"].includes(ph.name) && ph.endsAt) { clearTimeout(room.timer); ph.endsAt += 30000 * TS; const seq = ph.seq; room.timer = setTimeout(() => advance(io, room, seq), ph.endsAt - now()); }
          if (ev === "question") addNews(room, { kind: "event", text: `[시청자 이벤트] 즉석 질문: ${pickOne(QUESTIONS)}` });
          if (ev === "spotlight") { const v = pickOne(alive(room)); addNews(room, { kind: "event", text: `[시청자 이벤트] 스포트라이트! ${v.nick} 님이 30초 동안 먼저 이야기해 주세요.`, target: v.uid }); }
          room.view.poll = { ...pl2 }; }
        fx(io, room, "pollEnd", { kind: pl2.kind, winner: pl2.winner });
      }
      else if (cmd === "end") { endGame(io, room, "none", "진행자가 게임을 끝냈습니다."); return cb?.({ ok: true }); }
      else return cb?.({ ok: false, error: "BAD_CMD" });
      done(cb, room);
    });

    // 밤 행동 (마감 직전 요청: 단계가 이미 바뀌었으면 거절 → 결과는 서버 기준 한 번만)
    socket.on("mf:act", (pl, cb) => {
      const room = myRoom(); if (!room || room.phase.name !== "night" || !room.night) return cb?.({ ok: false, error: "NOT_NIGHT" });
      if (pl?.seq != null && pl.seq !== room.phase.seq) return cb?.({ ok: false, error: "STALE" });
      const p = P(room, me.id), a = actOf(room, p); if (!a) return cb?.({ ok: false, error: "NO_ACTION" });
      if (pl?.target == null) { room.night.acts.delete(me.id); room.night.kills.delete(me.id); return done(cb, room); }
      const t = String(pl.target), tp = P(room, t);
      if (!tp?.alive) return cb?.({ ok: false, error: "BAD_TARGET" });
      if (room.nightFlags.missing === t) return cb?.({ ok: false, error: "MISSING" });
      if (a === "kill" && isMafia(tp)) return cb?.({ ok: false, error: "TEAMMATE" });
      if (a === "protect" && p.lastProtect === t) return cb?.({ ok: false, error: "SAME_PROTECT" });
      if (a === "vest" && t !== me.id) return cb?.({ ok: false, error: "SELF_ONLY" });
      if (["check", "follow", "watch", "spy", "analyze", "guard", "compare"].includes(a) && t === me.id) return cb?.({ ok: false, error: "SELF" });
      let t2 = null; if (a === "compare") { t2 = String(pl?.target2 || ""); const q = P(room, t2); if (!q?.alive || t2 === t || t2 === me.id) return cb?.({ ok: false, error: "BAD_TARGET2" }); }
      if (a === "kill") room.night.kills.set(me.id, t); else room.night.acts.set(me.id, { a, t, t2 });
      done(cb, room); nightDoneCheck(io, room);
    });

    const castVote = (map, phaseName, pl, cb, validate) => {
      const room = myRoom(); if (!room || room.phase.name !== phaseName) return cb?.({ ok: false, error: "WRONG_PHASE" });
      if (pl?.seq != null && pl.seq !== room.phase.seq) return cb?.({ ok: false, error: "STALE" });
      const p = P(room, me.id); if (!p?.alive) return cb?.({ ok: false, error: "DEAD" }); if (!canVote(room, p)) return cb?.({ ok: false, error: "SILENCED" });
      if (room.voteFlags.locked?.has(me.id)) return cb?.({ ok: false, error: "VOIDED" });
      const v = validate(room, p); if (v?.error) return cb?.({ ok: false, error: v.error });
      room[map].set(me.id, v.value); done(cb, room); voteDoneCheck(io, room, room[map]);
    };
    socket.on("mf:vote", (pl, cb) => castVote("votes", "vote", pl, cb, (room) => { const t = pl?.target === "skip" ? "skip" : String(pl?.target || ""); if (t !== "skip" && (!P(room, t)?.alive || (room.cands && !room.cands.includes(t)))) return { error: "BAD_TARGET" }; return { value: t }; }));
    socket.on("mf:nominate", (pl, cb) => { const room = myRoom(); const ph = room?.phase.name; castVote("noms", ph === "hearing" ? "hearing" : "nominate", pl, cb, (r) => { const t = String(pl?.target || ""); if (!P(r, t)?.alive || t === me.id) return { error: "BAD_TARGET" }; return { value: t }; }); });
    socket.on("mf:verdict", (pl, cb) => castVote("verdict", "verdict", pl, cb, (room) => { if (room.voteFlags.accused === me.id) return { error: "ACCUSED" }; const v = pl?.v === "yes" ? "yes" : pl?.v === "no" ? "no" : null; if (!v) return { error: "BAD" }; return { value: v }; }));

    socket.on("mf:negotiate", (pl, cb) => { // 협상가: 한 명의 표 무효(두 번까지)
      const room = myRoom(), p = room && P(room, me.id);
      if (!room || !p?.alive || p.role !== "negotiator" || usesLeft(p) <= 0 || !["vote", "verdict"].includes(room.phase.name)) return cb?.({ ok: false, error: "CANNOT" });
      const t = String(pl?.target || ""), tp = P(room, t); if (!tp?.alive || t === me.id || room.voteFlags.locked.has(t)) return cb?.({ ok: false, error: "BAD_TARGET" });
      p.uses.negotiator = (p.uses.negotiator || 0) + 1; room.voteFlags.locked.add(t); room.voteFlags.voided = (room.voteFlags.voided || 0) + 1;
      (room.phase.name === "vote" ? room.votes : room.verdict).set(t, "void");
      tp.results.push({ day: room.phase.day, type: "voided" });
      addNews(room, { kind: "negotiate", key: true, text: "[뒷거래] 누군가의 표 1장이 무효 처리됐습니다." }); fx(io, room, "negotiate"); done(cb, room);
    });

    socket.on("mf:scoop", (pl, cb) => {
      const room = myRoom(), p = room && P(room, me.id);
      if (!room || room.status !== "playing" || !["discuss", "case", "vote", "nominate"].includes(room.phase.name) || !p?.alive || p.role !== "reporter" || p.uses.scoop) return cb?.({ ok: false, error: "CANNOT" });
      const r = p.results.filter((x) => x.type === "follow" && x.visited && !["blocked", "blackout"].includes(x.visited))[Number(pl?.index) || 0]; if (!r) return cb?.({ ok: false, error: "NO_SCOOP" });
      p.uses.scoop = 1; const A = P(room, r.target), B = P(room, r.visited);
      addNews(room, { kind: "scoop", key: true, text: `[단독] ${r.day}일째 밤, ${A?.nick} 님이 ${B?.nick} 님을 찾아간 것이 포착됐습니다. (기자 ${p.nick})`, target: r.target });
      fx(io, room, "scoop"); done(cb, room);
    });

    socket.on("mf:reinv", (_pl, cb) => { // 재수사 요청: 비용 = 오늘 투표권
      const room = myRoom(), p = room && P(room, me.id);
      if (!room || !p?.alive || !reinvAvail(room) || room.reinv.has(me.id) || !["discuss", "case"].includes(room.phase.name)) return cb?.({ ok: false, error: "CANNOT" });
      room.reinv.add(me.id); (room.reinvLost ||= new Set()).add(me.id);
      if (room.reinv.size >= reinvNeed(room)) { room.comeback.pending = "reinvestigate"; addNews(room, { kind: "reinv", key: true, text: "[재수사 확정] 내일 아침 지난 사건의 증거를 재수사합니다." }); fx(io, room, "reinv"); }
      done(cb, room);
    });

    socket.on("mf:case", (pl, cb) => {
      const room = myRoom(), c = room?.case, p = room && P(room, me.id);
      if (!room || room.phase.name !== "case" || !c || !p?.alive) return cb?.({ ok: false, error: "NO_CASE" });
      if (pl?.seq != null && pl.seq !== room.phase.seq) return cb?.({ ok: false, error: "STALE" });
      const hand = c.hand.get(me.id) || [];
      if (pl?.share) { const id = String(pl.share); const own = hand.includes(id) || (id === c.reward?.id && c.solvers.has(me.id)); if (!own) return cb?.({ ok: false, error: "NOT_YOURS" }); if (!c.shared.includes(id)) { c.shared.push(id); c.sharedBy[id] = me.id; fx(io, room, "clue", { id, by: me.id }); } }
      else if (pl?.forge) { // 증거 조작범: 손에 든 증거를 조작해 바로 공개
        if (p.role !== "forger" || usesLeft(p) <= 0) return cb?.({ ok: false, error: "CANNOT" }); const id = String(pl.forge);
        if (!hand.includes(id) || c.shared.includes(id) || c.byId[id]?.verified) return cb?.({ ok: false, error: "BAD_CLUE" });
        c.byId[id] = forgeClue(c.byId[id], c, rnd); p.uses.forger = 1; c.shared.push(id); c.sharedBy[id] = me.id;
        room.forged.push({ id, by: me.id, day: room.phase.day, title: c.byId[id].title, exposed: false }); fx(io, room, "clue", { id, by: me.id });
      }
      else if (pl?.testify) { if (p.role !== "tipster" || usesLeft(p) <= 0) return cb?.({ ok: false, error: "CANNOT" }); p.uses.tipster = 1; const inn = c.suspects.find((s) => s.id === c.truthMemo); addNews(room, { kind: "testify", key: true, text: `[익명 증언] ${inn?.nick}은(는) 이번 사건과 무관합니다.`, target: c.truthMemo }); fx(io, room, "testify"); }
      else if (pl?.solve != null) {
        if (c.solvers.has(me.id)) return cb?.({ ok: true, correct: true, already: true });
        const tries = (c.tries.get(me.id) || 0); if (tries >= 3) return cb?.({ ok: false, error: "NO_TRIES" });
        c.tries.set(me.id, tries + 1); const correct = checkSolve(c, pl.solve);
        if (correct) { c.solvers.add(me.id); p.stats.solves++; const h = c.hand.get(me.id) || []; if (!h.includes(c.reward.id)) h.push(c.reward.id); c.hand.set(me.id, h); }
        cb?.({ ok: true, correct, triesLeft: 3 - tries - 1 }); return emitState(io, room);
      }
      else if (pl?.accuse) { const id = String(pl.accuse); if (!c.suspects.some((s) => s.id === id) || id === me.id) return cb?.({ ok: false, error: "BAD_TARGET" }); c.accuse.set(me.id, id); }
      done(cb, room);
    });

    socket.on("mf:chat", (pl, cb) => {
      const room = myRoom() || specRoom(); if (!room) return cb?.({ ok: false });
      const text = cleanText(pl?.text); if (!text) return cb?.({ ok: false });
      const p = P(room, me.id);
      if (!p) { if (room.hostId === me.id && room.hostMode !== "play") { if (!rl("chat", 500)) return cb?.({ ok: false, error: "SLOW" }); pushChat(io, room, null, "all", text, { mc: true }); return cb?.({ ok: true }); } return cb?.({ ok: false, error: "SPECTATOR" }); }
      const t = now(); if (t - p.lastChat < 700) { if (++p.burst > 4) return cb?.({ ok: false, error: "SLOW" }); } else p.burst = 0; p.lastChat = t;
      const ch = chatCh(room, p, pl?.ch); if (!ch) return cb?.({ ok: false, error: "NIGHT_SILENT" });
      pushChat(io, room, p, ch, text); cb?.({ ok: true, ch });
    });

    socket.on("mf:sync", (_pl, cb) => { const room = myRoom() || specRoom(); if (!room) return cb?.({ ok: false }); emitState(io, room); cb?.({ ok: true }); });

    socket.on("disconnect", () => {
      for (const room of rooms.values()) {
        if (room.spectators.delete(socket.id)) { emitState(io, room); maybeEmpty(io, room); }
        if (room.mcSocket === socket.id) { room.mcSocket = null; maybeEmpty(io, room); }
        for (const q of room.queue) if (q.socketId === socket.id) q.socketId = null;
      }
      const code = userRoom.get(me.id), room = code && rooms.get(code); if (!room) return;
      const p = P(room, me.id); if (!p || p.socketId !== socket.id) return;
      p.connected = false; p.socketId = null;
      if (room.status === "lobby") setTimeout(() => { const r = rooms.get(code), q = r && P(r, me.id); if (r && q && !q.connected && r.status === "lobby") { removePlayer(io, r, me.id, "left"); if (r.hostId === me.id && !passHost(r)) return deleteRoom(io, r, "HOST_LEFT"); emitState(io, r); maybeEmpty(io, r); } }, 20000);
      emitState(io, room); maybeEmpty(io, room);
    });
  });
}

// 시험·시뮬레이션용
export function _rooms() { return rooms; }
export const _sim = { createRoom, startGame, newPlayer, seatList, BOT_NAMES, rooms, resolveNight, startNight, applyIncident, endVote, endVerdict, publicState, privateState, checkWin, dur };
