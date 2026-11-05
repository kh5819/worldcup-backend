// =========================
// 인생 방송국 — 함께 운영 (2~8인 멀티) (lbm:*)
// 시뮬레이션은 방장 브라우저에서만 돈다(방장이 기준). 서버는 중계만 한다:
//   · 방장 → 참가자: 전체 상태(입장·하루 시작), 화면 조각(초당 4번), 방송 화면 조각
//   · 참가자 → 방장: 행동(사건 투표·담당 출연자 지시·편성 제안·우승 예측)
//   · 누구나: 짧은 채팅
// 진행 중 상태는 메모리. DB 안 씀. 방장이 나가면 10분 동안 재접속을 기다린다.
// =========================
import { nickOk } from "./lifebc-broadcast.js";

const ROOMS = new Map();
const MAX_ROOMS = Number(process.env.LBM_MAX_ROOMS || 2000), TTL = 10 * 3600e3, HOST_WAIT = 10 * 60e3;
const now = () => Date.now();
const rk = (code) => `lbm:${code}`;
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f<>`]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const makeCode = () => { const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; for (;;) { let s = ""; for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)]; if (!ROOMS.has(s)) return s; } };
const ACT_TYPES = new Set(["vote", "direct", "plan", "predict", "hello", "resync"]);

function pubPlayers(r) { return [...r.players.values()].sort((a, b) => a.seat - b.seat).map((p) => ({ seat: p.seat, nick: p.nick, online: p.online, host: p.seat === 0 })); }
function emitPlayers(io, r) { io.to(rk(r.code)).emit("lbm:players", { code: r.code, max: r.max, players: pubPlayers(r), hostOnline: !!r.players.get(r.hostKey)?.online }); }

export function registerLifeMulti(io) {
  setInterval(() => {
    const t = now();
    for (const [code, r] of ROOMS) {
      const host = r.players.get(r.hostKey);
      if (t - r.createdAt > TTL || r.closed || (!host?.online && t - (host?.leftAt || t) > HOST_WAIT)) { io.to(rk(code)).emit("lbm:closed", { code, reason: r.closed ? "HOST_CLOSED" : "HOST_GONE" }); ROOMS.delete(code); }
    }
  }, 60e3).unref?.();

  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const key = (me.isGuest ? "g:" : "u:") + me.id;
    let win = now(), cnt = 0;
    const limited = (n) => { const t = now(); if (t - win > 10000) { win = t; cnt = 0; } cnt += 1; return cnt > (n || Number(process.env.LBM_RL || 200)); };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => { const reply = typeof cb === "function" ? cb : () => {}; if (limited()) return reply({ ok: false, error: "RATE_LIMITED" }); try { await fn(p && typeof p === "object" ? p : {}, reply); } catch (e) { console.warn("[lbm]", ev, e?.message); reply({ ok: false, error: "SERVER_ERROR" }); } });
    const roomOf = (code) => ROOMS.get(String(code || "").toUpperCase()) || null;
    const asHost = (code) => { const r = roomOf(code); return r && r.hostKey === key && !r.closed ? r : null; };
    const joined = new Set(); // 이 소켓이 들어간 방

    on("lbm:create", (p, reply) => {
      const nick = clean(p.nick, 16); if (!nick) return reply({ ok: false, error: "NEED_NICK" }); if (!nickOk(nick)) return reply({ ok: false, error: "BAD_NICK" });
      if (ROOMS.size >= MAX_ROOMS) return reply({ ok: false, error: "BUSY" });
      for (const r of ROOMS.values()) if (r.hostKey === key && !r.closed) { r.closed = true; io.to(rk(r.code)).emit("lbm:closed", { code: r.code, reason: "HOST_CLOSED" }); ROOMS.delete(r.code); }
      const max = Math.max(2, Math.min(8, p.max | 0 || 4));
      const r = { code: makeCode(), hostKey: key, max, players: new Map(), createdAt: now(), closed: false, title: clean(p.title, 30) };
      r.players.set(key, { key, seat: 0, nick, sock: socket.id, online: true });
      ROOMS.set(r.code, r); socket.join(rk(r.code)); joined.add(r.code);
      reply({ ok: true, code: r.code, seat: 0, max }); emitPlayers(io, r);
    });

    on("lbm:join", (p, reply) => {
      const r = roomOf(p.code); if (!r || r.closed) return reply({ ok: false, error: "NOT_FOUND" });
      let pl = r.players.get(key);
      if (!pl) {
        const nick = clean(p.nick, 16); if (!nick) return reply({ ok: false, error: "NEED_NICK" }); if (!nickOk(nick)) return reply({ ok: false, error: "BAD_NICK" });
        if (r.players.size >= r.max) return reply({ ok: false, error: "FULL" });
        if ([...r.players.values()].some((x) => x.nick === nick)) return reply({ ok: false, error: "NICK_TAKEN" });
        const used = new Set([...r.players.values()].map((x) => x.seat)); let seat = 1; while (used.has(seat)) seat++;
        pl = { key, seat, nick, sock: socket.id, online: true }; r.players.set(key, pl);
      } else { pl.sock = socket.id; pl.online = true; pl.leftAt = null; }
      socket.join(rk(r.code)); joined.add(r.code);
      const host = r.players.get(r.hostKey);
      reply({ ok: true, code: r.code, seat: pl.seat, nick: pl.nick, max: r.max, isHost: pl.seat === 0, hostOnline: !!host?.online, title: r.title });
      emitPlayers(io, r);
      if (pl.seat !== 0 && host?.online) io.to(host.sock).emit("lbm:act", { seat: pl.seat, nick: pl.nick, type: "hello" });
    });

    on("lbm:leave", (p, reply) => {
      const r = roomOf(p.code); if (!r) return reply({ ok: true });
      if (r.hostKey === key) { r.closed = true; io.to(rk(r.code)).emit("lbm:closed", { code: r.code, reason: "HOST_CLOSED" }); ROOMS.delete(r.code); return reply({ ok: true }); }
      const pl = r.players.get(key); if (pl) { r.players.delete(key); const host = r.players.get(r.hostKey); if (host?.online) io.to(host.sock).emit("lbm:act", { seat: pl.seat, nick: pl.nick, type: "bye" }); }
      socket.leave(rk(r.code)); joined.delete(r.code); emitPlayers(io, r); reply({ ok: true });
    });

    on("lbm:kick", (p, reply) => {
      const r = asHost(p.code); if (!r) return reply({ ok: false, error: "NOT_HOST" });
      const pl = [...r.players.values()].find((x) => x.seat === (p.seat | 0) && x.seat !== 0); if (!pl) return reply({ ok: false, error: "NO_PLAYER" });
      r.players.delete(pl.key); io.to(pl.sock).emit("lbm:closed", { code: r.code, reason: "KICKED" }); io.sockets.sockets.get(pl.sock)?.leave(rk(r.code));
      emitPlayers(io, r); reply({ ok: true });
    });

    // 방장 → 참가자: 전체 상태 (seat 지정 시 그 사람만)
    on("lbm:full", (p, reply) => {
      const r = asHost(p.code); if (!r) return reply({ ok: false, error: "NOT_HOST" });
      if (typeof p.json !== "string" || p.json.length > 900000) return reply({ ok: false, error: "TOO_BIG" });
      const msg = { json: p.json, rev: p.rev | 0 };
      if (p.seat != null) { const pl = [...r.players.values()].find((x) => x.seat === (p.seat | 0)); if (pl?.online) io.to(pl.sock).emit("lbm:full", msg); }
      else socket.to(rk(r.code)).emit("lbm:full", msg);
      reply({ ok: true });
    });
    // 방장 → 참가자: 화면 조각 (자주, 잃어도 됨)
    socket.on("lbm:snap", (p) => {
      if (!p || typeof p !== "object") return; const r = asHost(p.code); if (!r) return;
      if (typeof p.d !== "string" || p.d.length > 120000) return;
      socket.volatile.to(rk(r.code)).emit("lbm:snap", { d: p.d, k: p.k === "show" ? "show" : p.k === "slow" ? "slow" : "fast" });
    });
    // 참가자 → 방장: 행동
    on("lbm:act", (p, reply) => {
      const r = roomOf(p.code); if (!r || r.closed) return reply({ ok: false, error: "NOT_FOUND" });
      const pl = r.players.get(key); if (!pl || pl.seat === 0) return reply({ ok: false, error: "NOT_PLAYER" });
      const type = String(p.type || ""); if (!ACT_TYPES.has(type)) return reply({ ok: false, error: "BAD_TYPE" });
      const host = r.players.get(r.hostKey); if (!host?.online) return reply({ ok: false, error: "HOST_OFFLINE" });
      const out = { seat: pl.seat, nick: pl.nick, type };
      for (const k of ["ev", "choice", "cast", "kind", "target", "slot", "show"]) if (p[k] != null) out[k] = clean(p[k], 40);
      io.to(host.sock).emit("lbm:act", out); reply({ ok: true });
    });
    // 방장 → 특정 참가자: 행동 결과 안내
    on("lbm:notice", (p, reply) => {
      const r = asHost(p.code); if (!r) return reply({ ok: false });
      const pl = [...r.players.values()].find((x) => x.seat === (p.seat | 0)); if (pl?.online) io.to(pl.sock).emit("lbm:notice", { text: p.text && typeof p.text === "object" ? { ko: clean(p.text.ko, 120), ja: clean(p.text.ja, 120), en: clean(p.text.en, 120) } : clean(p.text, 120) });
      reply({ ok: true });
    });
    // 채팅 (모두)
    on("lbm:chat", (p, reply) => {
      const r = roomOf(p.code); if (!r) return reply({ ok: false }); const pl = r.players.get(key); if (!pl) return reply({ ok: false });
      if (limited(120)) return reply({ ok: false, error: "RATE_LIMITED" });
      const text = clean(p.text, 60); if (!text) return reply({ ok: false }); if (!nickOk(text)) return reply({ ok: false, error: "BAD_TEXT" });
      io.to(rk(r.code)).emit("lbm:chat", { seat: pl.seat, nick: pl.nick, text }); reply({ ok: true });
    });

    socket.on("disconnect", () => {
      for (const code of joined) { const r = ROOMS.get(code); if (!r) continue; const pl = r.players.get(key); if (!pl || pl.sock !== socket.id) continue; pl.online = false; pl.leftAt = now(); emitPlayers(io, r); if (pl.seat !== 0) { const host = r.players.get(r.hostKey); if (host?.online) io.to(host.sock).emit("lbm:act", { seat: pl.seat, nick: pl.nick, type: "away" }); } }
    });
  });
}
