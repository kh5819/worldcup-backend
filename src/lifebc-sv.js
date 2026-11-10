// =========================
// 방송국 서바이벌 1~15인 (lbs:*) — 서버가 기준. 판정은 lifebc-sv-core.js
// 참가자에게는 본인 비밀이 포함된 화면 정보, 관전자에게는 공개 정보만 보낸다. 진행 상태는 메모리(DB 안 씀). 끊기면 자리는 대역이 맡고 다시 들어오면 복구.
// =========================
import { SvGame } from "./lifebc-sv-core.js";
import { nickOk } from "./lifebc-broadcast.js";
import { METRICS, ROLES, ATTRS, LOCATIONS, QUESTIONS, ANSWERS, CONTRACTS, PROGRAMS } from "./lifebc-sv-core.js";
import { ENDINGS, DIFF } from "./lifebc-sv-data.js";
const META = { METRICS, ROLES, ATTRS, LOCATIONS, QUESTIONS, ANSWERS, CONTRACTS, PROGRAMS, ENDS: Object.fromEntries(Object.entries(ENDINGS).map(([k, v]) => [k, { name: v.name, ic: v.ic, tone: v.tone }])), DIFF: Object.fromEntries(Object.entries(DIFF).map(([k, v]) => [k, { name: v.name }])) };

const ROOMS = new Map(), MAX_ROOMS = Number(process.env.LBS_MAX_ROOMS || 500), TTL = 6 * 3600e3, OVER_TTL = 40 * 60e3, EMPTY_TTL = 15 * 60e3, MAX_SPEC = 200;
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f<>`]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const rk = (c) => `lbs:${c}`, specRoom = (c) => `lbs-spec:${c}`;
const makeCode = () => { const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; for (;;) { let s = ""; for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)]; if (!ROOMS.has(s)) return s; } };
const lobbyView = (r) => ({ code: r.code, max: r.max, diff: r.diff, speed: r.speed, hostSeat: r.players.get(r.hostKey)?.order ?? 0, started: !!r.game, players: [...r.players.values()].sort((a, b) => a.order - b.order).map((p) => ({ nick: p.nick, ready: p.ready, online: p.online, host: p.key === r.hostKey, order: p.order })), spectators: r.spectators.size });

export function registerLifeSurvival(io) {
  const pushAll = (r) => {
    if (r.pushTimer) return; r.pushTimer = setTimeout(() => { r.pushTimer = null; sendAll(r); }, 90);
  };
  const sendAll = (r) => { try { sendAll2(r); } catch (e) { r.sentRev = r.game?.rev; console.warn("[lbs] send", e?.message); } };
  const sendAll2 = (r) => {
    const g = r.game; if (!g) return io.to(rk(r.code)).emit("lbs:lobby", lobbyView(r));
    for (const p of r.players.values()) { if (!p.online || p.seat == null) continue; io.to(p.sock).emit("lbs:state", g.viewFor(p.seat)); }
    if (r.spectators.size) io.to(specRoom(r.code)).emit("lbs:state", g.viewFor(null));
    r.sentRev = g.rev;
  };
  // 시간 흐름은 서버 기준
  setInterval(() => {
    const t = Date.now();
    for (const [code, r] of ROOMS) {
      const g = r.game, anyOn = [...r.players.values()].some((p) => p.online) || r.spectators.size;
      if (!anyOn && t - (r.lastOn || t) > EMPTY_TTL) { ROOMS.delete(code); continue; } if (anyOn) r.lastOn = t;
      if (t - r.createdAt > TTL) { io.to(rk(code)).emit("lbs:closed", { reason: "TTL" }); ROOMS.delete(code); continue; }
      if (r.overAt && t - r.overAt > OVER_TTL) { ROOMS.delete(code); continue; }
      if (!g) continue;
      try { g.tick(); r.tickErr = 0; } catch (e) { console.warn("[lbs] tick", g.phase?.name, e?.message); r.tickErr = (r.tickErr || 0) + 1; try { if (r.tickErr >= 3) { g.crime = null; g.urgent = null; g.emg = null; g.hearing = null; if (r.tickErr >= 6) g.finish("survive"); else g.toNight(); } } catch (e2) { console.warn("[lbs] recover", e2?.message); g.finish("survive"); } }
      if (g.phase.name === "over" && !r.overAt) r.overAt = t;
      if (g.rev !== r.sentRev) sendAll(r);
    }
  }, 250).unref?.();

  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return; const key = (me.isGuest ? "g:" : "u:") + me.id;
    let win = Date.now(), cnt = 0; const limited = (n = 80) => { const t = Date.now(); if (t - win > 10000) { win = t; cnt = 0; } cnt++; return cnt > n; };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => { const reply = typeof cb === "function" ? cb : () => {}; if (limited()) return reply({ ok: false, error: "RATE_LIMITED" }); try { await fn(p && typeof p === "object" ? p : {}, reply); } catch (e) { console.warn("[lbs]", ev, e?.message); reply({ ok: false, error: "SERVER_ERROR" }); } });
    const roomOf = (c) => ROOMS.get(String(c || "").trim().toUpperCase()) || null; const joined = new Set(); const watching = new Set();

    on("lbs:meta", (_p, reply) => reply({ ok: true, meta: META }));
    on("lbs:create", (p, reply) => {
      const nick = clean(p.nick, 14); if (!nick) return reply({ ok: false, error: "NEED_NICK" }); if (!nickOk(nick)) return reply({ ok: false, error: "BAD_NICK" }); if (ROOMS.size >= MAX_ROOMS) return reply({ ok: false, error: "BUSY" });
      for (const [c, r] of ROOMS) if (r.hostKey === key && !r.game) { io.to(rk(c)).emit("lbs:closed", { reason: "HOST_NEW" }); ROOMS.delete(c); }
      const r = { code: makeCode(), hostKey: key, max: Math.max(1, Math.min(15, p.max | 0 || 15)), diff: ["normal", "hard", "expert"].includes(p.diff) ? p.diff : "hard", speed: [0.75, 1, 1.5].includes(+p.speed) ? +p.speed : 1, players: new Map(), spectators: new Set(), createdAt: Date.now(), lastOn: Date.now(), game: null, chatAt: new Map() };
      r.players.set(key, { key, nick, sock: socket.id, online: true, ready: true, order: 0, seat: null }); ROOMS.set(r.code, r); socket.join(rk(r.code)); joined.add(r.code); reply({ ok: true, code: r.code, nick, lobby: lobbyView(r) }); pushAll(r);
    });
    on("lbs:join", (p, reply) => {
      const r = roomOf(p.code); if (!r) return reply({ ok: false, error: "NOT_FOUND" }); let pl = r.players.get(key);
      if (!pl) { if (r.game) return reply({ ok: false, error: "STARTED" }); if (r.banned?.has(key)) return reply({ ok: false, error: "BANNED" }); const nick = clean(p.nick, 14); if (!nick) return reply({ ok: false, error: "NEED_NICK" }); if (!nickOk(nick)) return reply({ ok: false, error: "BAD_NICK" }); if (r.players.size >= r.max) return reply({ ok: false, error: "FULL" }); if ([...r.players.values()].some((x) => x.nick === nick)) return reply({ ok: false, error: "NICK_TAKEN" }); const used = new Set([...r.players.values()].map((x) => x.order)); let order = 0; while (used.has(order)) order++; pl = { key, nick, sock: socket.id, online: true, ready: false, order, seat: null }; r.players.set(key, pl); }
      else { pl.sock = socket.id; pl.online = true; if (r.game && pl.seat != null) r.game.setAway(pl.seat, false); }
      if (watching.has(r.code)) { r.spectators.delete(socket.id); socket.leave(specRoom(r.code)); watching.delete(r.code); } socket.join(rk(r.code)); joined.add(r.code); reply({ ok: true, code: r.code, nick: pl.nick, lobby: lobbyView(r), state: r.game && pl.seat != null ? r.game.viewFor(pl.seat) : null }); pushAll(r);
    });
    on("lbs:spectate", (p, reply) => { const r = roomOf(p.code); if (!r) return reply({ ok: false, error: "NOT_FOUND" }); if (r.players.get(key)?.sock === socket.id) return reply({ ok: false, error: "ALREADY_PLAYER" }); if (r.spectators.size >= MAX_SPEC) return reply({ ok: false, error: "FULL" }); r.spectators.add(socket.id); socket.join(specRoom(r.code)); socket.join(rk(r.code)); watching.add(r.code); reply({ ok: true, code: r.code, lobby: lobbyView(r), state: r.game ? r.game.viewFor(null) : null }); pushAll(r); });
    on("lbs:ready", (p, reply) => { const r = roomOf(p.code), pl = r?.players.get(key); if (!pl || r.game) return reply({ ok: false }); pl.ready = !!p.ready; reply({ ok: true }); pushAll(r); });
    on("lbs:settings", (p, reply) => { const r = roomOf(p.code); if (!r || r.hostKey !== key || r.game) return reply({ ok: false, error: "NOT_HOST" }); if (["normal", "hard", "expert"].includes(p.diff)) r.diff = p.diff; if ([0.75, 1, 1.5].includes(+p.speed)) r.speed = +p.speed; if (p.max) r.max = Math.max(r.players.size, Math.min(15, p.max | 0)); reply({ ok: true }); pushAll(r); });
    on("lbs:kick", (p, reply) => { const r = roomOf(p.code); if (!r || r.hostKey !== key || r.game) return reply({ ok: false }); const pl = [...r.players.values()].find((x) => x.order === (p.order | 0) && x.key !== key); if (!pl) return reply({ ok: false }); r.players.delete(pl.key); (r.banned = r.banned || new Set()).add(pl.key); io.to(pl.sock).emit("lbs:closed", { reason: "KICKED" }); io.sockets.sockets.get(pl.sock)?.leave(rk(r.code)); reply({ ok: true }); pushAll(r); });
    on("lbs:start", (p, reply) => {
      const r = roomOf(p.code); if (!r || r.hostKey !== key) return reply({ ok: false, error: "NOT_HOST" }); if (r.game) return reply({ ok: false, error: "STARTED" }); const list = [...r.players.values()].filter((x) => x.online); if (list.some((x) => !x.ready && x.key !== key)) return reply({ ok: false, error: "NOT_READY" });
      const shuffled = list.slice().sort(() => Math.random() - 0.5); const g = new SvGame({ players: shuffled.map((x) => ({ key: x.key, nick: x.nick })), diff: r.diff, speed: r.speed, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0 }); shuffled.forEach((x, i) => { x.seat = i; }); for (const x of r.players.values()) if (!list.includes(x)) r.players.delete(x.key); r.game = g; g.start(); reply({ ok: true }); sendAll(r);
    });
    on("lbs:act", (p, reply) => { const r = roomOf(p.code), pl = r?.players.get(key); if (!r?.game || pl?.seat == null) return reply({ ok: false, error: "NOT_PLAYER" }); const type = clean(p.type, 16); const res = r.game.act(pl.seat, type, p.d && typeof p.d === "object" ? p.d : {}); reply(res); if (res.ok) pushAll(r); });
    on("lbs:chat", (p, reply) => { const r = roomOf(p.code), pl = r?.players.get(key); if (!pl) return reply({ ok: false }); const t = Date.now(), last = r.chatAt.get(key) || 0; if (t - last < 700) return reply({ ok: false, error: "RATE_LIMITED" }); const text = clean(p.text, 80); if (!text) return reply({ ok: false }); if (!nickOk(text)) return reply({ ok: false, error: "BAD_TEXT" }); r.chatAt.set(key, t); io.to(rk(r.code)).emit("lbs:chat", { nick: pl.nick, seat: pl.seat, text }); reply({ ok: true }); });
    // 시험 전용: LBS_DEBUG=1일 때만 존재 (운영 서버에는 없음)
    if (process.env.LBS_DEBUG === "1") on("lbs:debug", (p, reply) => { const r = roomOf(p.code), g = r?.game; if (!g) return reply({ ok: false }); const hs = g.humans(); if (p.kind === "crime") { g.day = Math.max(g.day, 6); const def = { id: p.id }; void def; import("./lifebc-sv-crime.js").then(({ CASE_BY_ID }) => { g.startCrime(CASE_BY_ID[p.id || "c_sns"], { forceInsider: !p.outsider }); if (p.culpritSeat != null && g.crime) { g.crime.culprit = p.culpritSeat; g.crime.accomplice = p.accSeat ?? null; g.crime.attrs = g.crime.attrs; } reply({ ok: true, culprit: g.crime?.culprit, acc: g.crime?.accomplice }); sendAll(r); }); return; } if (p.kind === "hearing") { g.day = Math.max(g.day, 8); g.hearingQ = { reason: "petition" }; g.openHearing(); reply({ ok: true, chief: g.hearing.chief, seats: hs.map((x) => x.seat) }); return sendAll(r); } if (p.kind === "next") { g.endPhase(); reply({ ok: true, ph: g.phase.name }); return sendAll(r); } if (p.kind === "end") { g.finish(p.id || "survive"); reply({ ok: true }); return sendAll(r); } if (p.kind === "metric") { Object.assign(g.m, p.m); reply({ ok: true }); return sendAll(r); } if (p.kind === "peek") return reply({ ok: true, crime: g.crime && { culprit: g.crime.culprit, acc: g.crime.accomplice, out: g.crime.outsider }, roles: g.seats.map((x) => x.role) }); reply({ ok: false }); });
    on("lbs:leave", (p, reply) => { const r = roomOf(p.code); if (!r) return reply({ ok: true }); if (watching.has(r.code)) { r.spectators.delete(socket.id); socket.leave(specRoom(r.code)); watching.delete(r.code); } const pl = r.players.get(key); if (pl) { if (r.game && pl.seat != null) r.game.leave(pl.seat); r.players.delete(key); if (r.hostKey === key) { const nx = [...r.players.values()].sort((a, b) => a.order - b.order)[0]; if (nx) r.hostKey = nx.key; else if (!r.game) ROOMS.delete(r.code); } } socket.leave(rk(r.code)); joined.delete(r.code); reply({ ok: true }); pushAll(r); });
    socket.on("disconnect", () => { for (const c of joined) { const r = ROOMS.get(c), pl = r?.players.get(key); if (!pl || pl.sock !== socket.id) continue; pl.online = false; if (r.game && pl.seat != null) r.game.setAway(pl.seat, true); else if (r.hostKey === key) { const nx = [...r.players.values()].filter((x) => x.online).sort((a, b) => a.order - b.order)[0]; if (nx) r.hostKey = nx.key; } pushAll(r); } for (const c of watching) { const r = ROOMS.get(c); if (r) { r.spectators.delete(socket.id); pushAll(r); } } });
  });
}
