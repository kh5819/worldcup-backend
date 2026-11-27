// =========================
// 격리구역: 제로 (CONTAINMENT ZERO) — 서버: 2~8인 협동 · 스트리머 모드(관전·투표·시청자 직원·후원) · 방송 오버레이
// - 서버가 엔진(zero/zero-core.js, 화면과 같은 파일)으로 시설을 돌리고 판정. 클라는 명령만 보냄(자원·능력치 조작 불가)
// - 역할 8종: 관리자(전부) · 연구 · 보안 · 의료 · 기술 · 인사 · 기록 · 탐사. 사람이 적으면 한 사람이 여러 역할, 끊긴 사람 역할은 방장이 임시로 맡음
// - 같은 직원에게 2.5초 안에 다른 사람이 지시하면 거절(누가 했는지 알려 줌)
// - 상태 보내기: 가벼운 프레임 1초 5번(위치·수치·새 기록) + 전체 상태 2초마다·명령 직후. 시청자도 같은 프레임을 방 단위로 한 번만 만들어 보냄
// - 스트리머: 시청자 투표(지원 물자·환경 변이·집중 연구·사건 선택, 웹 + 채팅 !1~!4, 한 사람 한 표) · 시청자 직원 지원(방장 승인/자동) · 후원 금액별 효과(고유 ID로 한 번만)
// =========================
import * as C from "./zero/zero-core.js";
import * as D from "./zero/zero-data.js";
import * as K from "./zero/zero-content.js";
import * as UG from "./zero/zero-ugc.js";
import { parseAmount, cleanDonor } from "./duowars-stream.js";
import { logGameStreamer } from "./stream-log.js";

const F = process.env.ZERO_FAST ? Number(process.env.ZERO_FAST) : 1;      // 시험 전용: 시간 줄이기
const ROOMS = new Map(), dailyCache = new Map();
const kstDay = (off = 0) => new Date(Date.now() + 9 * 3600000 + off * 86400000).toISOString().slice(0, 10);
const MAX_PLAYERS = 8, MAX_VIEWERS = 500, IDLE_DROP_MS = 15 * 60000, CONFLICT_MS = 2500, EVENT_MS = 40000 * F, VOTE_MS = 25000 * F, VOTE_GAP_MS = 75000 * F, SOOP_BALLOON_KRW = 100;
export const ROLES = ["manager", "research", "security", "medical", "tech", "hr", "records", "explore"];
const code5 = () => { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };
const clean = (s) => String(s || "").replace(/[<>\r\n\t]/g, "").trim().slice(0, 12);
const ch = (code) => `zero:${code}`, vch = (code) => `zero:${code}:v`;
let HOOKS = {};
export const ST_KINDS = ["supply", "env", "viewer", "research", "cand", "big"];
const defaultStream = () => ({ rules: { supply: 1000, env: 1100, viewer: 2000, research: 3000, cand: 5000, big: 10000 }, autoApprove: false, votes: true, voteEvents: true, cooldown: 20, dayCap: 12, link: { status: "off", platform: null, nickname: null, donation: false, error: null }, log: [], recent: new Map(), vote: null, nextVote: 0, rot: 0, voters: 0, feed: [], applicants: [], lastDon: 0, donToday: 0, donDay: 0 });

// 명령별 필요한 역할
function needRoles(c) {
  switch (c.k) {
    case "start": case "next": case "endless": return ["host"];
    case "order": { const k = c.task?.k; if (k === "research") return ["research", "records", "explore"]; if (k === "fight" || k === "recon") return ["security", "explore"]; if (k === "treat") return ["medical"]; if (k === "repair" || k === "clear") return ["tech", "security"]; return ["*"]; }
    case "cancel": case "auto": return ["*"];
    case "judge": return ["research", "records"];
    case "mute": case "lock": return ["security"];
    case "emerg": return ["tech"];
    case "build": case "demolish": return ["tech"];
    case "hire": case "equip": case "craft": return ["hr"];
    case "admit": return ["hr", "explore"];
    case "choose": return ["manager"];
  }
  return ["manager"];
}
function myRoles(r, uid) {
  const p = r.players.find((x) => x.uid === uid); if (!p) return [];
  const roles = new Set(p.roles); if (r.host === uid) { roles.add("manager"); roles.add("host"); for (const q of r.players) if (!q.on) for (const x of q.roles) roles.add(x); }
  return [...roles];
}
function allowed(r, uid, c) { const need = needRoles(c), mine = myRoles(r, uid); if (mine.includes("manager") && !need.includes("host")) return true; return need.includes("*") || need.some((x) => mine.includes(x)); }
// 역할 자동 배정 (방장 = 관리자, 나머지 역할은 돌아가며)
function autoRoles(r) {
  const ps = r.players; for (const p of ps) p.roles = [];
  const host = ps.find((p) => p.uid === r.host) || ps[0]; if (host) host.roles.push("manager");
  const others = ps.filter((p) => p !== host), rest = ROLES.slice(1);
  if (!others.length) { if (host) host.roles.push(...rest); return; }
  rest.forEach((role, i) => others[i % others.length].roles.push(role));
}

// ---------- 상태 보내기 ----------
function fullState(S) { return { ...S, log: S.log.slice(-60), fx: S.fx.slice(-20) }; }
function lightFrame(r) {
  const S = r.S, lastLog = r.sentLog, lastFx = r.sentFx;
  const logs = []; for (let i = S.log.length - 1; i >= 0 && logs.length < 30; i--) { const e = S.log[i]; if (e === lastLog) break; logs.unshift(e); }
  const fxs = S.fx.filter((e) => e.n > lastFx); r.sentLog = S.log[S.log.length - 1]; r.sentFx = S.fx.length ? S.fx[S.fx.length - 1].n : lastFx;
  return {
    tick: S.tick, min: S.min, day: S.day, phase: S.phase, res: S.res, gen: S.gen, emerg: S.emerg, emergCd: S.emergCd, emergFree: S.emergFree, muted: S.muted, liftBlocked: S.liftBlocked, dark: S.dark, ev: S.ev.cur, metDays: S.metDays, ending: S.ending, focus: S.focus, boost: S.boost,
    st: S.staff.map((s) => [s.id, s.f, Math.round(s.x * 10) / 10, s.anim, s.dir, Math.round(s.hp * 10) / 10, Math.round(s.stress * 10) / 10, Math.round(s.fat), s.cond, s.panic ? 1 : 0, s.ride, s.task, s.prog ? Math.round(s.prog * 100) / 100 : 0, s.path ? 1 : 0, s.hitT || 0]),
    an: S.anoms.map((a) => [a.id, a.f, Math.round(a.x * 10) / 10, a.st, Math.round(a.stab * 10) / 10, Math.round(a.hp), a.room, a.mood, a.big ? 1 : 0, a.copy || 0, a.flower, a.dir || 1]),
    rm: S.rooms.map((q) => (q.alarm ? 1 : 0) + (q.flick ? 2 : 0) + (q.zone ? ["", "vines", "paper", "chairs"].indexOf(q.zone) * 4 : 0)),
    dl: S.doors.map((d) => (d.lock ? 1 : 0)),
    logs, fxs,
  };
}
function roomPub(r, uid) {
  return { code: r.code, mode: r.mode, host: r.host, status: r.status, speed: r.speed, diff: r.diff, lateJoin: r.lateJoin, players: r.players.map((p) => ({ uid: p.uid, name: p.name, roles: p.roles, on: p.on })), me: uid, myRoles: uid ? myRoles(r, uid) : [], viewers: r.viewers.size, evVote: r.evVote ? { until: r.evVote.until, counts: r.evVote.counts } : null, stream: r.st ? streamPub(r) : null };
}
function streamPub(r) { const s = r.st; return { rules: s.rules, autoApprove: s.autoApprove, votes: s.votes, voteEvents: s.voteEvents, link: s.link, vote: s.vote ? { id: s.vote.id, kind: s.vote.kind, opts: s.vote.opts, counts: s.vote.counts, until: s.vote.until, result: s.vote.result } : null, voters: s.voters, feed: s.feed.slice(-8), applicants: s.applicants.slice(0, 20), log: s.log.slice(-8) }; }
function emitRoom(io, r) { for (const [sid, uid] of r.socks) io.to(sid).emit("zero:room", roomPub(r, uid)); if (r.viewers.size && !r.vrt) r.vrt = setTimeout(() => { r.vrt = null; io.to(vch(r.code)).emit("zero:room", roomPub(r, null)); }, 300); }
function emitFull(io, r) { if (!r.S) return; const st = fullState(r.S); r.sentLog = r.S.log[r.S.log.length - 1]; r.sentFx = r.S.fx.length ? r.S.fx[r.S.fx.length - 1].n : 0; io.to(ch(r.code)).emit("zero:full", st); if (r.viewers.size) io.to(vch(r.code)).emit("zero:full", st); r.lastFull = Date.now(); r.dirty = false; }
function emitLight(io, r) { if (!r.S) return; const f = lightFrame(r); io.to(ch(r.code)).emit("zero:tick", f); if (r.viewers.size) io.to(vch(r.code)).emit("zero:tick", f); }

// ---------- 투표 (스트리머) ----------
function makeVote(r, kind) {
  const S = r.S, inA = S.anoms.filter((a) => a.st === "in");
  if (kind === "supply" || kind === "env") return { kind, opts: C.VOTE_OPTS[kind].map((n, i) => ({ n, opt: i })) };
  if (kind === "focus") { if (inA.length < 2) return null; const pool = [...inA].sort(() => Math.random() - 0.5).slice(0, 3); return { kind, opts: pool.map((a) => ({ n: a.stage >= 1 ? D.ANOMS[a.id].name : [D.ANOMS[a.id].no, D.ANOMS[a.id].no, D.ANOMS[a.id].no], aid: a.id })) }; }
  if (kind === "event") { const E = K.EVENTS.find((e) => e.id === S.ev.cur?.id); if (!E) return null; return { kind, opts: E.ch.map((c, i) => ({ n: [0, 1, 2].map((li) => C.evText(S, c.t, li)), opt: i })) }; }
  return null;
}
function openVote(io, r, kind) { const v = makeVote(r, kind); if (!v) return false; r.st.vote = { id: Date.now().toString(36), kind, opts: v.opts, counts: v.opts.map(() => 0), by: new Map(), until: Date.now() + VOTE_MS, result: null }; emitRoom(io, r); return true; }
function castVote(io, r, key, nick, idx) {
  const v = r.st?.vote; if (!v || v.result != null || Date.now() > v.until) return "NO_VOTE";
  if (!Number.isInteger(idx) || idx < 0 || idx >= v.opts.length) return "BAD_OPT";
  if (v.by.has(key)) { const old = v.by.get(key); if (old === idx) return null; v.counts[old]--; } else r.st.voters++;
  v.by.set(key, idx); v.counts[idx]++;
  if (nick) { r.st.feed.push({ nick: String(nick).slice(0, 12), i: idx }); if (r.st.feed.length > 30) r.st.feed.shift(); }
  if (!r.vvt) r.vvt = setTimeout(() => { r.vvt = null; emitRoom(io, r); }, 300);
  return null;
}
function closeVote(io, r) {
  const v = r.st.vote; if (!v || v.result != null) return;
  let best = 0; v.counts.forEach((c, i) => { if (c > v.counts[best]) best = i; });
  if (!v.counts.some((c) => c > 0)) best = Math.floor(Math.random() * v.opts.length);
  v.result = best; const o = v.opts[best];
  if (v.kind === "event") { if (r.S.ev.cur) C.cmd(r.S, { k: "choose", i: o.opt }); }
  else if (v.kind === "focus") C.streamApply(r.S, "focus", { aid: o.aid });
  else C.streamApply(r.S, v.kind, { opt: o.opt });
  r.dirty = true; emitRoom(io, r);
  setTimeout(() => { if (r.st?.vote === v) { r.st.vote = null; r.st.nextVote = Date.now() + VOTE_GAP_MS; emitRoom(io, r); } }, 4000 * F);
}
function receiveDonation(io, r, d) {
  const s = r.st, amount = d.amount, kind = ST_KINDS.find((k) => s.rules[k] === amount) || null;
  const rec = { at: Date.now(), donor: cleanDonor ? cleanDonor(d.donor) : clean(d.donor), amount, kind, status: "no_match", test: !!d.test };
  if (kind) {
    const day = r.S?.day || 0; if (s.donDay !== day) { s.donDay = day; s.donToday = 0; }
    if (!r.S || r.status !== "play") rec.status = "not_playing";
    else if (Date.now() - s.lastDon < s.cooldown * 1000 * F) rec.status = "cooldown";
    else if (s.donToday >= s.dayCap) rec.status = "cap";
    else {
      const res = C.streamApply(r.S, kind, kind === "supply" || kind === "env" ? { opt: Math.floor(Math.random() * 3), donor: rec.donor } : kind === "viewer" ? { name: rec.donor, from: "donation", donor: rec.donor } : { donor: rec.donor });
      rec.status = res.ok ? "applied" : "skipped"; if (res.ok) { s.lastDon = Date.now(); s.donToday++; r.dirty = true; }
    }
  }
  s.log.push(rec); if (s.log.length > 40) s.log.shift();
  io.to(ch(r.code)).emit("zero:don", rec); if (r.viewers.size) io.to(vch(r.code)).emit("zero:don", rec);
  emitRoom(io, r); return rec;
}
function onPlatformDonation(io, r, platform, raw) {
  let data = raw; if (typeof data === "string") { try { data = JSON.parse(data); } catch { return; } }
  if (!data || typeof data !== "object" || ROOMS.get(r.code) !== r || !r.st) return;
  let amount = null;
  if (platform === "chzzk") amount = parseAmount(String(data.payAmount ?? "").replace(/[,\s]/g, ""));
  else if (platform === "soop") { const n = Number(data.balloons); amount = Number.isSafeInteger(n) && n > 0 ? parseAmount(n * SOOP_BALLOON_KRW) : null; }
  else if (platform === "cime") { const beam = Number(String(data.payAmountNumber ?? data.payAmount ?? "").replace(/[,\s]/g, "")); amount = Number.isSafeInteger(beam) ? parseAmount(beam) : null; }
  if (amount === null) return;
  const s = r.st, t = Date.now(), uidKey = data.donationId || data.id || data.eventId || data.msgId || null;
  const key = uidKey ? `id:${platform}:${uidKey}` : `h:${[platform, data.channelId || "", data.donatorChannelId || "anon", amount, String(data.donationText || "").slice(0, 60)].join("|")}`;
  const prev = s.recent.get(key); if (prev != null && (uidKey || t - prev < 3000)) return;
  s.recent.set(key, t); if (s.recent.size > 500) for (const [k, v] of s.recent) if (t - v > 600000) s.recent.delete(k);
  receiveDonation(io, r, { donor: data.donatorNickname || data.nickname || "익명 후원자", amount });
}
function onPlatformChat(io, r, evt) {
  try {
    const text = String(evt?.content ?? evt?.message ?? evt?.msg ?? "").trim(); const who = String(evt?.senderChannelId ?? evt?.userId ?? evt?.profile?.nickname ?? ""); if (!who) return;
    const nick = evt?.profile?.nickname || evt?.nickname || null;
    const m = text.match(/^!\s*([1-4])$/); if (m) return castVote(io, r, "c:" + who, nick, +m[1] - 1);
    if (/^!(지원|join|応募)$/i.test(text) && nick) applyViewer(io, r, "c:" + who, nick);
  } catch {}
}
function applyViewer(io, r, key, nick) {
  const s = r.st, name = clean(nick); if (!name) return "NAME";
  if (s.applicants.some((a) => a.key === key || a.name === name) || r.S?.staff.some((x) => x.name[0] === name)) return "DUP";
  if (s.applicants.length >= 50) return "FULL";
  s.applicants.push({ key, name, at: Date.now() });
  if (s.autoApprove && r.status === "play") approveViewer(io, r, name);
  emitRoom(io, r); return null;
}
function approveViewer(io, r, name) {
  const s = r.st, i = s.applicants.findIndex((a) => a.name === name); if (i < 0 || !r.S) return "NONE";
  const res = C.streamApply(r.S, "viewer", { name, from: "viewer" }); if (!res.ok) return res.err;
  s.applicants.splice(i, 1); r.dirty = true; emitRoom(io, r); return null;
}

// ---------- 등록 ----------
export function registerZero(io, supabaseAdmin, hooks = {}) {
  HOOKS = hooks || {};
  // 시뮬레이션: 0.1초마다 (배속 2면 두 번)
  setInterval(() => {
    const now = Date.now();
    for (const r of ROOMS.values()) {
      try {
        if (r.status === "play" && r.S) {
          const S = r.S;
          if (S.phase === "work" && !S.ev.cur && r.speed > 0) { for (let i = 0; i < r.speed; i++) { C.step(S); if (S.phase !== "work" || S.ev.cur) break; } }
          // 사건: 관리자가 고르거나(스트리머면 시청자 투표) 시간이 지나면 투표/무작위
          if (S.ev.cur) {
            if (!r.evAt || r.evKey !== S.ev.cur.id + S.ev.cur.at) { r.evAt = now; r.evKey = S.ev.cur.id + S.ev.cur.at; r.dirty = true; if (r.st?.voteEvents && r.st.votes && !r.st.vote) openVote(io, r, "event"); }
            else if (now - r.evAt > EVENT_MS && !r.st?.vote) { const E = K.EVENTS.find((e) => e.id === S.ev.cur.id); C.cmd(S, { k: "choose", i: Math.floor(Math.random() * (E?.ch.length || 1)) }); r.dirty = true; }
          }
          if (r.st) {
            if (r.st.vote && r.st.vote.result == null && now > r.st.vote.until) closeVote(io, r);
            if (r.st.votes && !r.st.vote && S.phase === "work" && !S.ev.cur && now > r.st.nextVote && r.speed > 0) { const kinds = ["supply", "focus", "env"]; for (let k = 0; k < 3; k++) { if (openVote(io, r, kinds[(r.st.rot + k) % 3])) { r.st.rot = (r.st.rot + k + 1) % 3; break; } } if (!r.st.vote) r.st.nextVote = now + VOTE_GAP_MS; }
            if (r.st.autoApprove && r.st.applicants.length && S.phase === "work" && now - (r.lastAppr || 0) > 5000) { r.lastAppr = now; approveViewer(io, r, r.st.applicants[0].name); }
          }
          if (S.phase !== r.lastPhase || S.ending !== r.lastEnding) { r.lastPhase = S.phase; r.lastEnding = S.ending; r.dirty = true; }
          r.tk = (r.tk || 0) + 1;
          if (r.dirty || now - (r.lastFull || 0) > 2000) emitFull(io, r); else if (r.tk % 2 === 0) emitLight(io, r);
        }
        const anyOn = r.players.some((p) => p.on) || r.viewers.size; if (anyOn) r.lastOn = now; else if (now - r.lastOn > IDLE_DROP_MS) dropRoom(r);
      } catch (e) { console.error("[zero] tick", e); }
    }
  }, 100).unref?.();
  const dropRoom = (r) => { ROOMS.delete(r.code); if (r.st) { try { HOOKS.unlinkChat?.("dw_zr_" + r.code); } catch {} } };

  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const uid = String(me.id);
    let win = Date.now(), cnt = 0;
    const limited = () => { const n = Date.now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > 150; };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => { const reply = typeof cb === "function" ? cb : () => {}; if (limited()) return reply({ ok: false, err: "rate" }); try { await fn(p || {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, err: "internal" }); } });
    const room = (code) => ROOMS.get(String(code || "").toUpperCase());
    const myRoom = (code) => { const r = room(code); return r && r.socks.has(socket.id) ? r : null; };
    const join = (r, name) => {
      let p = r.players.find((x) => x.uid === uid);
      if (!p) { if (r.players.length >= MAX_PLAYERS) return "full"; if (r.status !== "lobby" && !r.lateJoin) return "started"; p = { uid, name: clean(name) || "Agent", roles: [], on: true }; r.players.push(p); autoRoles(r); if (r.S) r.S.players = r.players.length; }
      p.on = true; if (name) p.name = clean(name) || p.name;
      r.socks.set(socket.id, uid); socket.join(ch(r.code)); return null;
    };

    on("zero:create", (p, reply) => {
      for (const o of [...ROOMS.values()]) if (o.status === "lobby" && o.players.length <= 1 && o.host === uid) dropRoom(o);
      if (ROOMS.size >= 2000) return reply({ ok: false, err: "busy" });
      let code; do code = code5(); while (ROOMS.has(code));
      const stream = !!p.stream;
      const r = { code, mode: stream ? "stream" : "coop", status: "lobby", host: uid, players: [], socks: new Map(), viewers: new Map(), S: null, speed: 1, diff: D.DIFFS[p.diff] ? p.diff : "normal", lateJoin: true, last: new Map(), lastOn: Date.now(), st: stream ? defaultStream() : null };
      ROOMS.set(code, r); join(r, p.name);
      if (stream) logGameStreamer("zero", { hostUserId: uid, code, players: new Map([[uid, { name: r.players[0].name }]]) });
      reply({ ok: true, room: roomPub(r, uid) }); emitRoom(io, r);
    });
    on("zero:join", (p, reply) => {
      const r = room(p.code); if (!r) return reply({ ok: false, err: "noroom" });
      const e = join(r, p.name); if (e) return reply({ ok: false, err: e });
      reply({ ok: true, room: roomPub(r, uid), state: r.S ? fullState(r.S) : null }); emitRoom(io, r);
    });
    on("zero:watch", (p, reply) => {
      const r = room(p.code); if (!r) return reply({ ok: false, err: "noroom" }); if (r.viewers.size >= MAX_VIEWERS) return reply({ ok: false, err: "full" });
      r.viewers.set(socket.id, { uid, nick: clean(p.nick) }); socket.join(vch(r.code));
      reply({ ok: true, room: roomPub(r, null), state: r.S ? fullState(r.S) : null }); emitRoom(io, r);
    });
    on("zero:leave", (p, reply) => {
      const r = room(p.code); if (!r) return reply({ ok: true });
      if (r.viewers.delete(socket.id)) socket.leave(vch(r.code));
      if (r.socks.has(socket.id)) { r.socks.delete(socket.id); socket.leave(ch(r.code)); leavePlayer(r); }
      reply({ ok: true });
    });
    const leavePlayer = (r) => {
      if ([...r.socks.values()].includes(uid)) return;
      const i = r.players.findIndex((x) => x.uid === uid); if (i < 0) return;
      if (r.status === "lobby") { r.players.splice(i, 1); autoRoles(r); } else r.players[i].on = false;
      if (r.host === uid) { const nh = r.players.find((x) => x.on); if (nh) { r.host = nh.uid; if (r.status === "lobby") autoRoles(r); } }
      if (!r.players.some((x) => x.on) && !r.viewers.size && r.status === "lobby") dropRoom(r); else emitRoom(io, r);
    };
    on("zero:roles", (p, reply) => {
      const r = myRoom(p.code); if (!r || r.host !== uid) return reply({ ok: false, err: "host" });
      const t = r.players.find((x) => x.uid === String(p.uid)); if (!t) return reply({ ok: false, err: "who" });
      const roles = (Array.isArray(p.roles) ? p.roles : []).filter((x) => ROLES.includes(x)); t.roles = [...new Set(roles)];
      for (const q of r.players) if (q !== t) q.roles = q.roles.filter((x) => !t.roles.includes(x));
      for (const role of ROLES) if (!r.players.some((q) => q.roles.includes(role))) (r.players.find((q) => q.uid === r.host) || r.players[0]).roles.push(role);
      emitRoom(io, r); reply({ ok: true });
    });
    on("zero:opts", (p, reply) => {
      const r = myRoom(p.code); if (!r || r.host !== uid) return reply({ ok: false, err: "host" });
      if (p.diff && D.DIFFS[p.diff] && r.status === "lobby") r.diff = p.diff; if (p.lateJoin != null) r.lateJoin = !!p.lateJoin;
      if (p.speed != null && [0, 1, 2].includes(+p.speed)) r.speed = +p.speed;
      emitRoom(io, r); reply({ ok: true });
    });
    on("zero:begin", (p, reply) => {
      const r = myRoom(p.code); if (!r || r.host !== uid) return reply({ ok: false, err: "host" }); if (r.status !== "lobby") return reply({ ok: false, err: "phase" });
      r.S = C.newGame({ seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0, diff: r.diff, players: r.players.length }); r.status = "play"; r.dirty = true;
      emitRoom(io, r); emitFull(io, r); reply({ ok: true });
    });
    on("zero:cmd", (p, reply) => {
      const r = myRoom(p.code); if (!r || !r.S || r.status !== "play") return reply({ ok: false, err: "phase" });
      const c = p.c && typeof p.c === "object" ? p.c : null; if (!c || typeof c.k !== "string") return reply({ ok: false, err: "bad" });
      if (!allowed(r, uid, c)) return reply({ ok: false, err: "role" });
      if (c.k === "order" || c.k === "cancel") { const prev = r.last.get(c.sid); if (prev && prev.uid !== uid && Date.now() - prev.at < CONFLICT_MS) { const who = r.players.find((x) => x.uid === prev.uid)?.name || ""; return reply({ ok: false, err: "conflict", who }); } }
      const res = C.cmd(r.S, c);
      if (res.ok) { if (c.k === "order" || c.k === "cancel") r.last.set(c.sid, { uid, at: Date.now() }); if (c.k === "choose" && r.st?.vote?.kind === "event") { r.st.vote = null; r.st.nextVote = Date.now() + VOTE_GAP_MS; emitRoom(io, r); } r.dirty = true; }
      reply(res);
    });
    on("zero:ping", (p, reply) => { const r = myRoom(p.code); if (!r) return reply({ ok: false }); const me2 = r.players.find((x) => x.uid === uid); io.to(ch(r.code)).emit("zero:ping", { from: me2?.name || "", what: ["pause", "help", "look"].includes(p.what) ? p.what : "look", f: p.f | 0, x: +p.x || 0 }); reply({ ok: true }); });
    on("zero:full", (p, reply) => { const r = room(p.code); if (!r || (!r.socks.has(socket.id) && !r.viewers.has(socket.id))) return reply({ ok: false }); reply({ ok: true, state: r.S ? fullState(r.S) : null, room: roomPub(r, r.socks.has(socket.id) ? uid : null) }); });
    // ── 스트리머 ──
    on("zero:vote", (p, reply) => { const r = room(p.code); if (!r || !r.st) return reply({ ok: false, err: "noroom" }); if (!r.viewers.has(socket.id) && !r.socks.has(socket.id)) return reply({ ok: false, err: "notin" }); const e = castVote(io, r, "u:" + uid, clean(p.nick) || r.viewers.get(socket.id)?.nick, p.i | 0); reply(e ? { ok: false, err: e } : { ok: true }); });
    on("zero:apply", (p, reply) => { const r = room(p.code); if (!r || !r.st) return reply({ ok: false, err: "noroom" }); if (!r.viewers.has(socket.id)) return reply({ ok: false, err: "notin" }); const e = applyViewer(io, r, "u:" + uid, p.nick); reply(e ? { ok: false, err: e } : { ok: true }); });
    on("zero:approve", (p, reply) => { const r = myRoom(p.code); if (!r || !r.st || r.host !== uid) return reply({ ok: false, err: "host" }); if (p.reject) { r.st.applicants = r.st.applicants.filter((a) => a.name !== p.name); emitRoom(io, r); return reply({ ok: true }); } const e = approveViewer(io, r, String(p.name || "")); reply(e ? { ok: false, err: e } : { ok: true }); });
    on("zero:stream", (p, reply) => {
      const r = myRoom(p.code); if (!r || !r.st || r.host !== uid) return reply({ ok: false, err: "host" }); const s = r.st;
      if (p.rules && typeof p.rules === "object") { const next = { ...s.rules }; for (const k of ST_KINDS) if (p.rules[k] !== undefined) { const v = parseAmount(Number(p.rules[k])); if (v === null) return reply({ ok: false, err: "amount" }); next[k] = v; } if (new Set(Object.values(next)).size !== ST_KINDS.length) return reply({ ok: false, err: "same" }); s.rules = next; }
      for (const k of ["autoApprove", "votes", "voteEvents"]) if (p[k] !== undefined) s[k] = !!p[k];
      if (p.cooldown != null) s.cooldown = Math.max(0, Math.min(300, p.cooldown | 0)); if (p.dayCap != null) s.dayCap = Math.max(1, Math.min(50, p.dayCap | 0));
      emitRoom(io, r); reply({ ok: true });
    });
    on("zero:streamTest", (p, reply) => { const r = myRoom(p.code); if (!r || !r.st || r.host !== uid) return reply({ ok: false, err: "host" }); if (!ST_KINDS.includes(p.kind)) return reply({ ok: false, err: "kind" }); reply({ ok: true, rec: receiveDonation(io, r, { donor: clean(p.nick) || "테스트 후원자", amount: r.st.rules[p.kind], test: true }) }); });
    on("zero:voteNow", (p, reply) => { const r = myRoom(p.code); if (!r || !r.st || r.host !== uid || !r.S) return reply({ ok: false, err: "host" }); if (r.st.vote) return reply({ ok: false, err: "voting" }); reply({ ok: openVote(io, r, ["supply", "env", "focus", "event"].includes(p.kind) ? p.kind : "supply") }); });
    on("zero:streamLink", async (p, reply) => {
      const r = myRoom(p.code); if (!r || !r.st || r.host !== uid) return reply({ ok: false, err: "host" }); if (!HOOKS.linkChat) return reply({ ok: false, err: "nolinker" });
      const platform = ["chzzk", "cime", "soop"].includes(p.platform) ? p.platform : null; if (!platform) return reply({ ok: false, err: "platform" });
      if (platform === "soop" ? !p.url : !p.accessToken) return reply({ ok: false, err: "token" });
      const key = "dw_zr_" + r.code; r.st.link = { status: "connecting", platform, nickname: null, donation: false, error: null }; emitRoom(io, r);
      try {
        const res = await HOOKS.linkChat({ platform, key, accessToken: platform === "soop" ? null : String(p.accessToken), soopUrl: platform === "soop" ? String(p.url).slice(0, 200) : null, channelId: p.channelId ? String(p.channelId) : null, nickname: p.nickname ? String(p.nickname).slice(0, 30) : null, hostUserId: me.isGuest ? null : uid, roomCode: r.code, contentMode: "zero",
          onDonation: (d) => onPlatformDonation(io, r, platform, d), onChat: (evt) => onPlatformChat(io, r, evt),
          onClose: () => { if (ROOMS.get(r.code) !== r) return; r.st.link = { ...r.st.link, status: "error", donation: false, error: "연결이 끊겼어요 — 다시 연결해 주세요" }; emitRoom(io, r); } });
        r.st.link = { status: res.ok ? "connected" : "error", platform, nickname: String(res.nickname || p.nickname || "").slice(0, 30) || null, donation: !!res.donationSubscribed, error: res.ok ? (res.donationSubscribed ? null : res.donationError || "후원 구독 실패") : String(res.error || "연결 실패").slice(0, 120) };
      } catch (e) { r.st.link = { status: "error", platform, nickname: null, donation: false, error: String(e.message || e).slice(0, 120) }; }
      emitRoom(io, r); reply({ ok: r.st.link.status === "connected", link: r.st.link });
    });
    on("zero:streamUnlink", (p, reply) => { const r = myRoom(p.code); if (!r || !r.st || r.host !== uid) return reply({ ok: false, err: "host" }); try { HOOKS.unlinkChat?.("dw_zr_" + r.code); } catch {} r.st.link = { status: "off", platform: null, nickname: null, donation: false, error: null }; emitRoom(io, r); reply({ ok: true }); });
    // ── 일일 도전: 기록을 서버가 다시 돌려 점수 확인 후 저장 ──
    on("zero:daily", async (p, reply) => {
      const day = typeof p.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.day) ? p.day : null; if (!day || ![kstDay(0), kstDay(-1)].includes(day)) return reply({ ok: false, err: "day" });
      if (!Array.isArray(p.log) || p.log.length > 6000) return reply({ ok: false, err: "log" });
      const rp = C.replayDaily(day, p.log); if (!rp.ok) return reply({ ok: false, err: "replay_" + rp.err });
      const S = rp.S, rec = { day, owner_key: me.isGuest ? `g:${uid}` : `u:${uid}`, nickname: clean(p.name) || null, score: rp.score, energy: Math.round(S.res.energy), met: S.res.energy >= S.res.quota, summary: { quota: S.res.quota, breaches: S.today.breaches, recons: S.today.recons, lost: S.today.lost, judged: S.anoms.reduce((n, a) => n + Object.keys(a.judged || {}).length, 0), mod: S.dmod }, created_at: new Date().toISOString() };
      if (!supabaseAdmin) return reply({ ok: true, score: rp.score, saved: false });
      { const { count } = await supabaseAdmin.from("zero_daily").select("id", { count: "exact", head: true }).eq("day", day).eq("owner_key", rec.owner_key); if ((count || 0) >= 30) return reply({ ok: true, score: rp.score, saved: false, err: "limit" }); }
      const { error } = await supabaseAdmin.from("zero_daily").insert(rec); if (error) return reply({ ok: true, score: rp.score, saved: false, err: "db" });
      dailyCache.delete(day); reply({ ok: true, score: rp.score, saved: true });
    });
    // ── 이변체 제작소 공유: 서버가 같은 검사(validate)를 다시 함. 신고 5건이면 목록에서 숨김 ──
    on("zero:ugc", async (p, reply) => {
      const owner = me.isGuest ? `g:${uid}` : `u:${uid}`;
      if (!supabaseAdmin) return reply({ ok: false, err: "db" });
      if (p.kind === "publish") {
        const d = UG.validate(p.def); if (!d || !/[1-9a-f]/.test(d.pix)) return reply({ ok: false, err: "invalid" });
        const since = new Date(Date.now() - 86400000).toISOString();
        const { count } = await supabaseAdmin.from("zero_ugc").select("id", { count: "exact", head: true }).eq("owner_key", owner).gte("created_at", since);
        if ((count || 0) >= 10) return reply({ ok: false, err: "limit" });
        const { data, error } = await supabaseAdmin.from("zero_ugc").insert({ owner_key: owner, nickname: clean(p.name) || null, def: d }).select("id").single();
        if (error) return reply({ ok: false, err: "db" }); return reply({ ok: true, id: data.id });
      }
      if (p.kind === "list") {
        const q = supabaseAdmin.from("zero_ugc").select("id, nickname, def, likes, created_at").eq("hidden", false).lt("reports", 5);
        const { data, error } = await (p.sort === "top" ? q.order("likes", { ascending: false }) : q.order("created_at", { ascending: false })).limit(40);
        if (error) return reply({ ok: false, err: "db" });
        return reply({ ok: true, rows: (data || []).map((x) => ({ id: x.id, nick: x.nickname, likes: x.likes, def: UG.validate(x.def) })).filter((x) => x.def) });
      }
      if (p.kind === "like" || p.kind === "report") {
        const id = typeof p.id === "string" && /^[0-9a-f-]{36}$/.test(p.id) ? p.id : null; if (!id) return reply({ ok: false, err: "id" });
        const { data, error } = await supabaseAdmin.rpc("zero_ugc_mark", { p_id: id, p_owner: owner, p_kind: p.kind });
        if (error) return reply({ ok: false, err: "db" }); return reply({ ok: true, likes: data });
      }
      reply({ ok: false, err: "kind" });
    });
    on("zero:dailyTop", async (p, reply) => {
      const day = typeof p.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.day) ? p.day : kstDay(0);
      const c0 = dailyCache.get(day); if (c0 && Date.now() - c0.at < 30000) return reply({ ok: true, rows: c0.rows });
      if (!supabaseAdmin) return reply({ ok: false, err: "db" });
      const { data, error } = await supabaseAdmin.from("zero_daily").select("owner_key, nickname, score, energy, met, summary, created_at").eq("day", day).order("score", { ascending: false }).limit(500);
      if (error) return reply({ ok: false, err: "db" });
      const best = new Map(); for (const x of data || []) { const k = x.owner_key || x.nickname; if (!best.has(k)) best.set(k, x); }
      const mine = me.isGuest ? `g:${uid}` : `u:${uid}`;
      const rows = [...best.values()].slice(0, 50).map((x) => ({ name: x.nickname, score: x.score, energy: x.energy, met: x.met, me: x.owner_key === mine }));
      dailyCache.set(day, { at: Date.now(), rows }); reply({ ok: true, rows });
    });
    socket.on("disconnect", () => {
      for (const r of ROOMS.values()) {
        if (r.viewers.delete(socket.id)) emitRoom(io, r);
        if (!r.socks.has(socket.id)) continue; r.socks.delete(socket.id); leavePlayer(r);
      }
    });
  });
}
export const _test = { ROOMS, allowed, myRoles, autoRoles, needRoles };
