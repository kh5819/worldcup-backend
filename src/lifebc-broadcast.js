// =========================
// 인생 방송국 — 스트리머 모드 (lbc:*)
// 시뮬레이션은 스트리머 브라우저에서 돈다. 서버는 시청자 참여만 책임진다:
//   · 투표(사건 결정·편성·MVP): 1인 1표, 마감 후 무효, 결과는 서버가 셈
//   · 예측(우승자·커플 성사 등): 게임 포인트만(현금성 없음), 맞히면 점수, 시청자 순위
//   · 출연 신청: 닉네임·외형·성격·목표 → 스트리머가 승인/추첨 → 게임에 출연자로 들어감
// 진행 중 상태는 메모리 (서버 재시작 시 방송 끝남). DB 안 씀.
// =========================
const BC = new Map();
let IO = null;
const MAX_VIEWERS = Number(process.env.LBC_MAX || 5000), MAX_APPS = 300, TTL = 8 * 3600e3;
const now = () => Date.now();
const room = (id) => `lbc:${id}`;
const bcId = () => { const a = "abcdefghjkmnpqrstuvwxyz23456789"; let s = ""; for (let i = 0; i < 8; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f<>`]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const sockIp = (s) => String(s.handshake.headers["x-forwarded-for"] || s.handshake.address || "").split(",")[0].trim();
const ipMakes = new Map();

// 닉네임 거르기 (욕설·운영자 사칭·링크)
const BAD = ["시발", "씨발", "ㅅㅂ", "병신", "ㅂㅅ", "좆", "존나", "개새", "느금", "니애미", "애미", "섹스", "fuck", "shit", "bitch", "nigger", "운영자", "관리자", "admin", "playduo", "플레이듀오", "http", "www.", ".com", ".kr"];
// 치지직·SOOP·씨미 채팅 표 (!1 ~ !6) — index.js의 채팅 다리가 부름. 한 채팅 계정당 한 표, 바꾸면 옮김
export function lbcChatVote(bcId, voterKey, n) {
  const b = BC.get(String(bcId || "")); if (!b || b.ended) return null; const t = now();
  const P = b.poll && !b.poll.closed && t <= b.poll.deadline + 500 ? b.poll : null;
  const R = !P && b.pred && !b.pred.locked && !b.pred.settled && t <= b.pred.deadline + 500 ? b.pred : null;
  const box = P || R; if (!box) return null;
  const opt = box.opts[(n | 0) - 1]; if (!opt) return null;
  const map = P ? P.votes : R.picks, prev = map.get(voterKey);
  if (prev === opt.id) return { kind: P ? "poll" : "pred", opt: opt.id, dup: true };
  if (prev != null) box.counts[prev] = Math.max(0, (box.counts[prev] || 1) - 1);
  map.set(voterKey, opt.id); box.counts[opt.id] = (box.counts[opt.id] || 0) + 1; b.chatVotes = (b.chatVotes || 0) + 1;
  if (IO) emitState(IO, b);
  return { kind: P ? "poll" : "pred", opt: opt.id };
}
export const lbcExists = (bcId) => { const b = BC.get(String(bcId || "")); return !!b && !b.ended; };
export function nickOk(n) { const s = String(n || "").toLowerCase().replace(/\s/g, ""); if (!s) return false; return !BAD.some((w) => s.includes(w)); }
// 글자 묶음({ko,ja,en} 또는 문자열) 안전하게
function txt(v, n = 80) { if (typeof v === "string") return clean(v, n); if (v && typeof v === "object") { const o = {}; for (const k of ["ko", "ja", "en"]) if (v[k] != null) o[k] = clean(v[k], n); return o.ko || o.ja || o.en ? o : ""; } return ""; }
const INTENSITY = ["off", "low", "normal", "high"];
const LOOK_MAX = { base: 5, hair: 9, shirt: 9, pants: 5, skin: 3 };
const PRESETS = ["leader", "joker", "romantic", "schemer", "worker", "free"];
const GOALS = ["star", "love", "win", "friends", "chaos"];

function pubPoll(p) { if (!p) return null; return { id: p.id, kind: p.kind, q: p.q, opts: p.opts, deadline: p.deadline, closed: p.closed, counts: p.counts, total: p.votes.size, result: p.result ?? null }; }
function pubPred(p) { if (!p) return null; return { id: p.id, q: p.q, opts: p.opts, deadline: p.deadline, locked: p.locked, settled: p.settled, answer: p.answer ?? null, counts: p.counts, total: p.picks.size, winners: p.winners ?? null }; }
function board(b) { const arr = [...b.viewers.values()].filter((v) => !v.host).sort((x, y) => y.pts - x.pts || x.no - y.no); return { top: arr.slice(0, 10).map((v) => ({ nick: v.nick, pts: v.pts })), players: arr.length }; }
function pubState(b) {
  return { id: b.id, title: b.title, nick: b.nick, lang: b.lang, intensity: b.intensity, viewers: Math.max(0, b.viewers.size - 1), status: b.status, poll: pubPoll(b.poll), pred: pubPred(b.pred), board: board(b), apps: b.apps.length, cast: b.castNicks, notice: b.notice, ended: !!b.ended, serverNow: now() };
}
function emitState(io, b, force = false) {
  const t = now();
  if (!force && t - b.emitAt < 500) { if (!b.emitT) b.emitT = setTimeout(() => { b.emitT = null; emitState(io, b, true); }, 500 - (t - b.emitAt)); return; }
  b.emitAt = t; io.to(room(b.id)).emit("lbc:state", pubState(b));
}
function opts(list) { if (!Array.isArray(list)) return null; const out = list.slice(0, 6).map((o, i) => ({ id: clean(o?.id ?? i, 24) || String(i), label: txt(o?.label, 60) })).filter((o) => o.label); return out.length >= 2 ? out : null; }
function closePoll(io, b) {
  const p = b.poll; if (!p || p.closed) return null; clearTimeout(p.timer); p.closed = true;
  let best = null; for (const o of p.opts) if (!best || (p.counts[o.id] || 0) > (p.counts[best.id] || 0)) best = o;
  const tie = p.opts.filter((o) => (p.counts[o.id] || 0) === (p.counts[best.id] || 0));
  p.result = p.votes.size ? (tie.length > 1 ? tie[Math.floor(Math.random() * tie.length)].id : best.id) : null; // 동점은 추첨, 0표면 null(스트리머가 결정)
  emitState(io, b, true); return p.result;
}

export function registerLifeBroadcast(io, sb, app) {
  IO = io;
  setInterval(() => { const t = now(); for (const [id, b] of BC) if (t - b.createdAt > TTL || (b.ended && t - b.endedAt > 600e3)) { clearTimeout(b.poll?.timer); clearTimeout(b.pred?.timer); BC.delete(id); } }, 10 * 60e3).unref?.();
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const key = (me.isGuest ? "g:" : "u:") + me.id;
    let win = now(), cnt = 0;
    const limited = () => { const n = now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > Number(process.env.LBC_RL || 80); };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => { const reply = typeof cb === "function" ? cb : () => {}; if (limited()) return reply({ ok: false, error: "RATE_LIMITED" }); try { await fn(p && typeof p === "object" ? p : {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); } });
    const mine = (id) => { const b = BC.get(String(id || "")); return b && b.hostKey === key && !b.ended ? b : null; };
    const get = (id) => BC.get(String(id || "")) || null;

    on("lbc:create", (p, reply) => {
      const nick = clean(p.nick, 16); if (!nick) return reply({ ok: false, error: "NEED_NICK" }); if (!nickOk(nick)) return reply({ ok: false, error: "BAD_NICK" });
      if (me.isGuest) { const ip = sockIp(socket), arr = (ipMakes.get(ip) || []).filter((t) => now() - t < 600000); if (arr.length >= 5) return reply({ ok: false, error: "RATE_LIMITED" }); arr.push(now()); ipMakes.set(ip, arr); if (ipMakes.size > 5000) ipMakes.clear(); }
      for (const b of BC.values()) if (b.hostKey === key && !b.ended) { b.ended = true; b.endedAt = now(); emitState(io, b, true); } // 한 사람당 방송 1개
      const id = bcId();
      const b = { id, hostKey: key, nick, title: clean(p.title, 40) || nick, lang: ["ko", "ja", "en"].includes(p.lang) ? p.lang : "ko", intensity: INTENSITY.includes(p.intensity) ? p.intensity : "normal",
        viewers: new Map([[key, { nick: `📺 ${nick}`, pts: 0, no: 0, host: true }]]), seq: 0, poll: null, pred: null, apps: [], accepted: new Set(), castNicks: [], status: null, notice: null, createdAt: now(), emitAt: 0, emitT: null, pseq: 0 };
      BC.set(id, b); socket.join(room(id)); reply({ ok: true, id, state: pubState(b) });
      // admin 「📺 스트리머」 목록 — 인생 방송국 (게스트도 기록, 회원이면 host_user_id 남김)
      if (sb) Promise.resolve(sb.from("streamer_chat_log").insert({ platform: "lifebc", channel_id: id, nickname: nick, content_id: null, content_title: b.title, content_mode: b.intensity, room_code: id, host_user_id: me.isGuest ? null : me.id, host_nick: me.isGuest ? `게스트 ${nick}` : nick })).then((r) => r?.error && console.error("[lbc] streamer log", r.error.message), () => {});
    });
    on("lbc:watch", (p, reply) => { const b = get(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); socket.join(room(b.id)); reply({ ok: true, host: b.hostKey === key, state: pubState(b) }); });
    on("lbc:join", (p, reply) => {
      const b = get(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); if (b.ended) return reply({ ok: false, error: "BC_CLOSED" });
      let v = b.viewers.get(key);
      if (!v) { if (b.viewers.size >= MAX_VIEWERS) return reply({ ok: false, error: "ROOM_FULL" }); const nick = clean(p.nick, 12); if (!nick) return reply({ ok: false, error: "NEED_NICK" }); if (!nickOk(nick)) return reply({ ok: false, error: "BAD_NICK" }); v = { nick, pts: 0, no: ++b.seq }; b.viewers.set(key, v); emitState(io, b); }
      socket.join(room(b.id)); reply({ ok: true, nick: v.nick, pts: v.pts, state: pubState(b) });
    });
    on("lbc:me", (p, reply) => { const b = get(p.id); const v = b?.viewers.get(key); if (!v) return reply({ ok: false, error: "NOT_JOINED" }); const all = [...b.viewers.values()].filter((x) => !x.host).sort((x, y) => y.pts - x.pts); const app_ = b.apps.find((a) => a.key === key); reply({ ok: true, nick: v.nick, pts: v.pts, rank: v.host ? null : all.filter((x) => x.pts > v.pts).length + 1, of: all.length, vote: b.poll ? b.poll.votes.get(key) ?? null : null, pick: b.pred ? b.pred.picks.get(key) ?? null : null, applied: !!app_, accepted: b.accepted.has(key) }); });

    // 스트리머 화면이 보내는 게임 상황 (시청자 폰 화면에 표시) — 크기 제한
    on("lbc:status", (p, reply) => { const b = mine(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); const s = p.status || {};
      b.status = { day: s.day | 0, time: clean(s.time, 5), money: Math.round(Number(s.money) || 0), rating: Math.round((Number(s.rating) || 0) * 10) / 10, show: txt(s.show, 40), ticker: Array.isArray(s.ticker) ? s.ticker.slice(0, 4).map((x) => txt(x, 120)).filter(Boolean) : [], cast: Array.isArray(s.cast) ? s.cast.slice(0, 16).map((c) => ({ name: txt(c?.name, 20), mood: clean(c?.mood, 4), doing: txt(c?.doing, 30) })) : [] };
      emitState(io, b); reply({ ok: true }); });
    on("lbc:intensity", (p, reply) => { const b = mine(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); if (INTENSITY.includes(p.level)) b.intensity = p.level; emitState(io, b, true); reply({ ok: true }); });

    // ----- 투표 -----
    on("lbc:poll", (p, reply) => {
      const b = mine(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); if (b.poll && !b.poll.closed) closePoll(io, b);
      const o = opts(p.opts), q = txt(p.q, 120); if (!o || !q) return reply({ ok: false, error: "BAD_POLL" });
      const sec = Math.max(8, Math.min(90, Number(p.sec) || 20));
      b.poll = { id: "p" + ++b.pseq, kind: clean(p.kind, 16) || "event", q, opts: o, deadline: now() + sec * 1000, closed: false, votes: new Map(), counts: {}, result: undefined };
      b.poll.timer = setTimeout(() => closePoll(io, b), sec * 1000 + 300);
      emitState(io, b, true); reply({ ok: true, pollId: b.poll.id });
    });
    on("lbc:vote", (p, reply) => {
      const b = get(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); const P = b.poll;
      if (!P || P.closed || P.id !== p.pollId) return reply({ ok: false, error: "POLL_CLOSED" }); if (now() > P.deadline + 500) return reply({ ok: false, error: "TIME_UP" });
      if (!b.viewers.has(key)) return reply({ ok: false, error: "NOT_JOINED" }); if (b.viewers.get(key).host) return reply({ ok: false, error: "HOST_NO_VOTE" });
      const opt = String(p.opt); if (!P.opts.some((o) => o.id === opt)) return reply({ ok: false, error: "BAD_OPT" });
      if (P.votes.has(key)) return reply({ ok: true, dup: true, opt: P.votes.get(key) });
      P.votes.set(key, opt); P.counts[opt] = (P.counts[opt] || 0) + 1; emitState(io, b); reply({ ok: true });
    });
    on("lbc:pollClose", (p, reply) => { const b = mine(p.id); if (!b || !b.poll) return reply({ ok: false, error: "NOT_HOST" }); const r = b.poll.closed ? b.poll.result : closePoll(io, b); reply({ ok: true, result: r, counts: b.poll.counts, total: b.poll.votes.size }); });

    // ----- 예측 (게임 포인트) -----
    on("lbc:pred", (p, reply) => {
      const b = mine(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" });
      const o = opts(p.opts), q = txt(p.q, 120); if (!o || !q) return reply({ ok: false, error: "BAD_PRED" });
      const sec = Math.max(8, Math.min(120, Number(p.sec) || 30));
      clearTimeout(b.pred?.timer);
      b.pred = { id: "r" + ++b.pseq, q, opts: o, deadline: now() + sec * 1000, locked: false, settled: false, picks: new Map(), counts: {}, pts: Math.max(5, Math.min(50, Number(p.pts) || 10)) };
      b.pred.timer = setTimeout(() => { if (b.pred && !b.pred.locked) { b.pred.locked = true; emitState(io, b, true); } }, sec * 1000 + 300);
      emitState(io, b, true); reply({ ok: true, predId: b.pred.id });
    });
    on("lbc:predict", (p, reply) => {
      const b = get(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); const P = b.pred;
      if (!P || P.locked || P.id !== p.predId || now() > P.deadline + 500) return reply({ ok: false, error: "PRED_LOCKED" });
      const v = b.viewers.get(key); if (!v) return reply({ ok: false, error: "NOT_JOINED" }); if (v.host) return reply({ ok: false, error: "HOST_NO_VOTE" });
      const opt = String(p.opt); if (!P.opts.some((o) => o.id === opt)) return reply({ ok: false, error: "BAD_OPT" });
      if (P.picks.has(key)) return reply({ ok: true, dup: true, opt: P.picks.get(key) });
      P.picks.set(key, opt); P.counts[opt] = (P.counts[opt] || 0) + 1; emitState(io, b); reply({ ok: true });
    });
    on("lbc:predLock", (p, reply) => { const b = mine(p.id); if (!b?.pred) return reply({ ok: false, error: "NOT_HOST" }); clearTimeout(b.pred.timer); b.pred.locked = true; emitState(io, b, true); reply({ ok: true }); });
    on("lbc:predSettle", (p, reply) => {
      const b = mine(p.id); const P = b?.pred; if (!P || P.id !== p.predId) return reply({ ok: false, error: "NOT_HOST" }); if (P.settled) return reply({ ok: true, dup: true, winners: P.winners });
      clearTimeout(P.timer); P.locked = true; P.settled = true; P.answer = p.answer == null ? null : String(p.answer);
      let n = 0; const hit = P.answer == null ? [] : [...P.picks.entries()].filter(([, o]) => o === P.answer).map(([k]) => k);
      const bonus = hit.length && P.picks.size ? Math.round(P.pts * Math.min(3, P.picks.size / hit.length) * 0.5) : 0; // 적게 맞힐수록 보너스
      for (const k of hit) { const v = b.viewers.get(k); if (v) { v.pts += P.pts + bonus; n++; } }
      P.winners = { n, total: P.picks.size, pts: P.pts + bonus };
      emitState(io, b, true); reply({ ok: true, winners: P.winners });
    });

    // ----- 출연 신청 -----
    on("lbc:apply", (p, reply) => {
      const b = get(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); if (b.ended) return reply({ ok: false, error: "BC_CLOSED" });
      if (b.intensity === "off") return reply({ ok: false, error: "APPLY_OFF" });
      const v = b.viewers.get(key); if (!v) return reply({ ok: false, error: "NOT_JOINED" }); if (v.host) return reply({ ok: false, error: "HOST_NO_VOTE" });
      if (b.accepted.has(key)) return reply({ ok: false, error: "ALREADY_CAST" });
      if (b.apps.some((a) => a.key === key)) return reply({ ok: true, dup: true });
      if (b.apps.length >= MAX_APPS) return reply({ ok: false, error: "APPS_FULL" });
      const nick = clean(p.nick || v.nick, 10); if (!nick || !nickOk(nick)) return reply({ ok: false, error: "BAD_NICK" });
      const look = {}; for (const k in LOOK_MAX) look[k] = Math.max(0, Math.min(LOOK_MAX[k], Number(p.look?.[k]) | 0));
      const app = { id: "a" + ++b.pseq, key, nick, look, preset: PRESETS.includes(p.preset) ? p.preset : "free", goal: GOALS.includes(p.goal) ? p.goal : "star", at: now() };
      b.apps.push(app); emitState(io, b); reply({ ok: true, appId: app.id });
    });
    on("lbc:apps", (p, reply) => { const b = mine(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); reply({ ok: true, rows: b.apps.slice(-100).map(({ key: _k, ...a }) => a) }); });
    const take = (b, app) => { b.apps = b.apps.filter((a) => a !== app); b.accepted.add(app.key); b.castNicks.push(app.nick); b.notice = { kind: "cast", nick: app.nick, at: now() }; emitState(io, b, true); const { key: _k, ...pub } = app; return pub; };
    on("lbc:accept", (p, reply) => { const b = mine(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); const app = b.apps.find((a) => a.id === p.appId); if (!app) return reply({ ok: false, error: "APP_NOT_FOUND" }); reply({ ok: true, app: take(b, app) }); });
    on("lbc:draw", (p, reply) => { const b = mine(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); if (!b.apps.length) return reply({ ok: false, error: "NO_APPS" }); reply({ ok: true, app: take(b, b.apps[Math.floor(Math.random() * b.apps.length)]) }); });
    on("lbc:reject", (p, reply) => { const b = mine(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); b.apps = b.apps.filter((a) => a.id !== p.appId); emitState(io, b); reply({ ok: true }); });
    on("lbc:end", (p, reply) => { const b = mine(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); if (b.poll && !b.poll.closed) closePoll(io, b); b.ended = true; b.endedAt = now(); emitState(io, b, true); reply({ ok: true, board: board(b) }); });
  });
  if (!app) return;
  app.get("/lifebc/bc/:id", (req, res) => { const b = BC.get(String(req.params.id || "").slice(0, 12)); if (!b) return res.status(404).json({ ok: false, error: "BC_NOT_FOUND" }); res.json({ ok: true, title: b.title, nick: b.nick, ended: !!b.ended, viewers: b.viewers.size - 1 }); });
}
export const _lbcTest = { BC };
