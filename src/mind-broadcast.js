// =========================
// 플듀 심리전 스트리머 모드 (mbc:* 소켓 + /mind/bc/* REST) — 8인 대결과 완전히 분리된 대규모 구조
// A 실시간 투표 · B 스트리머 행동 예측 · C 다수 선택 맞히기 · D 개별 심리전 검사 · E 방송 대항전 · 특별 「서로 얼마나 알까?」
// 봉인: 투표 중에는 표 분포를 방장 포함 아무에게도 안 보냄(수만 공개). 공개 버튼을 눌러야 집계가 나감
// 집계: 투표는 메모리 카운터(O(1)), 통계 전송은 묶음(투표 수 1초 · 통계 2초), DB는 공개·완료 때만 기록
// 진행 중 라운드의 표는 서버 메모리에만 있음 → 서버 재시작 시 그 라운드 표는 사라짐(이미 공개된 라운드는 DB에 남음)
// DB: mind_broadcasts / mind_bc_entries / mind_bc_voters / mind_bc_predictions
// =========================
import { createFlight } from "./create-flight.js";
import * as C from "./mind-core.js";

const BC = new Map(), REST_CACHE = new Map();
const STATS_MS = 2000, COUNT_MS = 1000;
const GRACE_MS = 40 * 60 * 1000, MIN_BATTLE = 10, MAX_DEADLINE_MIN = 24 * 60;
const GUEST_MAX_OPEN = 1, MEMBER_MAX_OPEN = 3, GUEST_IP_WIN = 10 * 60 * 1000, GUEST_IP_MAX = 5, PLAY_TTL = 5 * 60 * 1000;
const ipMakes = new Map();
const IP_VOTE_MAX = () => Number(process.env.MIND_BC_IP_MAX || 8);   // 같은 IP에서 라운드당 게스트 표 상한 (PC방·공유기 고려)
const now = () => Date.now();
function sockIp(s) { const h = s.handshake?.headers || {}; const cf = String(h["cf-connecting-ip"] || "").trim(); if (cf) return cf; const x = String(h["x-forwarded-for"] || "").split(",").map((v) => v.trim()).filter(Boolean); if (x.length) return x[0]; return String(s.handshake?.address || "").replace(/^::ffff:/, ""); }
function bcId() { const a = "abcdefghijkmnpqrstuvwxyz23456789"; let s = ""; for (let i = 0; i < 8; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const clean = (s, n) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);
let SB = null, IO = null;
const room = (id) => `mbc:${id}`;

async function loadBc(id) {
  id = String(id || "").slice(0, 16);
  if (BC.has(id)) return BC.get(id);
  if (!SB) return null;
  const { data: row } = await SB.from("mind_broadcasts").select("*").eq("id", id).maybeSingle();
  if (!row) return null;
  const [{ data: ents }, { data: preds }, { data: vs }] = await Promise.all([SB.from("mind_bc_entries").select("*").eq("bc_id", id).limit(20000), SB.from("mind_bc_predictions").select("*").eq("bc_id", id).limit(20000), SB.from("mind_bc_voters").select("*").eq("bc_id", id).limit(50000)]);
  const b = mkState(row); for (const e of ents || []) b.entries.set(e.owner_key, e); for (const x of preds || []) b.preds.set(x.owner_key, x); for (const v of vs || []) b.voters.set(v.owner_key, v);
  BC.set(id, b);
  if (BC.size > 300) { const old = [...BC.entries()].sort((a, c) => a[1].at - c[1].at)[0]; if (old) BC.delete(old[0]); }
  return b;
}
const mkState = (row) => ({ row: { settings: {}, rounds: [], ...row }, entries: new Map(), preds: new Map(), voters: new Map(), playing: new Map(), stats: null, dirty: true, at: 0, timer: null, cur: null, countTimer: null, used: new Set((row.rounds || []).map((r) => r.qi)) });
const isOpen = (b) => b.row.status === "open" && now() < new Date(b.row.closes_at).getTime();
const acceptsUntil = (b) => new Date(b.row.closes_at).getTime() + GRACE_MS;
const show = (b, name, ok) => (ok && !b.row.settings?.hideNicks ? name : "익명 시청자");

/** 라운드 공개용: 봉인 중이면 표 수만 */
function pubRound(b) {
  const c = b.cur; if (!c) return null;
  const base = { n: c.n, kind: c.kind, q: c.q, o: c.o, phase: c.phase, votes: c.votes.size, locked: !!c.st, closeAt: c.closeAt || null };
  if (c.phase !== "revealed") return base;
  return { ...base, result: c.result };
}
function understanding(b) {
  const rs = b.row.rounds || [];
  const s = rs.filter((r) => r.streamerScore != null).map((r) => r.streamerScore), v = rs.filter((r) => r.viewerHitPct != null).map((r) => r.viewerHitPct);
  return { streamerKnow: s.length ? Math.round(avg(s)) : null, viewerKnow: v.length ? Math.round(avg(v)) : null, nS: s.length, nV: v.length };
}
export function computeStats(b) {
  const all = [...b.entries.values()], valid = all.filter((e) => !e.flagged && !e.is_streamer), hide = !!b.row.settings?.hideScores && b.row.status !== "final";
  const tot = valid.map((e) => e.total), streamer = all.find((e) => e.is_streamer) || null, perArea = {};
  for (const a of C.AREAS) perArea[a] = r1(avg(valid.map((e) => e.areas?.[a]).filter(Number.isFinite)));
  const sorted = [...valid].sort((x, y) => y.total - x.total || new Date(x.created_at) - new Date(y.created_at));
  const kings = {};
  for (const a of C.AREAS) { let best = null; for (const e of valid) { const v = e.areas?.[a]; if (Number.isFinite(v) && (!best || v > best.v)) best = { v, nick: show(b, e.nickname, e.show_name) }; } if (best && best.v > 0) kings[a] = { score: best.v, nick: best.nick }; }
  const voters = [...b.voters.values()].sort((x, y) => y.pts - x.pts || y.hits - x.hits), rs = b.row.rounds || [];
  const sHit = rs.filter((r) => r.streamerHit != null), people = new Set([...b.entries.keys(), ...b.voters.keys()]); for (const e of all) if (e.is_streamer) people.delete(e.owner_key);
  const s = {
    id: b.row.id, title: b.row.title, streamer: b.row.streamer_nick, mode: b.row.mode, lv: b.row.lv, setVer: b.row.set_ver, status: b.row.status, closesAt: b.row.closes_at, open: isOpen(b), settings: b.row.settings || {},
    people: people.size, count: valid.length, device: { pc: valid.filter((e) => e.device === "pc").length, mobile: valid.filter((e) => e.device === "mobile").length },
    hidden: hide, avgTotal: hide ? null : r1(avg(tot)), medianTotal: hide ? null : median(tot), perArea: hide ? {} : perArea, kings: hide ? {} : kings,
    top10: hide ? [] : sorted.slice(0, 10).map((e, i) => ({ rank: i + 1, nick: show(b, e.nickname, e.show_name), total: e.total, device: e.device, member: !!e.is_member })),
    streamerScore: hide || !streamer ? null : { total: streamer.total, areas: streamer.areas }, beatStreamer: hide || !streamer || !valid.length ? null : Math.round((valid.filter((e) => e.total > streamer.total).length / valid.length) * 100),
    voteTop: voters.slice(0, 10).map((v, i) => ({ rank: i + 1, nick: show(b, v.nickname, v.show_name), pts: v.pts, hits: v.hits })),
    round: pubRound(b), rounds: rs.map((r) => ({ n: r.n, kind: r.kind, q: r.q, o: r.o, cnt: r.cnt, total: r.total, winners: r.winners, streamerPick: r.streamerPick, streamerHit: r.streamerHit, viewerHitPct: r.viewerHitPct, streamerScore: r.streamerScore })),
    streamerHitRate: sHit.length ? Math.round((sHit.filter((r) => r.streamerHit).length / sHit.length) * 100) : null, understanding: understanding(b),
    predictions: b.preds.size, updatedAt: new Date().toISOString(),
  };
  if (b.row.status === "final") { const uu = s.understanding; if (uu.streamerKnow != null && uu.viewerKnow != null) s.winnerTeam = uu.streamerKnow > uu.viewerKnow ? "streamer" : uu.viewerKnow > uu.streamerKnow ? "viewers" : "draw"; }
  if (b.row.status === "final" && avg(tot) != null) s.predictWinners = [...b.preds.values()].map((x) => ({ nick: x.nickname, guess: Number(x.guess), gap: r1(Math.abs(Number(x.guess) - avg(tot))) })).sort((x, y) => x.gap - y.gap).slice(0, 5);
  const play = [...b.playing.values()].filter((x) => now() - x.at < PLAY_TTL).sort((x, y) => y.round - x.round || x.since - y.since);
  s.playing = b.row.status === "final" ? 0 : play.length;
  s.playingList = b.row.status === "final" ? [] : play.slice(0, 60).map((x) => ({ nick: x.streamer ? x.nick : show(b, x.nick, x.showName), round: x.round, total: x.total, streamer: !!x.streamer }));
  return s;
}
function markDirty(b) {
  b.dirty = true; REST_CACHE.delete(b.row.id);
  if (b.timer) return;
  b.timer = setTimeout(() => { b.timer = null; b.stats = computeStats(b); b.dirty = false; b.at = now(); IO?.to(room(b.row.id)).emit("mbc:stats", b.stats); }, Math.max(0, STATS_MS - (now() - b.at)));
}
function markCount(b) { if (b.countTimer) return; b.countTimer = setTimeout(() => { b.countTimer = null; if (b.cur) IO?.to(room(b.row.id)).emit("mbc:count", { n: b.cur.n, votes: b.cur.votes.size, phase: b.cur.phase, locked: !!b.cur.st }); }, COUNT_MS); }
const pushNow = (b) => { b.stats = computeStats(b); b.dirty = false; b.at = now(); REST_CACHE.delete(b.row.id); IO?.to(room(b.row.id)).emit("mbc:stats", b.stats); };
function getStats(b) { if (b.row.final_stats) return b.row.final_stats; if (!b.stats || (b.dirty && now() - b.at > STATS_MS) || b.stats.open !== isOpen(b)) { b.stats = computeStats(b); b.dirty = false; b.at = now(); } return { ...b.stats, round: pubRound(b) }; }

// ---------- mind.js 고리 ----------
export async function bcOnBegin(id, mode) {
  const b = await loadBc(id); if (!b) return { ok: false, error: "BC_NOT_FOUND" };
  if (!isOpen(b)) return { ok: false, error: "BC_CLOSED" };
  if (mode !== b.row.mode) return { ok: false, error: "BC_MODE" };
  if (b.row.set_ver !== C.SET_VERSION) return { ok: false, error: "BC_VERSION" };
  return { ok: true, bc: b.row.id, lv: b.row.lv };
}
export function bcPlay(id, key, info) {
  const b = BC.get(String(id || "")); if (!b || b.row.status === "final") return;
  const cur = b.playing.get(key), x = { since: cur?.since || now(), ...cur, ...info, at: now(), streamer: b.row.owner_key === key };
  x.nick = clean(x.nick || "시청자", 12) || "시청자"; b.playing.set(key, x);
  if (b.playing.size > 3000) { const old = [...b.playing.entries()].sort((p, q) => p[1].at - q[1].at)[0]; if (old) b.playing.delete(old[0]); }
  markDirty(b);
}
export function bcPlayEnd(id, key) { const b = BC.get(String(id || "")); if (b?.playing.delete(key)) markDirty(b); }
export async function bcOnFinish(id, { key, me, row, sessStarted, showName }) {
  const b = await loadBc(id); if (!b) return { counted: false, reason: "BC_NOT_FOUND" };
  if (b.row.status === "final") return { counted: false, reason: "BC_FINAL" };
  if (sessStarted > new Date(b.row.closes_at).getTime() || now() > acceptsUntil(b)) return { counted: false, reason: "BC_CLOSED" };
  if (b.entries.has(key)) return { counted: false, reason: "ALREADY", first: true };
  const isStreamer = b.row.owner_key === key;
  const e = { bc_id: b.row.id, owner_key: key, user_id: me.isGuest ? null : me.id, result_id: row.id, nickname: row.nickname, show_name: showName !== false, is_member: !me.isGuest, is_streamer: isStreamer, device: row.device, total: row.total, areas: row.areas, flagged: !!row.flagged, created_at: new Date().toISOString() };
  b.entries.set(key, e);
  if (SB) { const { error } = await SB.from("mind_bc_entries").insert(e); if (error && String(error.code) !== "23505") { b.entries.delete(key); console.error("[mind bc] entry", error.message); return { counted: false, reason: "SAVE_FAIL" }; } }
  markDirty(b);
  return { counted: !e.flagged && !isStreamer, streamer: isStreamer };
}
async function finalize(b, force = false) {
  if (b.row.status === "final") return;
  if (!force && now() < acceptsUntil(b)) return;
  if (b.cur && b.cur.phase !== "revealed") b.cur = null;   // 공개 안 한 라운드는 결과에 안 넣음
  b.row.status = "final";
  const stats = computeStats(b); stats.status = "final"; stats.open = false; stats.finalAt = new Date().toISOString();
  b.row.final_stats = stats; REST_CACHE.delete(b.row.id);
  if (SB) await SB.from("mind_broadcasts").update({ status: "final", final_stats: stats, finalized_at: stats.finalAt, rounds: b.row.rounds }).eq("id", b.row.id);
  IO?.to(room(b.row.id)).emit("mbc:stats", stats);
}
// 공개·채점 — 서버에 봉인된 표로 계산
function reveal(b) {
  const c = b.cur, cnt = c.o.map(() => 0); let total = 0;
  for (const v of c.votes.values()) if (v.c != null && v.c >= 0) { cnt[v.c]++; total++; }
  const top = Math.max(0, ...cnt), winners = top > 0 ? cnt.map((n, i) => (n === top ? i : -1)).filter((i) => i >= 0) : [];
  const pick = c.st?.pick ?? null; let streamerHit = null, viewerHitPct = null, streamerScore = null;
  const gHit = (k) => k === pick;
  if (c.kind === "vote" || c.kind === "majority") { streamerHit = pick != null && winners.includes(pick); streamerScore = streamerHit ? 100 : pick == null ? null : 30; }
  if (c.kind === "streamer") { const g = [...c.votes.values()].filter((v) => v.g != null); viewerHitPct = g.length ? Math.round((g.filter((v) => gHit(v.g)).length / g.length) * 100) : null; }
  let actualPct = null;
  if (c.kind === "know") { const g = [...c.votes.values()].filter((v) => v.g != null); viewerHitPct = g.length ? Math.round((g.filter((v) => gHit(v.g)).length / g.length) * 100) : null; actualPct = total ? Math.round((cnt[0] / total) * 100) : null; if (actualPct != null && c.st?.pct != null) streamerScore = Math.max(0, 100 - Math.abs(actualPct - c.st.pct) * 2); }
  // 시청자 점수
  const updates = [];
  for (const [k, v] of c.votes) {
    let gain = 1, hit = false;
    if (c.kind === "majority") hit = winners.includes(v.c);
    if ((c.kind === "streamer" || c.kind === "know") && pick != null) hit = v.g === pick;
    if (hit) gain += 3;
    const row = b.voters.get(k) || { bc_id: b.row.id, owner_key: k, nickname: v.nick, show_name: v.show, pts: 0, votes: 0, hits: 0 };
    row.pts += gain; row.votes++; if (hit) row.hits++; row.nickname = v.nick; row.show_name = v.show; row.updated_at = new Date().toISOString();
    b.voters.set(k, row); updates.push(row);
  }
  c.phase = "revealed";
  c.result = { cnt, total, winners, streamerPick: pick, streamerPct: c.st?.pct ?? null, actualPct, streamerHit, viewerHitPct, streamerScore, votes: c.votes.size };
  const rec = { n: c.n, qi: c.qi, kind: c.kind, q: c.q, o: c.o, ...c.result };
  b.row.rounds = [...(b.row.rounds || []), rec];
  if (SB) {
    SB.from("mind_broadcasts").update({ rounds: b.row.rounds }).eq("id", b.row.id).then(({ error }) => { if (error) console.error("[mind bc] rounds", error.message); }, () => {});
    for (let i = 0; i < updates.length; i += 500) SB.from("mind_bc_voters").upsert(updates.slice(i, i + 500), { onConflict: "bc_id,owner_key" }).then(({ error }) => { if (error) console.error("[mind bc] voters", error.message); }, () => {});
  }
  return rec;
}

export function registerMindBroadcast(io, supabaseAdmin, app, { memberProfile } = {}) {
  SB = supabaseAdmin; IO = io;
  setInterval(() => { for (const b of BC.values()) { finalize(b).catch(() => {}); let gone = false; for (const [k, x] of b.playing) if (now() - x.at >= PLAY_TTL) { b.playing.delete(k); gone = true; } if (gone) markDirty(b); } }, 30000).unref?.();

  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const key = me.isGuest ? `g:${me.id}` : `u:${me.id}`;
    let win = now(), cnt = 0;
    const on = (ev, fn) => socket.on(ev, async (p, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      const n = now(); if (n - win > 10000) { win = n; cnt = 0; } if (++cnt > Number(process.env.MIND_RL || 30)) return reply({ ok: false, error: "RATE_LIMITED" });
      try { await fn(p || {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); }
    });
    on("mbc:create", async (p, reply) => {
      { const _f = createFlight("mbc", me?.id, reply); if (!_f) return; reply = _f; } // 방 중복 생성 막기
      if (!SB) return reply({ ok: false, error: "NO_DB" });
      if (me.isGuest) {
        if (!clean(p.streamerNick, 16)) return reply({ ok: false, error: "NEED_NICK" });
        const ip = sockIp(socket), n = now(), arr = (ipMakes.get(ip) || []).filter((t) => n - t < GUEST_IP_WIN);
        if (arr.length >= GUEST_IP_MAX) return reply({ ok: false, error: "RATE_LIMITED" }); ipMakes.set(ip, arr);
      }
      const mode = p.mode === "full" ? "full" : "quick", lv = Math.min(3, Math.max(1, Number(p.lv ?? 1))), mins = Math.min(MAX_DEADLINE_MIN, Math.max(5, Math.round(Number(p.minutes) || 30)));
      const mp = !me.isGuest && memberProfile ? await memberProfile(SB, me) : null;
      const nick = clean(p.streamerNick, 16) || clean(mp?.nickname, 16) || "스트리머", title = clean(p.title, 40) || `${nick} 방송 심리전`;
      const { count } = await SB.from("mind_broadcasts").select("id", { count: "exact", head: true }).eq("owner_key", key).eq("status", "open").gt("closes_at", new Date().toISOString());
      if ((count || 0) >= (me.isGuest ? GUEST_MAX_OPEN : MEMBER_MAX_OPEN)) return reply({ ok: false, error: "TOO_MANY_OPEN", max: me.isGuest ? GUEST_MAX_OPEN : MEMBER_MAX_OPEN });
      const row = { id: bcId(), owner_key: key, user_id: me.isGuest ? null : me.id, title, streamer_nick: nick, avatar_url: mp?.avatar_url || null, mode, lv, set_ver: C.SET_VERSION, status: "open", closes_at: new Date(now() + mins * 60000).toISOString(), settings: { showQr: true, hideNicks: false, hideScores: false }, rounds: [], created_at: new Date().toISOString() };
      const { error } = await SB.from("mind_broadcasts").insert(row);
      if (error) { console.error("[mind bc] create", error.message); return reply({ ok: false, error: "SAVE_FAIL" }); }
      if (me.isGuest) { const ip = sockIp(socket); ipMakes.set(ip, [...(ipMakes.get(ip) || []), now()]); if (ipMakes.size > 5000) ipMakes.clear(); }
      SB.from("streamer_chat_log").insert({ platform: "mind", channel_id: row.id, nickname: nick, content_id: null, content_title: title, content_mode: null, room_code: row.id, host_user_id: me.isGuest ? null : me.id, host_nick: me.isGuest ? null : (mp?.nickname || null) }).then(({ error: le }) => { if (le) console.error("[mind bc] streamer log", le.message); }, () => {});
      BC.set(row.id, mkState(row));
      reply({ ok: true, bc: row });
    });
    on("mbc:mine", async (_p, reply) => {
      if (!SB) return reply({ ok: true, rows: [] });
      const { data } = await SB.from("mind_broadcasts").select("id, title, mode, status, closes_at, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(20);
      reply({ ok: true, rows: data || [] });
    });
    on("mbc:watch", async (p, reply) => {
      const b = await loadBc(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" });
      await finalize(b); socket.join(room(b.row.id));
      const owner = b.row.owner_key === key, e = b.entries.get(key), pr = b.preds.get(key), v = b.cur?.votes.get(key);
      reply({ ok: true, stats: getStats(b), owner, mine: e ? { total: e.total, streamer: e.is_streamer } : null, myGuess: pr ? Number(pr.guess) : null, myVote: v ? { c: v.c, g: v.g } : null, myPts: b.voters.get(key)?.pts || 0, ownerRound: owner && b.cur?.st ? { pick: b.cur.st.pick, pct: b.cur.st.pct } : null, bank: owner ? C.BC_QUESTIONS.map((q, i) => ({ i, q: q.q, used: b.used.has(i) })) : undefined });
    });
    // 시청자 표: 한 사람 한 표(첫 표로 잠김), 스트리머 본인은 불가, 같은 IP 게스트 표 상한
    on("mbc:vote", async (p, reply) => {
      const b = BC.get(String(p.id || "")) || await loadBc(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" });
      const c = b.cur; if (!c || c.phase !== "open" || (p.n | 0) !== c.n) return reply({ ok: false, error: "VOTE_CLOSED" });
      if (b.row.owner_key === key) return reply({ ok: false, error: "OWNER_CANNOT_VOTE" });
      if (c.votes.has(key)) return reply({ ok: true, dup: true });
      const N = c.o.length, valid = (x) => Number.isInteger(x) && x >= 0 && x < N;
      const needC = c.kind !== "streamer", needG = c.kind === "streamer" || c.kind === "know";
      if ((needC && !valid(p.c)) || (needG && !valid(p.g))) return reply({ ok: false, error: "BAD_VOTE" });
      if (me.isGuest) { const ip = sockIp(socket), n = (c.ipN.get(ip) || 0) + 1; if (n > IP_VOTE_MAX()) return reply({ ok: false, error: "IP_LIMIT" }); c.ipN.set(ip, n); }
      const mp = !me.isGuest && memberProfile ? await memberProfile(SB, me) : null;
      c.votes.set(key, { c: needC ? p.c : null, g: needG ? p.g : null, nick: clean(mp?.nickname || p.nick, 12) || "시청자", show: p.showName !== false });
      markCount(b); reply({ ok: true, locked: true });
    });
    on("mbc:predict", async (p, reply) => {
      const b = await loadBc(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" });
      if (!isOpen(b)) return reply({ ok: false, error: "BC_CLOSED" });
      if (b.preds.has(key)) return reply({ ok: false, error: "ALREADY" });
      const guess = Math.round(Number(p.guess) * 10) / 10; if (!(guess >= 0 && guess <= 100)) return reply({ ok: false, error: "BAD_GUESS" });
      const mp = !me.isGuest && memberProfile ? await memberProfile(SB, me) : null;
      const x = { bc_id: b.row.id, owner_key: key, nickname: clean(mp?.nickname || p.nick, 12) || "시청자", guess, created_at: new Date().toISOString() };
      b.preds.set(key, x);
      if (SB) { const { error } = await SB.from("mind_bc_predictions").insert(x); if (error && String(error.code) !== "23505") { b.preds.delete(key); return reply({ ok: false, error: "SAVE_FAIL" }); } }
      markDirty(b); reply({ ok: true, guess });
    });
    // 방장 전용
    on("mbc:control", async (p, reply) => {
      const b = await loadBc(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" });
      if (b.row.owner_key !== key) return reply({ ok: false, error: "NOT_OWNER" });
      if (b.row.status === "final") return reply({ ok: false, error: "BC_FINAL" });
      const a = p.action;
      if (a === "extend") { const mins = Math.min(MAX_DEADLINE_MIN, Math.max(1, Math.round(Number(p.minutes) || 10))); b.row.closes_at = new Date(Math.max(now(), new Date(b.row.closes_at).getTime()) + mins * 60000).toISOString(); if (SB) await SB.from("mind_broadcasts").update({ closes_at: b.row.closes_at }).eq("id", b.row.id); }
      else if (a === "close") { b.row.closes_at = new Date(Math.min(now(), new Date(b.row.closes_at).getTime())).toISOString(); if (SB) await SB.from("mind_broadcasts").update({ closes_at: b.row.closes_at }).eq("id", b.row.id); }
      else if (a === "finalize") { if (isOpen(b)) return reply({ ok: false, error: "STILL_OPEN" }); await finalize(b, true); }
      else if (a === "settings") { const s = { ...(b.row.settings || {}) }; for (const k of ["showQr", "hideNicks", "hideScores"]) if (p[k] != null) s[k] = !!p[k]; b.row.settings = s; if (SB) await SB.from("mind_broadcasts").update({ settings: s }).eq("id", b.row.id); }
      else if (a === "open") {   // 문제 공개
        if (b.cur && b.cur.phase !== "revealed") return reply({ ok: false, error: "ROUND_ACTIVE" });
        const kind = C.BC_KINDS[p.kind] ? p.kind : "vote", qi = Number.isInteger(p.qi) ? p.qi : -1, bank = C.BC_QUESTIONS[qi];
        let q, o; if (bank) { q = bank.q; o = bank.o; } else { q = clean(p.q, 80); o = Array.isArray(p.o) ? p.o.map((x) => clean(x, 24)).filter(Boolean).slice(0, 4) : []; if (!q || o.length < 2) return reply({ ok: false, error: "BAD_QUESTION" }); }
        if (bank) b.used.add(qi);
        b.cur = { n: (b.row.rounds?.length || 0) + 1, qi, kind, q, o, phase: "open", votes: new Map(), ipN: new Map(), st: null, result: null, openedAt: now() };
      } else if (a === "lock") {  // 스트리머 예측 확정 (표를 안 보고) — 한 번만
        const c = b.cur; if (!c || c.phase === "revealed") return reply({ ok: false, error: "NO_ROUND" });
        if (c.st) return reply({ ok: false, error: "ALREADY" });
        if (!Number.isInteger(p.pick) || p.pick < 0 || p.pick >= c.o.length) return reply({ ok: false, error: "BAD_VOTE" });
        const pct = c.kind === "know" ? Math.round(Number(p.pct)) : null; if (c.kind === "know" && !(pct >= 0 && pct <= 100)) return reply({ ok: false, error: "BAD_VOTE" });
        c.st = { pick: p.pick, pct };
      } else if (a === "closeVotes") { const c = b.cur; if (!c || c.phase !== "open") return reply({ ok: false, error: "NO_ROUND" }); const secs = Math.min(30, Math.max(0, Math.round(Number(p.in) || 0))); if (secs) { c.closeAt = now() + secs * 1000; clearTimeout(c.closeT); c.closeT = setTimeout(() => { if (c.phase === "open") { c.phase = "closed"; pushNow(b); } }, secs * 1000); } else c.phase = "closed"; }
      else if (a === "reveal") { const c = b.cur; if (!c || c.phase !== "closed") return reply({ ok: false, error: "NO_ROUND" }); if (!c.st) return reply({ ok: false, error: "NEED_LOCK" }); reveal(b); }
      else return reply({ ok: false, error: "BAD_ACTION" });
      pushNow(b);
      reply({ ok: true, stats: getStats(b), ownerRound: b.cur?.st || null });
    });
  });

  if (!app) return;
  app.get("/mind/bc/:id", async (req, res) => {
    try {
      const id = String(req.params.id || "").slice(0, 16), c = REST_CACHE.get(id); if (c && now() - c.at < 1500) return res.json(c.body);
      const b = await loadBc(id); if (!b) return res.status(404).json({ ok: false, error: "BC_NOT_FOUND" });
      await finalize(b); const body = { ok: true, stats: getStats(b) };
      REST_CACHE.set(id, { at: now(), body }); if (REST_CACHE.size > 500) REST_CACHE.clear();
      res.json(body);
    } catch (e) { console.error("[mind bc/get]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  app.get("/mind/bc/:id/rank", async (req, res) => {
    try {
      const id = String(req.params.id || "").slice(0, 16), from = Math.max(0, Math.min(1000, parseInt(req.query.from, 10) || 0)), n = Math.max(1, Math.min(50, parseInt(req.query.n, 10) || 50));
      const b = await loadBc(id); if (!b) return res.status(404).json({ ok: false, error: "BC_NOT_FOUND" });
      if (b.row.settings?.hideScores && b.row.status !== "final") return res.json({ ok: true, total: 0, from, rows: [], more: false, hidden: true });
      const list = [...b.entries.values()].filter((e) => !e.flagged && !e.is_streamer).sort((x, y) => y.total - x.total || new Date(x.created_at) - new Date(y.created_at));
      const end = Math.min(list.length, from + n, 1000), rows = []; for (let i = from; i < end; i++) { const e = list[i]; rows.push({ rank: i + 1, nick: show(b, e.nickname, e.show_name), total: e.total, device: e.device }); }
      res.json({ ok: true, total: list.length, from, rows, more: end < Math.min(list.length, 1000) });
    } catch (e) { console.error("[mind bc/rank]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  // 방송 대항전: 같은 검사·난이도·채점 버전만 순위, 참여 10명 미만 제외
  app.get("/mind/bc-battle", async (req, res) => {
    try {
      const ids = String(req.query.ids || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 8);
      if (ids.length < 2) return res.status(400).json({ ok: false, error: "NEED_2" });
      const list = []; for (const id of ids) { const b = await loadBc(id); if (b) { await finalize(b); list.push(computeStats(b)); } }
      if (list.length < 2) return res.status(404).json({ ok: false, error: "BC_NOT_FOUND" });
      const base = list[0], rows = list.map((s) => ({ id: s.id, title: s.title, streamer: s.streamer, mode: s.mode, lv: s.lv, count: s.count, avgTotal: s.avgTotal, medianTotal: s.medianTotal, comparable: s.mode === base.mode && s.lv === base.lv && s.setVer === base.setVer, enough: s.count >= MIN_BATTLE }));
      rows.filter((r) => r.comparable && r.enough && r.avgTotal != null).sort((a, b) => b.avgTotal - a.avgTotal || b.medianTotal - a.medianTotal).forEach((r, i) => { r.rank = i + 1; });
      res.json({ ok: true, mode: base.mode, lv: base.lv, minCount: MIN_BATTLE, rows });
    } catch (e) { console.error("[mind bc/battle]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  app.get("/mind/bc-ranking", async (req, res) => {
    try {
      const mode = req.query.mode === "full" ? "full" : "quick", lv = [1, 2, 3].includes(Number(req.query.lv)) ? Number(req.query.lv) : 1;
      const { data, error } = await SB.from("mind_broadcasts").select("id, title, streamer_nick, mode, lv, final_stats, finalized_at").eq("status", "final").eq("mode", mode).eq("lv", lv).order("finalized_at", { ascending: false }).limit(300);
      if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
      const rows = (data || []).filter((r) => (r.final_stats?.count || 0) >= MIN_BATTLE && r.final_stats?.avgTotal != null).map((r) => ({ id: r.id, title: r.title, streamer: r.streamer_nick, count: r.final_stats.count, avgTotal: r.final_stats.avgTotal, medianTotal: r.final_stats.medianTotal, at: r.finalized_at })).sort((a, b) => b.avgTotal - a.avgTotal).slice(0, 50);
      res.json({ ok: true, mode, lv, minCount: MIN_BATTLE, rows });
    } catch (e) { console.error("[mind bc-ranking]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
}
export const _bcTest = { BC, computeStats, finalize, reveal };
