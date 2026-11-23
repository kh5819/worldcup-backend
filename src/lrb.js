// =========================
// 플듀 인생게임 REBORN — 같이 태어난 친구 (멀티 2~15명) (lrb:*)  2026-11-23
// 서버가 모든 인생을 직접 돌린다 (서버 권한). 화면은 선택 id·글·신청만 보낸다 → 나이·돈·관계·사망을 화면이 바꿀 수 없음.
//   · 방 = 한 세상 (같은 world 객체 = 같은 경기·세계 사건), 모두 같은 해에 0살로 태어남
//   · 해마다: 각자 사건·질문을 풀고 '준비' → 모두 준비(또는 제한 시간)되면 다 같이 한 살 (먼저 골랐다고 먼저 늙지 않음)
//   · 친구 행동(친구·여행·동업·창업·선물·도움·다툼·화해·고백·청혼·모두 모이자)은 상대 수락이 있어야 양쪽에 적용
//   · 사망: 다른 사람은 계속. 남은 사람에게 장례식 선택, 언제든 추모. 죽은 사람은 결말·관전·기다리기
//   · 모두 떠나면 '우리들의 인생' 공동 기록(saga)
// 진행 상태는 메모리. 재접속하면 이어서. 방장이 오래 없으면 다음 사람에게 방장 넘김.
// 엔진 원본은 프론트 js/life — scripts/sync-life-reborn.mjs 로 src/life-reborn 에 복사
// =========================
import * as L from "./life-reborn/life-engine.js";
import { ACTIONS, canDo, applyAction, applyParty, partnerYear, FUNERAL, publicView, diffNotices, linkOf } from "./life-reborn/life-mp.js";
import { COUNTRY_BY_ID, ERA_BY_ID, pickBirthYear } from "./life-reborn/life-world.js";

const ROOMS = new Map();
const MAX_ROOMS = Number(process.env.LRB_MAX_ROOMS || 600), TTL = 8 * 3600e3, MAXP = 15;
const now = () => Date.now();
const rk = (code) => `lrb:${code}`;
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f<>`]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const makeCode = () => { const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; for (;;) { let s = ""; for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)]; if (!ROOMS.has(s)) return s; } };
const BAD_NICK = /운영자|관리자|admin|플듀|playduo/i;
const pidOf = (P) => "s" + P.seat;
const LIMITS = [0, 20, 40, 60, 120];      // 한 해 제한 시간(초), 0 = 없음
const YEAR_MIN = [1.5, 3, 6];             // 한 해 최소 길이(초) — 소식을 읽을 시간
let OFFLINE_AUTO = 8e3, FAST = 1, TICK = 300;   // 접속이 끊긴 사람은 8초 뒤부터 자동으로 고름 · 시험용 값은 registerLifeReborn 에서 환경 변수로

function newRoom(hostKey, o) {
  return {
    code: makeCode(), hostKey, phase: "lobby", max: Math.max(2, Math.min(MAXP, o.max | 0 || 8)), title: clean(o.title, 30),
    opts: { mode: o.mode === "world" ? "world" : "same", country: COUNTRY_BY_ID[o.country] ? o.country : "KR", era: ERA_BY_ID[o.era] ? o.era : "modern", birthYear: null, limit: LIMITS.includes(o.limit | 0) ? o.limit | 0 : 60, auto: o.auto !== false, yearMin: YEAR_MIN.includes(+o.yearMin) ? +o.yearMin : 3 },
    players: new Map(), createdAt: now(), lastActive: now(), world: null, cal: 0, yearStart: 0, deadline: 0, advancing: false,
    reqs: new Map(), reqN: 0, moments: [], partners: [], memorials: [], worldLog: [], deaths: [], banned: new Set(), saga: null, ver: 0,
  };
}
const list = (r) => [...r.players.values()].sort((a, b) => a.seat - b.seat);
const alive = (r) => list(r).filter((P) => P.S && P.S.p.alive);
const bySeat = (r, s) => list(r).find((P) => P.seat === (s | 0)) || null;

// ---------- 보내기 ----------
function lobbyView(r) {
  return { code: r.code, phase: r.phase, max: r.max, title: r.title, opts: r.opts, host: r.players.get(r.hostKey)?.seat ?? 0,
    players: list(r).map((P) => ({ seat: P.seat, nick: P.nick, online: P.online, g: P.setup.gender || null, country: P.setup.country || r.opts.country, ready: !!P.lobbyReady })) };
}
function friendsView(r, viewer) {
  return list(r).filter((P) => P.S).map((P) => {
    const p = P.S.p, v = P.pub || publicView(p);
    const me = viewer?.S?.p, l = me && P !== viewer ? linkOf(me, pidOf(P)) : null;
    const lastDec = P.S.rec.decisions[P.S.rec.decisions.length - 1];
    return { seat: P.seat, nick: P.nick, online: P.online, ready: isReady(r, P), dead: !p.alive, region: P.S.rec.profile.region, ...v,
      close: l ? Math.round(l.close ?? 0) : null, rel: l ? l.rel : null, conflict: l ? Math.round(l.conflict || 0) : 0, partner: r.partners.some((x) => x.on && x.seats.includes(P.seat) && viewer && x.seats.includes(viewer.seat)),
      last: lastDec ? { a: lastDec.a, id: lastDec.id, t: lastDec.t } : null, deadOpt: P.deadOpt || null, memorials: r.memorials.filter((m) => m.to === P.seat).length };
  });
}
/** 내 인생 상태 (처음·재접속은 전부, 해마다는 새 기록만) */
function meState(P, full) {
  const S = P.S; if (!S) return null;
  const from = full ? 0 : Math.max(0, (P.sentY || 0) - 1), dfrom = full ? 0 : Math.max(0, (P.sentD || 0) - 1);
  const o = { full: !!full, p: L.core.serialize(S.p), yFrom: from, years: S.rec.years.slice(from), dFrom: dfrom, decs: S.rec.decisions.slice(dfrom), texts: S.texts, recalls: S.rec.recalls, wev: full ? (S.rec.wev || []) : (S.rec.wev || []).slice(-12), profile: S.rec.profile, pending: S.pending ? { pub: S.pending.pub, age: S.pending.age, evId: S.pending.ev.id } : null, prompt: S.prompt, done: S.done, final: S.rec.final || null, mpq: P.mpq, branches: full ? S.branches.slice(-12).map((b) => ({ ...b, snap: undefined })) : undefined };
  P.sentY = S.rec.years.length; P.sentD = S.rec.decisions.length;
  delete o.p.world; o.world = S.p.world ? { birthYear: S.p.world.birthYear, age: S.p.world.age, econ: S.p.world.econ, stock: S.p.world.stock, house: S.p.world.house, tech: S.p.world.tech, trend: S.p.world.trend } : null;
  return o;
}
function sendMe(io, r, P, full) { if (P.online && P.S) io.to(P.sock).emit("lrb:me", meState(P, full)); }
function roomInfo(r) { return { code: r.code, phase: r.phase, cal: r.cal, by: r.opts.birthYear, opts: r.opts, host: r.players.get(r.hostKey)?.seat ?? 0, deadline: r.deadline ? Math.max(0, r.deadline - now()) : 0, ver: r.ver, worldNow: r.worldLog.filter((x) => x.cal === r.cal) }; }
function broadcast(io, r) {
  r.ver++;
  for (const P of list(r)) if (P.online) io.to(P.sock).emit("lrb:room", { room: roomInfo(r), friends: friendsView(r, P), reqs: myReqs(r, P) });
}
function emitLobby(io, r) { io.to(rk(r.code)).emit("lrb:lobby", lobbyView(r)); }
function notice(io, r, o) { io.to(rk(r.code)).emit("lrb:notice", { cal: r.cal, ...o }); }
function myReqs(r, P) { return [...r.reqs.values()].filter((q) => (q.to === P.seat || (q.group && q.invited.includes(P.seat) && !q.answered.includes(P.seat))) && !q.done).map((q) => ({ id: q.id, kind: q.kind, from: q.from, fromNick: bySeat(r, q.from)?.nick, tier: q.tier, what: q.what, cost: q.cost, job: q.job })); }

// ---------- 준비 ----------
function busy(P) { const S = P.S; return !!(S.pending || (S.prompt && !S.prompt.final) || (P.mpq && P.mpq.length)); }
function isReady(r, P) {
  if (!P.S || !P.S.p.alive) return true;
  if (busy(P)) return false;
  if (!P.online) return true;
  if (P.hold) return false;
  return !!P.ready || r.opts.auto;
}
function autoResolve(r, P) {
  const S = P.S; if (!S || !S.p.alive) return;
  for (let k = 0; k < 6 && busy(P); k++) {
    if (S.prompt && !S.prompt.final) { L.skipPrompt(S); continue; }
    if (S.pending) { const cid = L.autoChoice(S); const res = L.choose(S, cid, { auto: true }); if (res?.end || !S.p.alive) onDeath(r, P); continue; }
    if (P.mpq?.length) { const f = P.mpq.shift(); funeralApply(r, P, f, "quiet"); }
  }
}

// ---------- 사망 ----------
function onDeath(r, P) {
  if (P.deadDone) return; P.deadDone = true;
  const p = P.S.p, by = p.birthYear, dy = by + (p.deathAge ?? p.age);
  r.deaths.push({ seat: P.seat, cal: dy, age: p.deathAge ?? p.age, cause: p.cause?.id || null });
  r.moments.push({ cal: dy, kind: "death", seats: [P.seat] });
  for (const Q of alive(r)) {
    if (Q === P) continue;
    const line = L.core.SYS.playerDied(Q.S.p, pidOf(P), P.nick);
    (Q.mpq ||= []).push({ k: "funeral", seat: P.seat, nick: P.nick, by, age: p.deathAge ?? p.age, linked: !!line });
    (Q.carry ||= []).push({ k: "lost", who: P.nick, seat: P.seat, sys: line?.k || null });
  }
  for (const x of r.partners) if (x.on && x.seats.includes(P.seat)) { x.on = false; x.endCal = dy; x.why = "death"; }
  P._io && notice(P._io, r, { k: "death", seat: P.seat, a: P.nick, y1: by, y2: dy });
}
function funeralApply(r, P, f, choice) {
  const c = FUNERAL.choices.find((x) => x.id === choice) || FUNERAL.choices[2];
  for (const [k, v] of Object.entries(c.d)) L.core.addStat(P.S.p, k, f.linked ? v * 2 : v);
  L.core.SYS.remember(P.S.p, "m_friend", { who: f.nick }, -1, f.linked ? 3 : 1);
  (P.carry ||= []).push({ k: "funeral", who: f.nick, seat: f.seat, c: c.id });
  r.moments.push({ cal: r.cal, kind: "funeral", seats: [P.seat, f.seat], c: c.id });
}

// ---------- 한 해 넘기기 ----------
function advance(io, r) {
  if (r.advancing || r.phase !== "live") return; r.advancing = true;
  try {
    for (const P of alive(r)) autoResolve(r, P);
    // 신청 정리 (모두 모이자: 수락한 사람과 함께)
    for (const q of r.reqs.values()) {
      if (q.group && !q.done) { const ps = [q.from, ...q.yes].map((s) => bySeat(r, s)).filter((x) => x?.S?.p.alive); if (ps.length >= 2) { applyParty(ps.map((x) => x.S.p), ps.map(pidOf), L.core); r.moments.push({ cal: r.cal, kind: "party", seats: ps.map((x) => x.seat), what: q.what }); for (const x of ps) (x.carry ||= []).push({ k: "party", n: ps.length, what: q.what }); } }
    }
    r.reqs.clear();
    // 동업·창업 정산
    for (const x of r.partners) {
      if (!x.on) continue;
      const [A, B] = x.seats.map((s) => bySeat(r, s)); if (!A?.S?.p.alive || !B?.S?.p.alive) { x.on = false; continue; }
      const amt = partnerYear(A.S.p, B.S.p, x, r.world);
      for (const [Me, Ot] of [[A, B], [B, A]]) (Me.carry ||= []).push({ k: "partnerYear", who: Ot.nick, v: amt, kind: x.kind });
      if (x.years >= 3 && x.total < -2500 && Math.random() < 0.35) { x.on = false; x.endCal = r.cal; x.why = "fail"; for (const Me of [A, B]) { Me.carry.push({ k: "partnerEnd", who: (Me === A ? B : A).nick, why: "fail" }); const l = linkOf(Me.S.p, pidOf(Me === A ? B : A)); if (l) { l.conflict = Math.min(100, (l.conflict || 0) + 20); l.close = Math.max(0, (l.close ?? 50) - 8); } } r.moments.push({ cal: r.cal, kind: "partnerFail", seats: x.seats }); }
    }
    r.cal++;
    const prevPub = new Map(list(r).map((P) => [P.seat, P.pub]));
    for (const P of alive(r)) {
      const S = P.S;
      if (!S.p.focus) { const d = L.defaultFocus(S.p.age + 1); if (d) L.setFocus(S, d); }
      const res = L.nextYear(S);
      const y = S.rec.years[S.rec.years.length - 1];
      if (y && P.carry?.length) { y.mp = (y.mp || []).concat(P.carry); } P.carry = [];
      if (res?.death || !S.p.alive) onDeath(r, P);
    }
    // 같은 나라 친구는 7살에 같은 반 (처음 서로 알게 됨)
    const kids = alive(r).filter((P) => P.S.p.age === 7);
    for (const P of kids) for (const Q of kids) if (P.seat < Q.seat && (P.S.p.country === Q.S.p.country) && !linkOf(P.S.p, pidOf(Q))) {
      L.core.SYS.link(P.S.p, Q.S.p, "friend", [pidOf(P), pidOf(Q)]);
      for (const [Me, Ot] of [[P, Q], [Q, P]]) { const y = Me.S.rec.years[Me.S.rec.years.length - 1]; if (y) (y.mp ||= []).push({ k: "classmate", who: Ot.nick, seat: Ot.seat }); }
      r.moments.push({ cal: r.cal, kind: "classmate", seats: [P.seat, Q.seat] });
    }
    // 부부·연인 맞춰 보기 (한쪽 인생에서 이혼·이별이 일어나면 다른 쪽도)
    for (const P of alive(r)) {
      const p = P.S.p;
      if (p.spouse?.pid) { const Q = bySeat(r, +String(p.spouse.pid).slice(1)); if (Q?.S?.p.alive && Q.S.p.spouse?.pid !== pidOf(P)) { L.core.SYS.playerDivorced(p, p.spouse.pid, Q.nick); r.moments.push({ cal: r.cal, kind: "divorce", seats: [P.seat, Q.seat] }); } else if (Q?.S?.p.alive) L.core.SYS.shareKids(p, Q.S.p); }
      if (p.romancePid) { const Q = bySeat(r, +String(p.romancePid).slice(1)); if (Q?.S?.p.alive && Q.S.p.romancePid !== pidOf(P) && Q.S.p.spouse?.pid !== pidOf(P)) L.core.SYS.playerBrokeUp(p, p.romancePid, Q.nick); }
    }
    // 세계 사건 기록 (같은 세상이니 첫 사람 기록이면 충분)
    const any = alive(r)[0] || list(r)[0]; const wy = any?.S?.rec.years[any.S.rec.years.length - 1];
    const wlist = r.world?.wev?.[r.cal] || [];
    for (const wid of wlist) if (!r.worldLog.some((x) => x.cal === r.cal && x.id === wid)) r.worldLog.push({ cal: r.cal, id: wid, by: list(r).filter((P) => P.S).map((P) => { const e = (P.S.rec.wev || []).find((w) => w.y === r.cal && w.id === String(wid).split(":")[0]); return e ? { seat: P.seat, d: e.d, o: e.o, mine: e.mine } : null; }).filter(Boolean) });
    void wy;
    // 공개 프로필·알림
    for (const P of list(r)) {
      if (!P.S) continue; P.pub = publicView(P.S.p);
      for (const n of diffNotices(prevPub.get(P.seat), P.pub)) { if (n.k === "death") continue; notice(io, r, { ...n, seat: P.seat, a: P.nick }); if (n.k === "marry" && P.S.p.spouse?.pid) r.moments.push({ cal: r.cal, kind: "marry", seats: [P.seat, +String(P.S.p.spouse.pid).slice(1)] }); }
      if (P.S.p.alive && P.S.rec.final == null && P.dreamNoted !== true) { const F = P.S.p.careerHist?.length || P.S.p.career ? L.careerMatchesDream(P.S.p.career, P.S.rec.profile.dreamKeys) : false; if (F) { P.dreamNoted = true; notice(io, r, { k: "dream", seat: P.seat, a: P.nick }); r.moments.push({ cal: r.cal, kind: "dream", seats: [P.seat] }); } }
    }
    for (const P of list(r)) { P.ready = false; P.sent = 0; }
    r.yearStart = now(); r.deadline = r.opts.limit ? now() + r.opts.limit * 1000 : 0; r.lastActive = now();
    if (!alive(r).length) finishRoom(io, r);
    for (const P of list(r)) sendMe(io, r, P, false);
    broadcast(io, r);
  } catch (e) { console.warn("[lrb] advance", e?.stack?.split("\n").slice(0, 3).join(" | ")); }
  finally { r.advancing = false; }
}

// ---------- 끝: 우리들의 인생 ----------
function finishRoom(io, r) {
  if (r.phase === "end") return; r.phase = "end";
  const ps = list(r).filter((P) => P.S);
  const players = ps.map((P) => { const S = P.S, p = S.p, F = S.rec.final || L.summarize(S);
    return { seat: P.seat, nick: P.nick, g: p.gender, country: p.country, region: S.rec.profile.region, by: p.birthYear, dy: p.birthYear + (p.deathAge ?? p.age), age: p.deathAge ?? p.age, cause: p.cause?.id || null,
      jobs: F.jobs.map((j) => ({ t: j.t, from: j.from, to: j.to })), career: F.career, careerHist: F.careerHist.map((h) => h.key), edu: F.edu, spouse: F.spouse ? { name: F.spouse.name, mp: p.spouse?.pid ? +String(p.spouse.pid).slice(1) : null } : null, spouseEnd: F.spouseEnd, kids: F.kids.length, pets: F.pets.length,
      happyAvg: F.happyAvg, money: F.money, achv: F.achv, ending: F.ending, dreamDone: F.dreamDone, titles: F.titles, decisions: F.decisions,
      top: S.rec.decisions.filter((d) => d.maj).slice(0, 8).map((d) => ({ a: d.a, id: d.id, t: d.t, c: d.c, cid: d.cid })), last: S.texts.last || "", wev: (S.rec.wev || []).filter((w) => w.mine && Object.keys(w.d || {}).length).map((w) => ({ id: w.id, y: w.y, a: w.a, d: w.d })) };
  });
  // 우정 기간: 처음 알게 된 해 → 둘 중 하나가 떠난 해
  const pairs = [];
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const A = ps[i], B = ps[j], la = A.S.p.people.find((x) => x.pid === pidOf(B) || (x.name === B.nick && x.status === "dead")), lb = B.S.p.people.find((x) => x.pid === pidOf(A) || (x.name === A.nick && x.status === "dead"));
    const ms = r.moments.filter((m) => m.seats.includes(A.seat) && m.seats.includes(B.seat) && m.kind !== "death");
    if (!la && !lb && !ms.length) continue;
    const start = Math.min(...ms.map((m) => m.cal), la ? A.S.p.birthYear + (la.since ?? 0) : 1e9, lb ? B.S.p.birthYear + (lb.since ?? 0) : 1e9);
    const end = Math.min(A.S.p.birthYear + (A.S.p.deathAge ?? A.S.p.age), B.S.p.birthYear + (B.S.p.deathAge ?? B.S.p.age));
    pairs.push({ seats: [A.seat, B.seat], from: start, to: end, years: Math.max(0, end - start), n: ms.length, kinds: [...new Set(ms.map((m) => m.kind))], close: Math.round(((la?.close ?? 0) + (lb?.close ?? 0)) / ((la ? 1 : 0) + (lb ? 1 : 0) || 1)), rel: la?.rel || lb?.rel || null });
  }
  r.saga = { code: r.code, by: r.opts.birthYear, era: r.opts.era, mode: r.opts.mode, endCal: r.cal, players, pairs, moments: r.moments.slice(-400), partners: r.partners.map((x) => ({ seats: x.seats, kind: x.kind, from: x.from, to: x.endCal ?? r.cal, total: x.total || 0, years: x.years || 0, best: x.best ?? 0, worst: x.worst ?? 0, why: x.why || null })), memorials: r.memorials.slice(-100), world: r.worldLog.slice(-120), deaths: r.deaths };
  io.to(rk(r.code)).emit("lrb:saga", r.saga);
}

// =========================
export function registerLifeReborn(io) {
  OFFLINE_AUTO = Number(process.env.LRB_OFFLINE_MS || 8e3); FAST = process.env.LRB_FAST ? 0 : 1; TICK = Number(process.env.LRB_TICK || 300);
  setInterval(() => {
    const t = now();
    for (const [code, r] of ROOMS) {
      if (t - r.createdAt > TTL || (t - r.lastActive > 40 * 60e3 && !list(r).some((P) => P.online))) { ROOMS.delete(code); continue; }
      // 방장 넘기기: 방장이 20초 넘게 없으면 접속 중인 다음 사람에게
      const H = r.players.get(r.hostKey);
      if (H && !H.online && t - (H.leftAt || t) > 20e3) { const N2 = list(r).find((P) => P.online); if (N2) { r.hostKey = N2.key; notice(io, r, { k: "host", seat: N2.seat, a: N2.nick }); if (r.phase === "lobby") emitLobby(io, r); else broadcast(io, r); } }
      if (r.phase !== "live" || r.advancing) continue;
      for (const P of alive(r)) if (!P.online && t - (P.leftAt || t) > OFFLINE_AUTO && busy(P)) autoResolve(r, P);
      const all = alive(r).every((P) => isReady(r, P));
      if ((all && t - r.yearStart >= r.opts.yearMin * 1000 * FAST) || (r.deadline && t >= r.deadline)) advance(io, r);
    }
  }, TICK).unref?.();

  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const key = (me.isGuest ? "g:" : "u:") + me.id;
    let win = now(), cnt = 0;
    const limited = (n) => { const t = now(); if (t - win > 10000) { win = t; cnt = 0; } cnt += 1; return cnt > (n || Number(process.env.LRB_RL || 160)); };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => { const reply = typeof cb === "function" ? cb : () => {}; if (limited()) return reply({ ok: false, error: "RATE_LIMITED" }); try { await fn(p && typeof p === "object" ? p : {}, reply); } catch (e) { console.warn("[lrb]", ev, e?.message); reply({ ok: false, error: "SERVER_ERROR" }); } });
    const roomOf = (code) => ROOMS.get(String(code || "").toUpperCase()) || null;
    const mine = (code) => { const r = roomOf(code); const P = r?.players.get(key); return r && P ? [r, P] : [null, null]; };
    const joined = new Set();

    on("lrb:ping", (p, reply) => reply({ ok: true, v: 1, rooms: ROOMS.size }));
    on("lrb:create", (p, reply) => {
      const nick = clean(p.nick, 12); if (!nick) return reply({ ok: false, error: "NEED_NICK" }); if (BAD_NICK.test(nick)) return reply({ ok: false, error: "BAD_NICK" });
      if (ROOMS.size >= MAX_ROOMS) return reply({ ok: false, error: "BUSY" });
      for (const r of ROOMS.values()) if (r.hostKey === key && r.phase === "lobby") { io.to(rk(r.code)).emit("lrb:closed", { reason: "HOST_NEW" }); ROOMS.delete(r.code); }
      const r = newRoom(key, p); r.players.set(key, { key, seat: 0, nick, sock: socket.id, online: true, setup: {}, mpq: [], carry: [], _io: io });
      ROOMS.set(r.code, r); socket.join(rk(r.code)); joined.add(r.code);
      reply({ ok: true, code: r.code, seat: 0 }); emitLobby(io, r);
    });
    on("lrb:join", (p, reply) => {
      const r = roomOf(p.code); if (!r) return reply({ ok: false, error: "NOT_FOUND" });
      let P = r.players.get(key);
      if (!P) {
        if (r.banned.has(key)) return reply({ ok: false, error: "BANNED" });
        if (r.phase !== "lobby") return reply({ ok: false, error: "STARTED" });
        const nick = clean(p.nick, 12); if (!nick) return reply({ ok: false, error: "NEED_NICK" }); if (BAD_NICK.test(nick)) return reply({ ok: false, error: "BAD_NICK" });
        if (r.players.size >= r.max) return reply({ ok: false, error: "FULL" });
        if (list(r).some((x) => x.nick === nick)) return reply({ ok: false, error: "NICK_TAKEN" });
        const used = new Set(list(r).map((x) => x.seat)); let seat = 0; while (used.has(seat)) seat++;
        P = { key, seat, nick, sock: socket.id, online: true, setup: {}, mpq: [], carry: [], _io: io }; r.players.set(key, P);
      } else { P.sock = socket.id; P.online = true; P.leftAt = null; }
      socket.join(rk(r.code)); joined.add(r.code); r.lastActive = now();
      reply({ ok: true, code: r.code, seat: P.seat, phase: r.phase });
      if (r.phase === "lobby") emitLobby(io, r);
      else { sendMe(io, r, P, true); broadcast(io, r); if (r.saga) io.to(P.sock).emit("lrb:saga", r.saga); }
    });
    on("lrb:leave", (p, reply) => {
      const [r, P] = mine(p.code); if (!r) return reply({ ok: true });
      if (r.phase === "lobby") { r.players.delete(key); if (r.hostKey === key) { const N2 = list(r)[0]; if (N2) r.hostKey = N2.key; else { ROOMS.delete(r.code); return reply({ ok: true }); } } emitLobby(io, r); }
      else { P.online = false; P.leftAt = now() - OFFLINE_AUTO; P.left = true; broadcast(io, r); }     // 진행 중엔 자리를 지우지 않음 (인생은 자동으로 이어짐, 다시 들어오면 이어서)
      socket.leave(rk(r.code)); joined.delete(r.code); reply({ ok: true });
    });
    // 로비: 내 출생 신고서 (성별·나라·지역·성격·꿈)
    on("lrb:setup", (p, reply) => {
      const [r, P] = mine(p.code); if (!r || r.phase !== "lobby") return reply({ ok: false, error: "NOT_LOBBY" });
      P.setup = { gender: p.gender === "M" || p.gender === "F" ? p.gender : null, country: COUNTRY_BY_ID[p.country] ? p.country : null, region: clean(p.region, 20) || null,
        persona: (Array.isArray(p.persona) ? p.persona : []).slice(0, 3).map((x) => clean(x, 12)), values: (Array.isArray(p.values) ? p.values : []).slice(0, 3).map((x) => clean(x, 12)), interests: (Array.isArray(p.interests) ? p.interests : []).slice(0, 4).map((x) => clean(x, 12)),
        dream: L.cleanText(p.dream, 80), wish: L.cleanText(p.wish, 40) };
      P.lobbyReady = !!p.ready; emitLobby(io, r); reply({ ok: true });
    });
    on("lrb:opts", (p, reply) => {
      const r = roomOf(p.code); if (!r || r.hostKey !== key) return reply({ ok: false, error: "NOT_HOST" });
      const o = r.opts;
      if (r.phase === "lobby") { if (p.mode) o.mode = p.mode === "world" ? "world" : "same"; if (COUNTRY_BY_ID[p.country]) o.country = p.country; if (ERA_BY_ID[p.era]) o.era = p.era; if (p.birthYear === null || (Number.isInteger(p.birthYear) && p.birthYear >= 1900 && p.birthYear <= 2050)) o.birthYear = p.birthYear; }
      if (p.limit != null && LIMITS.includes(p.limit | 0)) o.limit = p.limit | 0; if (p.auto != null) o.auto = !!p.auto; if (p.yearMin != null && YEAR_MIN.includes(+p.yearMin)) o.yearMin = +p.yearMin;
      if (r.phase === "lobby") emitLobby(io, r); else { r.deadline = o.limit ? Math.max(now() + 5000, r.yearStart + o.limit * 1000) : 0; broadcast(io, r); }
      reply({ ok: true, opts: o });
    });
    on("lrb:kick", (p, reply) => {
      const r = roomOf(p.code); if (!r || r.hostKey !== key || r.phase !== "lobby") return reply({ ok: false, error: "NOT_HOST" });
      const P = bySeat(r, p.seat); if (!P || P.key === key) return reply({ ok: false });
      r.players.delete(P.key); r.banned.add(P.key); io.to(P.sock).emit("lrb:closed", { reason: "KICKED" }); io.sockets.sockets.get(P.sock)?.leave(rk(r.code));
      emitLobby(io, r); reply({ ok: true });
    });
    on("lrb:start", (p, reply) => {
      const r = roomOf(p.code); if (!r || r.hostKey !== key) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "lobby") return reply({ ok: false, error: "STARTED" });
      const o = r.opts, by = o.birthYear || pickBirthYear(o.era); o.birthYear = by;
      const ps = list(r);
      const countries = [...new Set(ps.map((P) => o.mode === "world" ? (P.setup.country || o.country) : o.country))];
      r.world = L.core.createWorld(by); r.world.countries = countries; r.world.seed = Math.floor(Math.random() * 1e9);
      for (const P of ps) {
        const s = P.setup, country = o.mode === "world" ? (s.country || o.country) : o.country;
        const S = L.newLife({ mode: "custom", name: P.nick, gender: s.gender || undefined, country, era: o.era, birthYear: by, region: s.region || undefined, persona: s.persona, values: s.values, interests: s.interests, dream: s.dream, wish: s.wish });
        S.p.mp = true; S.p.mpSeat = P.seat;
        L.begin(S, r.world); P.S = S; P.pub = publicView(S.p); P.sentY = 0; P.sentD = 0; P.ready = false; P.mpq = []; P.carry = [];
      }
      r.phase = "live"; r.cal = by + 1; r.yearStart = now(); r.deadline = o.limit ? now() + o.limit * 1000 : 0; r.moments.push({ cal: by, kind: "born", seats: ps.map((P) => P.seat) });
      for (const wid of r.world.wev?.[r.cal] || []) r.worldLog.push({ cal: r.cal, id: wid, by: [] });
      io.to(rk(r.code)).emit("lrb:started", { by, era: o.era, mode: o.mode });
      for (const P of ps) sendMe(io, r, P, true);
      broadcast(io, r); reply({ ok: true, by });
    });

    // ---------- 진행 중 ----------
    on("lrb:choose", (p, reply) => {
      const [r, P] = mine(p.code); if (!r || r.phase !== "live" || !P.S) return reply({ ok: false, error: "NOT_LIVE" });
      const S = P.S; if (!S.pending) return reply({ ok: false, error: "NO_PENDING" });                         // 중복 선택 막기
      const cid = clean(p.cid, 40); const c = S.pending.pub.choices.find((x) => x.id === cid);
      if (!c || c.locked) return reply({ ok: false, error: "BAD_CHOICE" });
      const res = L.choose(S, cid); if (!res) return reply({ ok: false, error: "BAD_CHOICE" });
      if (res.end || !S.p.alive) onDeath(r, P);
      r.lastActive = now();
      reply({ ok: true, res: { grade: res.grade, narrative: res.narrative, src: res.src, deltas: res.deltas, sys: res.sys ? { lines: res.sys.lines } : null, death: !!(res.end || !S.p.alive) } });
      sendMe(io, r, P, false); broadcast(io, r);
    });
    on("lrb:text", (p, reply) => {
      const [r, P] = mine(p.code); if (!r || !P.S) return reply({ ok: false });
      const k = String(p.key || ""); const S = P.S;
      if (k === "thought") { if ((P.thoughtsThisYear = (P.thoughtYear === r.cal ? (P.thoughtsThisYear || 0) : 0) + 1) > 3) return reply({ ok: false, error: "LIMIT" }); P.thoughtYear = r.cal; L.writeText(S, "thought", p.text); }
      else if (k === "skip") { if (S.prompt && !S.prompt.final) L.skipPrompt(S); }
      else if (S.prompt && S.prompt.key === k && !S.prompt.final) L.writeText(S, k, p.text);
      else if (S.done && ["last", "epitaph"].includes(k)) L.writeText(S, k, p.text);
      else if (S.done && k === "letter") { const body = L.cleanText(p.text, L.TEXT_MAX.letter); if (body) S.texts.letter = { to: L.cleanText(p.to, L.TEXT_MAX.to), toKey: clean(p.toKey, 12), text: body }; }
      else if (S.done && k === "finish") { if (S.prompt?.final) S.prompt = null; }
      else return reply({ ok: false, error: "BAD_KEY" });
      reply({ ok: true }); sendMe(io, r, P, k === "finish"); broadcast(io, r);
    });
    on("lrb:focus", (p, reply) => { const [r, P] = mine(p.code); if (!r || !P.S) return reply({ ok: false }); reply({ ok: L.setFocus(P.S, clean(p.id, 12)) }); sendMe(io, r, P, false); });
    on("lrb:ready", (p, reply) => { const [r, P] = mine(p.code); if (!r || r.phase !== "live") return reply({ ok: false }); P.ready = !!p.ready; P.hold = !!p.hold; reply({ ok: true, busy: P.S ? busy(P) : false }); broadcast(io, r); });
    on("lrb:skip", (p, reply) => { // 방장: 기다리지 않고 다음 해 (안 고른 사람은 자동 선택)
      const r = roomOf(p.code); if (!r || r.hostKey !== key || r.phase !== "live") return reply({ ok: false, error: "NOT_HOST" });
      if (now() - r.yearStart < 2000 * FAST) return reply({ ok: false, error: "TOO_FAST" });
      advance(io, r); reply({ ok: true });
    });
    on("lrb:deadopt", (p, reply) => { const [r, P] = mine(p.code); if (!r || !P.S || P.S.p.alive) return reply({ ok: false }); P.deadOpt = ["ending", "watch", "wait"].includes(p.v) ? p.v : null; reply({ ok: true }); broadcast(io, r); });
    on("lrb:peek", (p, reply) => { // 친구의 공개 인생 기록 (자유 입력은 빼고)
      const [r] = mine(p.code); if (!r) return reply({ ok: false }); const Q = bySeat(r, p.seat); if (!Q?.S) return reply({ ok: false });
      const S = Q.S, last = S.rec.years.slice(-1)[0];
      reply({ ok: true, seat: Q.seat, nick: Q.nick, pub: Q.pub, profile: { country: S.rec.profile.country, region: S.rec.profile.region, persona: S.rec.profile.persona, era: S.rec.profile.era }, decisions: S.rec.decisions.filter((d) => d.maj || d.g === "crit").slice(-14).map((d) => ({ a: d.a, id: d.id, t: d.t, c: d.c, cid: d.cid, src: d.src })), jobs: (S.p.careerHist || []).map((h) => ({ key: h.key, from: h.from, to: h.to })), last: last ? { a: last.a, st: last.st, house: last.house, job: last.job } : null, scene: { age: S.p.age, g: S.p.gender, spouse: !!S.p.spouse, kids: S.p.kids.length, pets: (S.p.pets || []).filter((x) => x.alive !== false).map((x) => ({ kind: x.kind, breed: x.breed })), housing: S.p.housing, career: S.p.career }, memorials: r.memorials.filter((m) => m.to === Q.seat) });
    });

    // ---------- 친구 행동 (상대 수락 필요) ----------
    on("lrb:ask", (p, reply) => {
      const [r, P] = mine(p.code); if (!r || r.phase !== "live" || !P.S?.p.alive) return reply({ ok: false, error: "NOT_LIVE" });
      const kind = String(p.kind || ""); const A = ACTIONS[kind]; if (!A) return reply({ ok: false, error: "BAD_KIND" });
      if (P.sentCal !== r.cal) { P.sentCal = r.cal; P.sent = 0; } if (P.sent >= 4) return reply({ ok: false, error: "LIMIT" });
      if (A.group) {
        if ([...r.reqs.values()].some((q) => q.group && !q.done)) return reply({ ok: false, error: "PARTY_EXISTS" });
        const err = canDo(kind, P.S.p, null); if (err) return reply({ ok: false, error: err });
        const invited = alive(r).filter((Q) => Q !== P).map((Q) => Q.seat); if (!invited.length) return reply({ ok: false, error: "NO_ONE" });
        const q = { id: ++r.reqN, kind, from: P.seat, group: true, invited, answered: [], yes: [], what: clean(p.what, 30), cal: r.cal };
        r.reqs.set(q.id, q); P.sent++; reply({ ok: true, id: q.id }); broadcast(io, r); return;
      }
      const Q = bySeat(r, p.to); if (!Q || Q === P || !Q.S) return reply({ ok: false, error: "NO_TARGET" });
      const partner = r.partners.some((x) => x.on && x.seats.includes(P.seat) && x.seats.includes(Q.seat));
      const err = canDo(kind, P.S.p, Q.S.p, pidOf(P), pidOf(Q), { tier: p.tier | 0, partner }); if (err) return reply({ ok: false, error: err });
      if ([...r.reqs.values()].some((q) => !q.done && q.kind === kind && ((q.from === P.seat && q.to === Q.seat) || (q.from === Q.seat && q.to === P.seat)))) return reply({ ok: false, error: "DUP" });
      const tier = kind === "gift" ? (A.tiers[p.tier | 0] ?? A.tiers[0]) : A.cost || 0;
      const q = { id: ++r.reqN, kind, from: P.seat, to: Q.seat, tier: p.tier | 0, cost: tier, job: kind === "samejob" ? P.S.p.job?.title : null, cal: r.cal };
      r.reqs.set(q.id, q); P.sent++;
      reply({ ok: true, id: q.id }); broadcast(io, r);
      if (Q.online) io.to(Q.sock).emit("lrb:req", { id: q.id, kind, from: P.seat, fromNick: P.nick, tier: q.tier, cost: q.cost, job: q.job });
    });
    on("lrb:answer", (p, reply) => {
      const [r, P] = mine(p.code); if (!r || r.phase !== "live" || !P.S?.p.alive) return reply({ ok: false, error: "NOT_LIVE" });
      const q = r.reqs.get(p.id | 0); if (!q || q.done) return reply({ ok: false, error: "GONE" });
      if (q.group) { if (!q.invited.includes(P.seat) || q.answered.includes(P.seat)) return reply({ ok: false, error: "NOT_YOURS" }); q.answered.push(P.seat); if (p.yes) q.yes.push(P.seat); reply({ ok: true }); broadcast(io, r); return; }
      if (q.to !== P.seat) return reply({ ok: false, error: "NOT_YOURS" });
      q.done = true;
      const F = bySeat(r, q.from); if (!F?.S?.p.alive) return reply({ ok: false, error: "GONE" });
      if (!p.yes && q.kind !== "argue") { if (F.online) io.to(F.sock).emit("lrb:result", { id: q.id, kind: q.kind, ok: false, by: P.seat, byNick: P.nick }); reply({ ok: true }); broadcast(io, r); return; }
      const partner = r.partners.some((x) => x.on && x.seats.includes(F.seat) && x.seats.includes(P.seat));
      const err = canDo(q.kind, F.S.p, P.S.p, pidOf(F), pidOf(P), { tier: q.tier, partner }); if (err) { reply({ ok: false, error: err }); if (F.online) io.to(F.sock).emit("lrb:result", { id: q.id, kind: q.kind, ok: false, error: err }); broadcast(io, r); return; }
      const res = applyAction(q.kind, F.S.p, P.S.p, pidOf(F), pidOf(P), { core: L.core, extra: { tier: q.tier }, reply: p.reply === "sorry" ? "sorry" : "fight" });
      if (res.partner) r.partners.push({ seats: [F.seat, P.seat], kind: res.partner.kind, from: r.cal, on: true, total: 0, years: 0 });
      r.moments.push({ cal: r.cal, kind: q.kind, seats: [F.seat, P.seat], d: res.d, scene: res.scene || null });
      for (const [Me, Ot] of [[F, P], [P, F]]) { const y = Me.S.rec.years[Me.S.rec.years.length - 1]; if (y) (y.mp ||= []).push({ k: "act", kind: q.kind, who: Ot.nick, seat: Ot.seat, from: Me === F, d: res.d, scene: res.scene || null }); }
      const out = { id: q.id, kind: q.kind, ok: true, seats: [F.seat, P.seat], nicks: [F.nick, P.nick], d: res.d, scene: res.scene || null };
      if (F.online) io.to(F.sock).emit("lrb:result", out); reply({ ok: true, result: out });
      sendMe(io, r, F, false); sendMe(io, r, P, false); broadcast(io, r);
      if (["confess", "propose", "startup", "partner"].includes(q.kind)) notice(io, r, { k: "act_" + q.kind, seats: [F.seat, P.seat], a: F.nick, b: P.nick });
    });
    on("lrb:funeral", (p, reply) => {
      const [r, P] = mine(p.code); if (!r || !P.S?.p.alive) return reply({ ok: false });
      const i = (P.mpq || []).findIndex((f) => f.seat === (p.seat | 0)); if (i < 0) return reply({ ok: false, error: "GONE" });
      const f = P.mpq.splice(i, 1)[0]; funeralApply(r, P, f, String(p.c || "quiet"));
      reply({ ok: true }); sendMe(io, r, P, false); broadcast(io, r);
    });
    on("lrb:memorial", (p, reply) => {
      const [r, P] = mine(p.code); if (!r || r.phase === "lobby") return reply({ ok: false });
      const Q = bySeat(r, p.seat); if (!Q?.S || Q.S.p.alive || Q === P) return reply({ ok: false, error: "NOT_DEAD" });
      if (r.memorials.some((m) => m.from === P.seat && m.to === Q.seat && m.cal === r.cal)) return reply({ ok: false, error: "LIMIT" });
      const text = L.cleanText(p.text, 80); if (!text) return reply({ ok: false, error: "EMPTY" });
      r.memorials.push({ cal: r.cal, from: P.seat, to: Q.seat, text, age: P.S.p.age });
      if (P.S.p.alive) { const y = P.S.rec.years[P.S.rec.years.length - 1]; if (y) (y.mp ||= []).push({ k: "memorial", who: Q.nick, seat: Q.seat }); }
      notice(io, r, { k: "memorial", seat: P.seat, a: P.nick, b: Q.nick, v: text }); reply({ ok: true }); broadcast(io, r);
    });

    socket.on("disconnect", () => {
      for (const code of joined) { const r = ROOMS.get(code); if (!r) continue; const P = r.players.get(key); if (!P || P.sock !== socket.id) continue; P.online = false; P.leftAt = now(); if (r.phase === "lobby") emitLobby(io, r); else broadcast(io, r); }
    });
  });
}
// 시험용
export const __lrb = { ROOMS, advance, finishRoom };
