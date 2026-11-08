// =========================
// 플듀 언어 진단소 — 스트리머 방송 모드 (lbc:*)  ※ 상식 진단소 퀴즈쇼(know-broadcast.js) 흐름을 그대로 따름
// 스트리머(방장)가 문제를 열면 시청자 누구나(링크·QR, 게스트 가능) 동시에 답함. 스트리머도 같이 풂
// 방송 언어·난이도는 스트리머가 정하고 끝까지 고정. 공개 권한: 마감 전엔 제출 "인원"만 → 공개 버튼을 눌러야 정답·보기별 비율·TOP10
// 방송에 맞는 방식만: 4지선다·O/X·오류 찾기·문장 배열 (타자는 기기 차이가 커서 뺌)
// 대규모: 답은 메모리에서 바로 세고(문항당 1회), 화면 갱신은 0.5초에 한 번으로 묶어서 보냄
// DB: lingo_broadcasts(방송 제목·최종 요약만) + admin 스트리머 탭(streamer_chat_log platform "lingo", content_mode "bc")
// =========================
import { createFlight } from "./create-flight.js";
import * as C from "./lingo-core.js";
import { STORE, poolOf, serve, revealOf, judgeServed } from "./lingo.js";
import { memberProfile, userKey } from "./iq.js";

const BC = new Map();
const SHOW_KINDS = new Set(["mcq", "ox", "spot", "order"]);
const MAX_VIEWERS = Number(process.env.LINGO_BC_MAX || 5000);
const GUEST_OPEN = 1, MEMBER_OPEN = 3, BC_TTL = 6 * 3600e3;
const ipMakes = new Map();
const now = () => Date.now();
const room = (id) => `lbc:${id}`;
const bcId = () => { const a = "abcdefghjkmnpqrstuvwxyz23456789"; let s = ""; for (let i = 0; i < 8; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);
const sockIp = (s) => String(s.handshake.headers["x-forwarded-for"] || s.handshake.address || "").split(",")[0].trim();

// 방송용 출제: 고른 난이도 대역 안 · 검사 고르게 · 방송 방식만
export function showPlan(seed, n = 10, lang = "ko", diff = "normal") {
  const pool = poolOf(lang).filter((q) => SHOW_KINDS.has(q.kind));
  if (pool.length < n) throw Object.assign(new Error("NOT_ENOUGH_ITEMS"), { detail: { need: n, have: pool.length } });
  const r = C.rng(seed), need = C.diffNeed(diff, n), used = new Set(), out = [], areaN = {}, cap = Math.ceil(n / 6) + 1;
  for (let i = 0; i < n; i++) {
    let best = null, bs = Infinity;
    for (const q of pool) {
      if (used.has(q.id)) continue;
      const s = (C.inBand(diff, q.d) ? (need[q.d] > 0 ? 0 : 3) : 15) + ((areaN[q.area] || 0) >= cap ? 8 : 0) + r() * 3;
      if (s < bs) { bs = s; best = q; }
    }
    used.add(best.id); if (need[best.d] > 0) need[best.d]--; areaN[best.area] = (areaN[best.area] || 0) + 1; out.push(best);
  }
  return C.shuffle(out, r).map((q, i) => ({ id: q.id, seed: C.hashSeed(`${seed}:bc:${i}:${q.id}`) >>> 0 }));
}
function pubState(b) {
  const r = b.cur;
  const base = { id: b.id, title: b.title, nick: b.nick, lang: b.lang, diff: b.diff, phase: b.phase, round: r ? r.i : -1, n: b.plan.length, viewers: b.viewers.size, serverNow: now(), hideNicks: b.hideNicks };
  if (b.phase === "open" || b.phase === "closed") Object.assign(base, { item: r.sv.pub, deadline: r.deadline, submitted: r.count, streamerDone: !!r.ans.get(b.hostKey) });
  if (b.phase === "reveal" || b.phase === "final") Object.assign(base, { last: b.lastPub });
  base.board = b.board;
  if (b.phase === "final") base.final = b.final;
  base.done = !!b.done; return base;
}
function emitState(io, b, force = false) {
  const t = now();
  if (!force && t - b.emitAt < 500) { if (!b.emitT) b.emitT = setTimeout(() => { b.emitT = null; emitState(io, b, true); }, 500 - (t - b.emitAt)); return; }
  b.emitAt = t; io.to(room(b.id)).emit("lbc:state", pubState(b));
}
function boardOf(b) {
  const arr = [...b.viewers.entries()].filter(([k]) => k !== b.hostKey).map(([k, v]) => ({ k, nick: b.hideNicks ? `시청자 ${String(v.no).padStart(3, "0")}` : v.nick, pts: v.pts, ok: v.ok }));
  arr.sort((a, c) => c.pts - a.pts || c.ok - a.ok);
  const host = b.viewers.get(b.hostKey);
  const avg = arr.length ? Math.round(arr.reduce((s, x) => s + x.pts, 0) / arr.length) : 0;
  const hostRank = host ? arr.filter((x) => x.pts > host.pts).length + 1 : null;
  return { top: arr.slice(0, 10).map(({ k, ...x }) => x), players: arr.length, avg, streamer: host ? { pts: host.pts, ok: host.ok, rank: hostRank } : null, rounds: b.rounds };
}
function openRound(io, b, i) {
  const q = STORE.all.get(b.plan[i].id), sv = serve(q, b.plan[i].seed);
  const lim = sv.pub.lim + 3000;   // 방송은 채팅·화면 딜레이를 고려해 조금 길게
  b.cur = { i, sv, q, at: now(), deadline: now() + lim, count: 0, ans: new Map(), dist: {} };
  b.phase = "open";
  clearTimeout(b.timer); b.timer = setTimeout(() => closeRound(io, b), lim + 600);
  emitState(io, b, true);
}
function closeRound(io, b) { if (b.phase !== "open") return; clearTimeout(b.timer); b.phase = "closed"; emitState(io, b, true); }
function revealRound(io, b) {
  if (b.phase === "open") closeRound(io, b);
  if (b.phase !== "closed") return;
  const r = b.cur, q = r.q, rv = revealOf(q, r.sv);
  let ok = 0, n = 0;
  for (const [k, a] of r.ans) { const v = b.viewers.get(k); if (!v) continue; v.pts += a.bp; if (a.part >= 1) v.ok++; v.last = { part: a.part, bp: a.bp }; if (k !== b.hostKey) { n++; if (a.part >= 1) ok++; } }
  for (const [k, v] of b.viewers) if (!r.ans.has(k)) v.last = { part: 0, bp: 0, none: true };
  const host = r.ans.get(b.hostKey);
  b.rounds.push({ i: r.i, acc: n ? Math.round((100 * ok) / n) : null, n, streamer: host ? host.part >= 1 : null });
  b.board = boardOf(b);
  b.lastPub = { round: r.i, item: r.sv.pub, reveal: rv, dist: q.kind === "order" ? null : r.dist, total: n, correct: ok, acc: n ? Math.round((100 * ok) / n) : null, streamer: host ? { part: host.part, bp: host.bp } : { none: true } };
  b.phase = "reveal"; b.done = r.i + 1 >= b.plan.length;
  emitState(io, b, true);
}
export function verdictOf(s, B) {
  if (!s) return null;
  if (!B.players) return "참여한 시청자가 없었어요.";
  const top = B.top[0]?.pts ?? 0;
  if (s.pts > top) return "스트리머가 시청자 전원을 이겼어요!";
  if (s.pts === top && s.pts === B.avg) return "스트리머와 시청자가 막상막하였어요!";
  if (s.pts > B.avg) return `스트리머가 시청자 평균보다 높아요! (시청자 중 ${s.rank}위권)`;
  if (s.pts === B.avg) return "스트리머 점수가 시청자 평균과 같아요!";
  return "시청자 평균이 스트리머보다 높아요! 시청자 승리!";
}
async function finish(io, b, sb) {
  if (b.phase === "open") closeRound(io, b);
  if (b.phase === "closed") revealRound(io, b);
  b.phase = "final"; clearTimeout(b.timer);
  b.board = boardOf(b);
  const king = b.board.top[0] || null, s = b.board.streamer;
  b.final = { king, players: b.board.players, avg: b.board.avg, streamer: s, rounds: b.rounds, verdict: verdictOf(s, b.board), lang: b.lang, diff: b.diff };
  emitState(io, b, true);
  if (sb) { try { await sb.from("lingo_broadcasts").update({ status: "final", summary: { ...b.final, title: b.title }, finished_at: new Date().toISOString() }).eq("id", b.id); } catch (e) { console.error("[lbc] save", e?.message); } }
}
const sanitizeAns = (a) => (typeof a === "number" || typeof a === "boolean" ? a : Array.isArray(a) && a.length <= 8 ? a.map((v) => Number(v) | 0) : null);

export function registerLingoBroadcast(io, supabaseAdmin, app) {
  const sb = supabaseAdmin;
  setInterval(() => { const t = now(); for (const [id, b] of BC) if (t - b.createdAt > BC_TTL) { clearTimeout(b.timer); BC.delete(id); } }, 10 * 60e3).unref?.();
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const key = userKey(me);
    let win = now(), cnt = 0;
    const limited = () => { const n = now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > Number(process.env.LINGO_RL || 60); };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => { const reply = typeof cb === "function" ? cb : () => {}; if (limited()) return reply({ ok: false, error: "RATE_LIMITED" }); try { await fn(p && typeof p === "object" ? p : {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); } });
    const myBc = (id) => { const b = BC.get(String(id || "")); return b && b.hostKey === key ? b : null; };
    const mineOf = () => [...BC.values()].filter((b) => b.hostKey === key && b.phase !== "final").sort((a, c) => c.createdAt - a.createdAt).map((b) => ({ id: b.id, title: b.title, lang: b.lang, diff: b.diff, n: b.plan.length, done: b.rounds.length, phase: b.phase, viewers: Math.max(0, b.viewers.size - 1), createdAt: b.createdAt }));
    on("lbc:mine", (_p, reply) => reply({ ok: true, rows: mineOf() }));

    // 방송 만들기: 게스트도 가능(닉네임 필수, 동시 1개·같은 IP 10분 5개), 회원 동시 3개
    on("lbc:create", async (p, reply) => {
      { const _f = createFlight("lbc", me?.id, reply); if (!_f) return; reply = _f; }
      const mp = !me.isGuest ? await memberProfile(sb, me) : null;
      const nick = clean(p.nick || mp?.nickname, 16);
      if (!nick) return reply({ ok: false, error: "NEED_NICK" });
      if (me.isGuest) { const ip = sockIp(socket), arr = (ipMakes.get(ip) || []).filter((t) => now() - t < 600000); if (arr.length >= 5) return reply({ ok: false, error: "RATE_LIMITED" }); arr.push(now()); ipMakes.set(ip, arr); if (ipMakes.size > 5000) ipMakes.clear(); }
      const open = [...BC.values()].filter((b) => b.hostKey === key && b.phase !== "final").length;
      if (open >= (me.isGuest ? GUEST_OPEN : MEMBER_OPEN)) return reply({ ok: false, error: "TOO_MANY_OPEN", open: mineOf() });
      const n = [5, 10, 15].includes(Number(p.rounds)) ? Number(p.rounds) : 10;
      const lang = C.normQLang(p.lang), diff = C.normDiff(p.diff);
      let plan; try { plan = showPlan((Math.random() * 2 ** 32) >>> 0, n, lang, diff); } catch (e) { return reply({ ok: false, error: e.message, detail: e.detail || null }); }
      const id = bcId(), title = clean(p.title, 40) || `${nick}의 언어 진단 방송`;
      const b = { id, lang, diff, title, nick, hostKey: key, plan, phase: "wait", cur: null, viewers: new Map(), rounds: [], board: null, lastPub: null, final: null, timer: null, emitAt: 0, emitT: null, createdAt: now(), hideNicks: !!p.hideNicks, seq: 0 };
      b.viewers.set(key, { nick: `📺 ${nick}`, pts: 0, ok: 0, no: 0, host: true });
      BC.set(id, b); socket.join(room(id));
      if (sb) {
        sb.from("lingo_broadcasts").insert({ id, owner_key: key, user_id: me.isGuest ? null : me.id, title, streamer_nick: nick, lang, diff, rounds: n }).then(({ error }) => error && console.error("[lbc] create", error.message), () => {});
        // admin 「📺 스트리머」 목록 — "언어" (방송 진단소)
        sb.from("streamer_chat_log").insert({ platform: "lingo", channel_id: id, nickname: nick, content_id: null, content_title: `언어 진단소 방송 · ${C.LANG[lang].lab} · ${C.DIFFS[diff].ko} · ${title}`, content_mode: "bc", room_code: id, host_user_id: me.isGuest ? null : me.id, host_nick: me.isGuest ? null : mp?.nickname || null }).then(({ error }) => error && console.error("[lbc] streamer log", error.message), () => {});
      }
      reply({ ok: true, id, state: pubState(b) });
    });
    on("lbc:watch", (p, reply) => { const b = BC.get(String(p.id || "")); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); socket.join(room(b.id)); const v = b.viewers.get(key); reply({ ok: true, host: b.hostKey === key, state: pubState(b), me: v ? { pts: v.pts } : null }); });
    on("lbc:join", async (p, reply) => {
      const b = BC.get(String(p.id || "")); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" });
      if (b.phase === "final") return reply({ ok: false, error: "BC_CLOSED" });
      let v = b.viewers.get(key);
      if (!v) {
        if (b.viewers.size >= MAX_VIEWERS) return reply({ ok: false, error: "ROOM_FULL" });
        const mp = !me.isGuest ? await memberProfile(sb, me) : null; v = b.viewers.get(key);
        if (!v) { if (b.viewers.size >= MAX_VIEWERS) return reply({ ok: false, error: "ROOM_FULL" }); v = { nick: clean(mp?.nickname || p.nick, 12) || "시청자", pts: 0, ok: 0, no: ++b.seq }; b.viewers.set(key, v); }
        emitState(io, b);
      }
      socket.join(room(b.id)); reply({ ok: true, nick: v.nick, pts: v.pts, state: pubState(b) });
    });
    // 답: 문항당 1회, 마감 후 무효. 보기별 수는 메모리에서 바로 셈(공개는 결과 때)
    on("lbc:answer", (p, reply) => {
      const b = BC.get(String(p.id || "")); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" });
      const r = b.cur; if (b.phase !== "open" || !r || (p.round | 0) !== r.i) return reply({ ok: false, error: "BC_CLOSED" });
      if (!b.viewers.has(key)) return reply({ ok: false, error: "NOT_JOINED" });
      if (r.ans.has(key)) return reply({ ok: true, dup: true });
      if (now() > r.deadline + 800) return reply({ ok: false, error: "TIME_UP" });
      const ans = sanitizeAns(p.answer);
      const res = judgeServed(r.q, r.sv, ans, { at: r.at });
      res.bp = C.battlePoints(res.part, res.d, res.game, res.ms, res.lim);
      r.ans.set(key, res); r.count++;
      if (ans != null && r.q.kind !== "order") { const k = String(ans); r.dist[k] = (r.dist[k] || 0) + 1; }
      reply({ ok: true, submitted: true }); emitState(io, b);
    });
    on("lbc:me", (p, reply) => { const b = BC.get(String(p.id || "")); const v = b && b.viewers.get(key); if (!v) return reply({ ok: false, error: "NOT_JOINED" }); const all = [...b.viewers.entries()].filter(([k]) => k !== b.hostKey).map(([, x]) => x.pts).sort((a, c) => c - a); reply({ ok: true, nick: v.nick, pts: v.pts, correct: v.ok, last: v.last || null, rank: key === b.hostKey ? null : all.indexOf(v.pts) + 1, of: all.length }); });
    on("lbc:next", (p, reply) => { const b = myBc(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); if (b.phase === "open" || b.phase === "closed") return reply({ ok: false, error: "IN_ROUND" }); if (b.done || b.phase === "final") return reply({ ok: false, error: "NO_MORE" }); openRound(io, b, b.cur ? b.cur.i + 1 : 0); reply({ ok: true }); });
    on("lbc:close", (p, reply) => { const b = myBc(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); closeRound(io, b); reply({ ok: true }); });
    on("lbc:reveal", (p, reply) => { const b = myBc(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); if (b.phase === "open") closeRound(io, b); if (b.phase !== "closed") return reply({ ok: false, error: "NOT_CLOSED" }); revealRound(io, b); reply({ ok: true }); });
    on("lbc:finish", async (p, reply) => { const b = myBc(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); await finish(io, b, sb); reply({ ok: true }); });
    on("lbc:hideNicks", (p, reply) => { const b = myBc(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); b.hideNicks = !!p.on; if (b.board) b.board = boardOf(b); emitState(io, b, true); reply({ ok: true }); });
  });
  if (!app) return;
  app.get("/lingo/bc/:id", async (req, res) => {
    const id = String(req.params.id || "").slice(0, 12), b = BC.get(id);
    if (b) return res.json({ ok: true, live: b.phase !== "final", title: b.title, nick: b.nick, lang: b.lang, diff: b.diff, final: b.final, viewers: b.viewers.size });
    if (!sb) return res.status(404).json({ ok: false, error: "BC_NOT_FOUND" });
    const { data } = await sb.from("lingo_broadcasts").select("id, title, streamer_nick, lang, diff, status, summary, created_at").eq("id", id).maybeSingle();
    if (!data) return res.status(404).json({ ok: false, error: "BC_NOT_FOUND" });
    res.json({ ok: true, live: false, title: data.title, nick: data.streamer_nick, lang: data.lang, diff: data.diff, final: data.summary, ended: data.status !== "final" ? "INTERRUPTED" : null });
  });
}
export const _lbcTest = { BC };
// 관리자 화면용: 진행 중인 방송의 참여 시청자 수 (메모리에 없으면 null)
export function lbcLivePlayers(id) { const b = BC.get(String(id || "")); if (!b) return null; return b.final?.players ?? [...b.viewers.keys()].filter((k) => k !== b.hostKey).length; }
