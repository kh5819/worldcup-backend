// =========================
// 플듀 상식 레벨 진단소 — 스트리머 실시간 퀴즈쇼 (kbc:*)  ※ 8인 대결(knm:*)과 완전히 분리
// 스트리머(방장)가 문제를 열면 시청자 누구나(링크·QR, 게스트 가능) 동시에 답함. 스트리머도 같이 풂
// 공개 권한: 마감 전엔 제출 "인원"만 공개 → 마감 후 공개 버튼을 눌러야 정답·보기별 비율·스트리머 정답 여부·TOP10
// 대규모: 답은 메모리에서 바로 세고(문항당 1회), 방 화면 갱신은 0.5초에 한 번으로 묶어서 보냄
// DB: know_broadcasts(방송 제목·최종 요약만). 진행 중 표는 메모리 — 서버 재시작 시 진행 중인 방송은 끝남
// =========================
import { createFlight } from "./create-flight.js";
import * as C from "./know-core.js";
import { STORE } from "./know-store.js";
import { serveAll, revealAll, judgeServed, buildPlan, normLang, poolFor, localize } from "./know.js";
import { memberProfile, userKey } from "./iq.js";

const BC = new Map();
const SHOW_KINDS = new Set(["mcq", "ox", "fake", "num", "map", "case", "where"]);   // 방송에서 한눈에 보이는 방식만 (탐정단·여기는 어디?는 단서 전부 공개 후 투표)
const MAX_VIEWERS = Number(process.env.KNOW_BC_MAX || 5000);
const GUEST_OPEN = 1, MEMBER_OPEN = 3, BC_TTL = 6 * 3600e3;
const ipMakes = new Map();
const now = () => Date.now();
const room = (id) => `kbc:${id}`;
const bcId = () => { const a = "abcdefghjkmnpqrstuvwxyz23456789"; let s = ""; for (let i = 0; i < 8; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);
const sockIp = (s) => String(s.handshake.headers["x-forwarded-for"] || s.handshake.address || "").split(",")[0].trim();

// 방송용 출제: 쉬운 문제 위주 + 마지막 2문제는 최후의 상식왕
export function showPlan(seed, n = 10, lang = "ko") {
  const pool = poolFor(lang).filter((q) => SHOW_KINDS.has(q.kind)); // 스트리머 언어로 낼 수 있는 문항
  // 10문제까지는 하루 세트(10), 15문제는 빠른 세트(15), 그 이상은 정밀 세트(40)에서 앞에서부터 — 하루 세트만 쓰면 15문제를 못 채웠음
  const base = n <= 10 ? "daily" : n <= 15 ? "quick" : "full";
  const plan = buildPlan(base, seed, { pool }).slice(0, n);
  // 6차: 10문제 이상이면 지식 탐정단·여기는 어디? 한 문제씩 섞기 (시청자는 단서 전부 보고 투표)
  if (n >= 10) {
    const r = C.rng((seed ^ 0x5bd1e995) >>> 0), has = new Set(plan.map((x) => x.id));
    for (const kind of ["case", "where"]) {
      if (plan.some((x) => STORE.all.get(x.id)?.kind === kind)) continue;
      const cands = pool.filter((q) => q.kind === kind && !has.has(q.id) && q.d <= 3); if (!cands.length) continue;
      const q = cands[Math.floor(r() * cands.length)];
      const slots = plan.map((_, i) => i).filter((i) => { const g = STORE.all.get(plan[i].id)?.game; return g !== "final" && !["detective", "where"].includes(g); });
      const i = slots[1 + Math.floor(r() * Math.max(1, slots.length - 2))] ?? slots[0]; if (i == null) continue;
      has.delete(plan[i].id); has.add(q.id); plan[i] = { id: q.id, seed: C.hashSeed(`${seed}:bc:${q.id}`) >>> 0 };
    }
  }
  return plan;
}
function pubState(b, { host = false } = {}) {
  const r = b.cur;
  const viewers = b.viewers.size;
  const base = { id: b.id, title: b.title, nick: b.nick, phase: b.phase, round: r ? r.i : -1, n: b.plan.length, viewers, serverNow: now(), hideNicks: b.hideNicks };
  if (b.phase === "open" || b.phase === "closed") Object.assign(base, { item: r.sv.pub, deadline: r.deadline, submitted: r.count, streamerDone: !!r.ans.get(b.hostKey) });
  if (b.phase === "reveal" || b.phase === "final") Object.assign(base, { last: b.lastPub });
  base.board = b.board;   // TOP10·평균 (공개 단계에서만 갱신)
  if (b.phase === "final") base.final = b.final;
  base.done = !!b.done; void host; return base;
}
function emitState(io, b, force = false) {
  const t = now();
  if (!force && t - b.emitAt < 500) { if (!b.emitT) b.emitT = setTimeout(() => { b.emitT = null; emitState(io, b, true); }, 500 - (t - b.emitAt)); return; }
  b.emitAt = t; io.to(room(b.id)).emit("kbc:state", pubState(b));
}
function viewerOf(b, key) { return b.viewers.get(key) || null; }
function boardOf(b) {
  const arr = [...b.viewers.entries()].filter(([k]) => k !== b.hostKey).map(([k, v]) => ({ k, nick: b.hideNicks ? `시청자 ${String(v.no).padStart(3, "0")}` : v.nick, pts: v.pts, ok: v.ok }));
  arr.sort((a, b2) => b2.pts - a.pts || b2.ok - a.ok);
  const host = b.viewers.get(b.hostKey);
  const avg = arr.length ? Math.round(arr.reduce((s, x) => s + x.pts, 0) / arr.length) : 0;
  const hostRank = host ? arr.filter((x) => x.pts > host.pts).length + 1 : null;
  return { top: arr.slice(0, 10).map(({ k, ...x }) => x), players: arr.length, avg, streamer: host ? { pts: host.pts, ok: host.ok, rank: hostRank } : null, rounds: b.rounds };
}
function openRound(io, b, i) {
  const q = STORE.all.get(b.plan[i].id), sv = serveAll(q, b.plan[i].seed);
  // 탐정단·여기는 어디?: 방송은 단서를 한꺼번에 보여 주고 투표 (단서 단계 점수 없음 = 1단계 만점)
  if (C.CLUE_KINDS.has(q.kind)) { sv.pub.clues = q.clues; for (const L of Object.keys(sv.pub.tr || {})) { const lq = localize(q, L); if (lq) sv.pub.tr[L].clues = lq.clues; } }
  const lim = sv.pub.lim + (sv.pub.kind === "num" ? 5000 : 3000);   // 방송은 채팅 딜레이 고려해 조금 길게
  b.cur = { i, sv, q, at: now(), deadline: now() + lim, count: 0, ans: new Map(), dist: {} };
  b.phase = "open";
  clearTimeout(b.timer); b.timer = setTimeout(() => closeRound(io, b), lim + 600);
  emitState(io, b, true);
}
function closeRound(io, b) {
  if (b.phase !== "open") return; clearTimeout(b.timer); b.phase = "closed"; emitState(io, b, true);
}
function revealRound(io, b) {
  if (b.phase === "open") closeRound(io, b);
  if (b.phase !== "closed") return;
  const r = b.cur, q = r.q, rv = revealAll(q, r.sv);
  let ok = 0, n = 0;
  for (const [k, a] of r.ans) { const v = b.viewers.get(k); if (!v) continue; v.pts += a.bp; if (a.part >= 1) v.ok++; v.last = { part: a.part, bp: a.bp }; if (k !== b.hostKey) { n++; if (a.part >= 1) ok++; } }
  for (const [k, v] of b.viewers) if (!r.ans.has(k)) v.last = { part: 0, bp: 0, none: true };
  const host = r.ans.get(b.hostKey);
  b.rounds.push({ i: r.i, acc: n ? Math.round((100 * ok) / n) : null, n, streamer: host ? host.part >= 1 : null });
  b.board = boardOf(b);
  b.lastPub = { round: r.i, item: r.sv.pub, reveal: rv, dist: q.kind === "num" ? null : r.dist, numAvg: q.kind === "num" && r.numN ? r.numSum / r.numN : null, total: n, correct: ok, acc: n ? Math.round((100 * ok) / n) : null, streamer: host ? { part: host.part, bp: host.bp } : { none: true } };
  b.phase = "reveal"; b.done = r.i + 1 >= b.plan.length;
  emitState(io, b, true);
}
// 스트리머 vs 시청자 한 줄 평 (동점·참여 0명도 정확하게)
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
  b.final = { king, players: b.board.players, avg: b.board.avg, streamer: s, rounds: b.rounds, verdict: verdictOf(s, b.board) };
  emitState(io, b, true);
  if (sb) { try { await sb.from("know_broadcasts").update({ status: "final", summary: { ...b.final, title: b.title }, finished_at: new Date().toISOString() }).eq("id", b.id); } catch (e) { console.error("[kbc] save", e?.message); } }
}

export function registerKnowBroadcast(io, supabaseAdmin, app) {
  const sb = supabaseAdmin;
  setInterval(() => { const t = now(); for (const [id, b] of BC) if (t - b.createdAt > BC_TTL) { clearTimeout(b.timer); BC.delete(id); } }, 10 * 60e3).unref?.();
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const key = userKey(me);
    let win = now(), cnt = 0;
    const limited = () => { const n = now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > Number(process.env.KNOW_RL || 60); };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => { const reply = typeof cb === "function" ? cb : () => {}; if (limited()) return reply({ ok: false, error: "RATE_LIMITED" }); try { await fn(p && typeof p === "object" ? p : {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); } });
    const myBc = (id) => { const b = BC.get(String(id || "")); return b && b.hostKey === key ? b : null; };
    // 내가 연(아직 안 끝난) 퀴즈쇼 — 창을 닫았다 다시 와도 이어서 진행하거나 끝낼 수 있게
    const mineOf = () => [...BC.values()].filter((b) => b.hostKey === key && b.phase !== "final").sort((a, b) => b.createdAt - a.createdAt).map((b) => ({ id: b.id, title: b.title, n: b.plan.length, done: b.rounds.length, phase: b.phase, viewers: Math.max(0, b.viewers.size - 1), createdAt: b.createdAt }));
    on("kbc:mine", (_p, reply) => reply({ ok: true, rows: mineOf() }));

    // 방송 만들기: 게스트도 가능(닉네임 필수, 동시 1개·같은 IP 10분 5개), 회원 동시 3개
    on("kbc:create", async (p, reply) => {
      { const _f = createFlight("kbc", me?.id, reply); if (!_f) return; reply = _f; } // 방 중복 생성 막기
      const mp = !me.isGuest ? await memberProfile(sb, me) : null;
      const nick = clean(p.nick || mp?.nickname, 16);
      if (!nick) return reply({ ok: false, error: "NEED_NICK" });
      if (me.isGuest) { const ip = sockIp(socket), arr = (ipMakes.get(ip) || []).filter((t) => now() - t < 600000); if (arr.length >= 5) return reply({ ok: false, error: "RATE_LIMITED" }); arr.push(now()); ipMakes.set(ip, arr); if (ipMakes.size > 5000) ipMakes.clear(); }
      const open = [...BC.values()].filter((b) => b.hostKey === key && b.phase !== "final").length;
      if (open >= (me.isGuest ? GUEST_OPEN : MEMBER_OPEN)) return reply({ ok: false, error: "TOO_MANY_OPEN", open: mineOf() });
      const n = [5, 10, 15].includes(Number(p.rounds)) ? Number(p.rounds) : 10;
      let plan; try { plan = showPlan((Math.random() * 2 ** 32) >>> 0, n, normLang(p.lang)); } catch (e) { return reply({ ok: false, error: e.message }); }
      if (plan.length < n) return reply({ ok: false, error: "NOT_ENOUGH_ITEMS", detail: { need: n, have: plan.length } });
      const id = bcId(), title = clean(p.title, 40) || `${nick}의 상식 퀴즈쇼`;
      const b = { id, lang: normLang(p.lang), title, nick, hostKey: key, plan, phase: "wait", cur: null, viewers: new Map(), rounds: [], board: null, lastPub: null, final: null, timer: null, emitAt: 0, emitT: null, createdAt: now(), hideNicks: !!p.hideNicks, seq: 0 };
      b.viewers.set(key, { nick: `📺 ${nick}`, pts: 0, ok: 0, no: 0, host: true });
      BC.set(id, b); socket.join(room(id));
      if (sb) {
        sb.from("know_broadcasts").insert({ id, owner_key: key, user_id: me.isGuest ? null : me.id, title, streamer_nick: nick, rounds: n }).then(({ error }) => error && console.error("[kbc] create", error.message), () => {});
        // admin 「📺 스트리머」 목록 — 상식퀴즈
        sb.from("streamer_chat_log").insert({ platform: "know", channel_id: id, nickname: nick, content_id: null, content_title: title, content_mode: null, room_code: id, host_user_id: me.isGuest ? null : me.id, host_nick: me.isGuest ? null : mp?.nickname || null }).then(({ error }) => error && console.error("[kbc] streamer log", error.message), () => {});
      }
      reply({ ok: true, id, state: pubState(b, { host: true }) });
    });
    // 시청자·스트리머 화면 연결 (보기만)
    on("kbc:watch", (p, reply) => { const b = BC.get(String(p.id || "")); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); socket.join(room(b.id)); reply({ ok: true, host: b.hostKey === key, state: pubState(b), me: viewerOf(b, key) ? { pts: viewerOf(b, key).pts } : null }); });
    // 시청자 참여 (닉네임). 게스트 가능
    on("kbc:join", async (p, reply) => {
      const b = BC.get(String(p.id || "")); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" });
      if (b.phase === "final") return reply({ ok: false, error: "BC_CLOSED" });
      let v = b.viewers.get(key);
      if (!v) { if (b.viewers.size >= MAX_VIEWERS) return reply({ ok: false, error: "ROOM_FULL" }); const mp = !me.isGuest ? await memberProfile(sb, me) : null; const nick = clean(mp?.nickname || p.nick, 12) || "시청자"; v = { nick, pts: 0, ok: 0, no: ++b.seq }; b.viewers.set(key, v); emitState(io, b); }
      socket.join(room(b.id)); reply({ ok: true, nick: v.nick, pts: v.pts, state: pubState(b) });
    });
    // 답: 문항당 1회, 마감 후 무효. 보기별 수는 메모리에서 바로 셈(공개는 결과 때)
    on("kbc:answer", (p, reply) => {
      const b = BC.get(String(p.id || "")); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" });
      const r = b.cur; if (b.phase !== "open" || !r || (p.round | 0) !== r.i) return reply({ ok: false, error: "BC_CLOSED" });
      if (!b.viewers.has(key)) return reply({ ok: false, error: "NOT_JOINED" });
      if (r.ans.has(key)) return reply({ ok: true, dup: true });
      if (now() > r.deadline + 800) return reply({ ok: false, error: "TIME_UP" });
      let ans = p.answer; if (!(typeof ans === "number" || typeof ans === "boolean")) ans = null;
      const res = judgeServed(r.q, r.sv, ans, { at: r.at });
      res.bp = C.battlePoints(res.part, res.d, res.game, res.ms, res.lim);
      r.ans.set(key, res); r.count++;
      if (ans != null) { if (r.q.kind === "num") { r.numSum = (r.numSum || 0) + Number(ans); r.numN = (r.numN || 0) + 1; } else { const k = String(ans); r.dist[k] = (r.dist[k] || 0) + 1; } }
      reply({ ok: true, submitted: true }); emitState(io, b);
    });
    // 내 점수 (시청자 본인만)
    on("kbc:me", (p, reply) => { const b = BC.get(String(p.id || "")); const v = b && b.viewers.get(key); if (!v) return reply({ ok: false, error: "NOT_JOINED" }); const all = [...b.viewers.entries()].filter(([k]) => k !== b.hostKey).map(([, x]) => x.pts).sort((a, c) => c - a); reply({ ok: true, nick: v.nick, pts: v.pts, correct: v.ok, last: v.last || null, rank: key === b.hostKey ? null : all.indexOf(v.pts) + 1, of: all.length }); });
    // 스트리머 진행 버튼
    on("kbc:next", (p, reply) => { const b = myBc(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); if (b.phase === "open" || b.phase === "closed") return reply({ ok: false, error: "IN_ROUND" }); if (b.done || b.phase === "final") return reply({ ok: false, error: "NO_MORE" }); openRound(io, b, b.cur ? b.cur.i + 1 : 0); reply({ ok: true }); });
    on("kbc:close", (p, reply) => { const b = myBc(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); closeRound(io, b); reply({ ok: true }); });
    on("kbc:reveal", (p, reply) => { const b = myBc(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); if (b.phase === "open") closeRound(io, b); if (b.phase !== "closed") return reply({ ok: false, error: "NOT_CLOSED" }); revealRound(io, b); reply({ ok: true }); });
    on("kbc:finish", async (p, reply) => { const b = myBc(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); await finish(io, b, sb); reply({ ok: true }); });
    on("kbc:hideNicks", (p, reply) => { const b = myBc(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); b.hideNicks = !!p.on; if (b.board) b.board = boardOf(b); emitState(io, b, true); reply({ ok: true }); });
  });
  if (!app) return;
  // 끝난 방송 요약 (공유 링크)
  app.get("/know/bc/:id", async (req, res) => {
    const id = String(req.params.id || "").slice(0, 12), b = BC.get(id);
    if (b) return res.json({ ok: true, live: b.phase !== "final", title: b.title, nick: b.nick, final: b.final, viewers: b.viewers.size });
    if (!sb) return res.status(404).json({ ok: false, error: "BC_NOT_FOUND" });
    const { data } = await sb.from("know_broadcasts").select("id, title, streamer_nick, status, summary, created_at").eq("id", id).maybeSingle();
    if (!data) return res.status(404).json({ ok: false, error: "BC_NOT_FOUND" });
    res.json({ ok: true, live: false, title: data.title, nick: data.streamer_nick, final: data.summary, ended: data.status !== "final" ? "INTERRUPTED" : null });
  });
}
export const _kbcTest = { BC };
// 관리자 화면용: 진행 중인 방송의 참여 시청자 수 (메모리에 없으면 null)
export function kbcLivePlayers(id) { const b = BC.get(String(id || "")); if (!b) return null; return b.final?.players ?? [...b.viewers.keys()].filter((k) => k !== b.hostKey).length; }
