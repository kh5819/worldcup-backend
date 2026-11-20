// =========================
// 플듀 눈치 진단소 — 서버 (nc:* 혼자·오늘·방송 · ncm:* 친구 대결 2~8명 · nc:bc:* 방송 현황판 + /nc/* REST)
// 판정은 전부 서버 (정답·AI 속마음·상대 카드는 서버만 앎)
// 다수 예측의 '군중' = 혼자: 지금까지 모든 사람의 선택(nc_crowd) · 방송: 그 방송 시청자 · 친구 대결: 방 사람들
// 방송 진단소를 만들면 admin 「📺 스트리머」 기록(platform "nunchi")
// DB: nc_results · nc_broadcasts · nc_bc_entries · nc_bc_predictions · nc_crowd (sql/nc_tables_20261120.sql)
// =========================
import * as C from "./nc-core.js";
import { KAKAO, MAJOR, DEAL_ITEMS, TRUST_AI, NAMES, LIE_CASES } from "./nc-data.js";
import { memberProfile, sanitizeProfile, sanitizePrefs, resultId, userKey, device } from "./iq.js";
import { tx, trStr } from "./nc-tr.js";

const SESS = new Map(), SESS_TTL = 3 * 3600e3, MAX_SESS = 3, DAILY_STARTS = new Map();
const BC = new Map(), BC_STATS_MS = 2000, BC_GRACE = 30 * 60e3, BC_MAX_MIN = 24 * 60, BC_PLAY_TTL = 6 * 60e3;
const ROOMS = new Map(), MAX_ROOMS = 300, ROOM_TTL = 2 * 3600e3;
const GUEST_MAX_OPEN = 1, MEMBER_MAX_OPEN = 3, GUEST_IP_WIN = 10 * 60e3, GUEST_IP_MAX = 5;
const RL = Math.max(1, Number(process.env.NC_RL) || 1), FAST = process.env.NC_TEST_FAST === "1";
const ipMakes = new Map();
let SB = null, IO = null;
const now = () => Date.now();
const LOBBY_GRACE = Number(process.env.LOBBY_GRACE_MS) || 20000;
const newSeed = () => (Math.floor(Math.random() * 0xffffffff) >>> 0) || 7;
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
function sockIp(socket) { const h = socket.handshake?.headers || {}; const cf = String(h["cf-connecting-ip"] || "").trim(); if (cf) return cf; const x = String(h["x-forwarded-for"] || "").split(",").map((v) => v.trim()).filter(Boolean); return x[0] || String(socket.handshake?.address || "").replace(/^::ffff:/, ""); }
const idNew = (n = 8) => { const a = "abcdefghijkmnpqrstuvwxyz23456789"; let s = ""; for (let i = 0; i < n; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
const roomCode = () => { const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
function sweep() { const n = now(); for (const [k, s] of SESS) if (n - s.createdAt > SESS_TTL) SESS.delete(k); for (const [k, r] of ROOMS) if (n - r.touched > ROOM_TTL || (r.phase === "over" && n - r.touched > 15 * 60e3)) { clearTimeout(r.timer); ROOMS.delete(k); } if (DAILY_STARTS.size > 50000) DAILY_STARTS.clear(); }

// ---------- 모든 사람의 선택 (다수 예측 군중) ----------
const CROWD = new Map(), CROWD_DIRTY = new Set(); let crowdLoaded = false;
async function loadCrowd() { if (crowdLoaded || !SB) return; crowdLoaded = true; try { const { data } = await SB.from("nc_crowd").select("q, o, n").limit(2000); for (const r of data || []) { const a = CROWD.get(r.q) || [0, 0, 0, 0]; a[r.o] = Number(r.n) || 0; CROWD.set(r.q, a); } } catch (e) { console.warn("[nc] crowd load", e?.message); } }
function crowdVote(q, o) { const a = CROWD.get(q) || [0, 0, 0, 0]; a[o] = (a[o] || 0) + 1; CROWD.set(q, a); CROWD_DIRTY.add(q); }
async function flushCrowd() { if (!SB || !CROWD_DIRTY.size) return; const rows = []; for (const q of CROWD_DIRTY) (CROWD.get(q) || []).forEach((n, o) => { if (n) rows.push({ q, o, n }); }); CROWD_DIRTY.clear(); const { error } = await SB.from("nc_crowd").upsert(rows, { onConflict: "q,o" }); if (error) console.error("[nc] crowd save", error.message); }

// ---------- 결과 저장 ----------
function publicRow(row, { owner = false } = {}) {
  if (!row) return null;
  return { id: row.id, nick: row.nickname, avatar: row.avatar, avatarUrl: row.avatar_url || null, mode: row.mode, setKey: row.set_key, device: row.device, total: row.total, level: row.level, typeId: row.type_id, abil: row.abil, diag: row.diag, isPublic: row.is_public, flagged: row.flagged, isGuest: !row.user_id, mine: owner, isStreamer: !!row.is_streamer, bcId: row.bc_id || null, groupId: row.group_id || null, createdAt: row.created_at, age: owner || row.show_age ? row.age : null };
}
function buildRow({ key, me, prof, prefs, mode, setKey, dev, st, isPublic, avatarUrl, bc, groupId, flagged, extra }) {
  const dg = { ...C.diagnose(st), ...(extra || {}) };
  return { id: resultId(), owner_key: key, user_id: me.isGuest ? null : me.id, nickname: prof.nick, age: prof.age, avatar: prof.avatar, avatar_url: avatarUrl || null, mode, set_key: setKey || null, device: dev, core_ver: C.CORE_VERSION, seed: st.seed, total: dg.total, level: dg.level, type_id: dg.typeId, abil: dg.abil, diag: dg, is_public: isPublic !== false, flagged: !!flagged, show_age: !!prefs.showAge, is_streamer: !!prefs.streamer, bc_id: bc || null, group_id: groupId || null, created_at: new Date().toISOString() };
}
async function saveRow(row) { if (!SB) return null; const { error } = await SB.from("nc_results").insert(row); if (error) { console.error("[nc] save", error.message); return null; } return row.id; }
async function percentile(mode, setKey, total) {
  if (!SB) return null;
  try { let q = SB.from("nc_results").select("id", { count: "exact", head: true }).eq("mode", mode).eq("flagged", false); if (setKey) q = q.eq("set_key", setKey); const { count: all } = await q; if (!all || all < 20) return null;
    let q2 = SB.from("nc_results").select("id", { count: "exact", head: true }).eq("mode", mode).eq("flagged", false).gt("total", total); if (setKey) q2 = q2.eq("set_key", setKey); const { count: better } = await q2; return Math.max(1, Math.round(((better || 0) / all) * 100)); } catch { return null; }
}

// ---------- 방송 진단소 ----------
async function loadBc(id) {
  id = String(id || "").slice(0, 16);
  if (BC.has(id)) return BC.get(id);
  if (!SB) return null;
  const { data: row } = await SB.from("nc_broadcasts").select("*").eq("id", id).maybeSingle(); if (!row) return null;
  const { data: ents } = await SB.from("nc_bc_entries").select("*").eq("bc_id", id).limit(20000);
  const { data: preds } = await SB.from("nc_bc_predictions").select("*").eq("bc_id", id).limit(20000);
  const b = newBc(row); for (const e of ents || []) b.entries.set(e.owner_key, e); for (const x of preds || []) b.preds.set(x.owner_key, x);
  BC.set(id, b); if (BC.size > 300) { const old = [...BC.entries()].sort((a, c) => a[1].at - c[1].at)[0]; if (old && old[0] !== id) BC.delete(old[0]); }
  return b;
}
const newBc = (row) => ({ row, entries: new Map(), preds: new Map(), playing: new Map(), feed: [], live: { lie: [0, 0], kakao: [0, 0, 0], trust: [0, 0], deal: [], bluff: [], crowd: {} }, stats: null, dirty: true, at: 0, timer: null, starts: new Set() });
const bcOpen = (b) => b.row.status === "open" && now() < new Date(b.row.closes_at).getTime();
const bcUntil = (b) => new Date(b.row.closes_at).getTime() + BC_GRACE;
const nameOf = (e) => (e.show_name ? e.nickname : "익명");
function bcStats(b) {
  const all = [...b.entries.values()], valid = all.filter((e) => !e.flagged && !e.is_streamer), streamer = all.find((e) => e.is_streamer) || null;
  const sorted = [...valid].sort((x, y) => y.total - x.total || new Date(x.created_at) - new Date(y.created_at));
  const types = {}, levels = {}; for (const e of valid) { types[e.type_id] = (types[e.type_id] || 0) + 1; levels[e.level] = (levels[e.level] || 0) + 1; }
  const gAvg = {}; for (const g of C.GAMES) { const v = valid.map((e) => e.games?.[g]).filter((x) => x != null); gAvg[g] = v.length ? Math.round(avg(v)) : null; }
  const play = [...b.playing.values()].filter((x) => now() - x.at < BC_PLAY_TTL);
  const L = b.live, crowd = Object.entries(L.crowd).map(([id, a]) => { const q = MAJOR.find((m) => m.id === id); const tot = a.reduce((s, x) => s + x, 0); return q && tot ? { q: q.q, o: q.o.map((t, i) => ({ t, pct: Math.round(((a[i] || 0) / tot) * 100) })), n: tot } : null; }).filter(Boolean);
  const s = {
    id: b.row.id, title: b.row.title, streamer: b.row.streamer_nick, status: b.row.status, closesAt: b.row.closes_at, open: bcOpen(b),
    count: valid.length, avgTotal: valid.length ? r1(avg(valid.map((e) => e.total))) : null, best: valid.length ? Math.max(...valid.map((e) => e.total)) : null,
    top10: sorted.slice(0, 10).map((e, i) => ({ rank: i + 1, nick: nameOf(e), total: e.total, level: e.level, typeId: e.type_id })),
    types: Object.entries(types).sort((a, c) => c[1] - a[1]).map(([k, n]) => ({ typeId: k, n, name: C.TYPES[k]?.n || k, ic: C.TYPES[k]?.ic || "" })),
    levels, games: gAvg,
    live: { lieRate: L.lie[1] ? Math.round((L.lie[0] / L.lie[1]) * 100) : null, kakao: L.kakao, trustRate: L.trust[1] ? Math.round((L.trust[0] / L.trust[1]) * 100) : null, dealAvg: L.deal.length ? Math.round(avg(L.deal)) : null, chipsAvg: L.bluff.length ? r1(avg(L.bluff)) : null, crowd },
    streamerRes: streamer ? { total: streamer.total, level: streamer.level, typeId: streamer.type_id } : null,
    beatStreamer: streamer && valid.length ? Math.round((valid.filter((e) => e.total > streamer.total).length / valid.length) * 100) : null,
    predictions: b.preds.size, playing: b.row.status === "final" ? 0 : play.length,
    playingList: b.row.status === "final" ? [] : [...play].sort((x, y) => y.step - x.step).slice(0, 60).map((x) => ({ nick: x.streamer || x.showName ? x.nick : "익명", g: x.g, step: x.step, streamer: !!x.streamer })),
    feed: b.feed.slice(-14), updatedAt: new Date().toISOString(),
  };
  if (b.row.status === "final" && s.avgTotal != null) s.predictWinners = [...b.preds.values()].map((x) => ({ nick: x.nickname, guess: Number(x.guess), gap: r1(Math.abs(Number(x.guess) - s.avgTotal)) })).sort((x, y) => x.gap - y.gap).slice(0, 5);
  return s;
}
function bcDirty(b) { b.dirty = true; if (b.timer) return; b.timer = setTimeout(() => { b.timer = null; b.stats = bcStats(b); b.dirty = false; b.at = now(); IO?.to(`nc:bc:${b.row.id}`).emit("nc:bc:stats", b.stats); }, Math.max(0, BC_STATS_MS - (now() - b.at))); }
function bcGet(b) { if (b.row.final_stats) return b.row.final_stats; if (!b.stats || b.dirty || b.stats.open !== bcOpen(b)) { b.stats = bcStats(b); b.dirty = false; b.at = now(); } return b.stats; }
async function bcFinalize(b, force = false) {
  if (b.row.status === "final" || (!force && now() < bcUntil(b))) return;
  b.row.status = "final"; const st = bcStats(b); st.status = "final"; st.open = false; st.finalAt = new Date().toISOString(); b.row.final_stats = st;
  if (SB) await SB.from("nc_broadcasts").update({ status: "final", final_stats: st, finalized_at: st.finalAt }).eq("id", b.row.id);
  IO?.to(`nc:bc:${b.row.id}`).emit("nc:bc:stats", st);
}

// ---------- 친구 대결 ----------
// 판 구성 (방장이 고를 수 있음): 거짓말 2 · 카톡 2 · 믿을까 4턴 · 협상 4턴 · 블러핑 2판 · 다수 3
const M_PLAN = { lie: 2, kakao: 2, trust: 1, deal: 1, bluff: 2, major: 3 };
const M_MS = FAST ? { q: 2500, r: 400, turn: 1500 } : { q: 25000, r: 6000, turn: 15000 };
const roomPlayers = (r) => [...r.players.values()];
function roomPublic(r) {
  return { code: r.code, phase: r.phase, host: r.hostNick, g: r.g, k: r.k, turn: r.turn ?? null, deadline: r.deadline, games: r.games, info: r.g ? C.GAME_INFO[r.g] : null,
    players: roomPlayers(r).map((p) => ({ nick: p.nick, avatar: p.avatar, host: p.key === r.hostKey, on: p.connected, pts: Math.round(p.pts), done: !!p.ans, last: p.last ?? null })),
    ranking: r.phase === "over" ? r.ranking : null };
}
function emitRoom(r) { r.touched = now(); IO?.to(`ncm:${r.code}`).emit("ncm:state", roomPublic(r)); }
function viewFor(r, p) {
  const v = { me: p.nick, phase: r.phase, g: r.g, k: r.k, pts: Math.round(p.pts), ranking: r.phase === "over" ? r.ranking : null, result: p.result || null, reveal: r.phase === "r" ? p.reveal || null : null, answered: !!p.ans };
  const it = r.item; if (!it) return v;
  if (r.g === "lie") v.lie = { case: it.view.case, people: it.view.people };
  if (r.g === "kakao") { const q = KAKAO.find((x) => x.id === it.id); v.kakao = { who: q.who, ctx: q.ctx, msg: q.msg, opts: it.order.map((i) => q.o[i][0]) }; }
  if (r.g === "major") { const q = MAJOR.find((x) => x.id === it.id); v.major = { q: q.q, opts: q.o }; }
  if (r.g === "trust") { const m = it.match.get(p.key); if (m) v.trust = { opp: m.oppNick, oppLook: m.oppLook, ai: !!m.ai, turn: r.turn, turns: it.turns, hist: m.hist, pts: m.pts, talk: m.talk || null }; }
  if (r.g === "deal") { const d = it.deals.get(p.key); if (d) v.deal = { role: d.role, n: d.n, ic: d.ic, opp: d.oppNick, ai: !!d.ai, value: d.value, turn: r.turn, turns: it.turns, hist: d.hist, done: d.done || null, ask: d.ask }; }
  if (r.g === "bluff") { const h = it.hand; v.bluff = { phase: h.phase, card: h.cards.get(p.key), chips: p.chips, hand: r.k + 1, others: roomPlayers(r).filter((x) => x.key !== p.key).map((x) => ({ nick: x.nick, chips: x.chips, bet: h.phase === "call" || r.phase === "r" ? h.bets.get(x.key) ?? null : null, done: h.phase === "bet" ? h.bets.has(x.key) : h.calls.has(x.key) })), myBet: h.bets.get(p.key) ?? null, myCall: h.calls.has(p.key) }; }
  return v;
}
function emitYou(r, p) { const sock = IO?.sockets?.sockets?.get(p.sid); if (!sock) return; sock.emit("ncm:you", tx(viewFor(r, p), p.lang || "ko")); }
function emitAll(r) { emitRoom(r); for (const p of r.players.values()) emitYou(r, p); }
function setTimer(r, ms, fn) { clearTimeout(r.timer); r.deadline = ms ? now() + ms : null; if (ms) r.timer = setTimeout(() => { try { fn(); } catch (e) { console.error("[ncm]", e); } }, ms); }
function nextRound(r) {
  for (const p of r.players.values()) { p.ans = null; p.reveal = null; }
  if (!r.g || r.k + 1 >= r.games.find((x) => x.g === r.g).n) { const i = r.games.findIndex((x) => x.g === r.g) + 1; if (i >= r.games.length) return finishRoom(r); r.g = r.games[i].g; r.k = 0; }
  else r.k++;
  startItem(r);
}
function startItem(r) {
  const g = r.g, ps = roomPlayers(r); r.turn = 0; r.phase = "q"; r.qAt = now();
  if (g === "lie") { const L = C.genLie(r, r.k + 1); r.item = { lie: L, view: { case: LIE_CASES.find((c) => c.id === L.caseId).t, people: L.names.map((n, i) => ({ name: n, say: C.stmtText(L.stmts[i], L.names), look: C.hashSeed(n) % 1000 })) } }; }
  if (g === "kakao") { const used = r.usedK || (r.usedK = new Set()); const pool = KAKAO.filter((q) => !used.has(q.id)); const q = pool[Math.floor(C.rnd(r) * pool.length)]; used.add(q.id); r.item = { id: q.id, order: shuffleR(r, q.o.map((_, i) => i)) }; }
  if (g === "major") { const used = r.usedM || (r.usedM = new Set()); const pool = MAJOR.filter((q) => !used.has(q.id)); const q = pool[Math.floor(C.rnd(r) * pool.length)]; used.add(q.id); r.item = { id: q.id }; }
  if (g === "trust") {
    const order = shuffleR(r, ps.map((p) => p.key)), match = new Map();
    for (let i = 0; i < order.length; i += 2) {
      const a = r.players.get(order[i]), b = order[i + 1] ? r.players.get(order[i + 1]) : null;
      if (b) { match.set(a.key, { opp: b.key, oppNick: b.nick, oppLook: C.hashSeed(b.nick) % 1000, hist: [], pts: [0, 0] }); match.set(b.key, { opp: a.key, oppNick: a.nick, oppLook: C.hashSeed(a.nick) % 1000, hist: [], pts: [0, 0] }); }
      else { const kind = Object.keys(TRUST_AI)[Math.floor(C.rnd(r) * 5)]; match.set(a.key, { ai: kind, oppNick: NAMES[Math.floor(C.rnd(r) * NAMES.length)], oppLook: 7, hist: [], pts: [0, 0], rs: Array.from({ length: 4 }, () => C.rnd(r)) }); }
    }
    r.item = { match, turns: 4 }; return phaseQ(r, M_MS.turn);
  }
  if (g === "deal") {
    const order = shuffleR(r, ps.map((p) => p.key)), deals = new Map();
    for (let i = 0; i < order.length; i += 2) {
      const a = r.players.get(order[i]), b = order[i + 1] ? r.players.get(order[i + 1]) : null, it = DEAL_ITEMS[Math.floor(C.rnd(r) * DEAL_ITEMS.length)], base = it.ask;
      const Vs = Math.round((base * (0.55 + C.rnd(r) * 0.2)) / 1000) * 1000, Vb = Math.round((Vs + base * (0.2 + C.rnd(r) * 0.25)) / 1000) * 1000;
      if (b) { const pair = { Vs, Vb, n: it.n, ic: it.ic, ask: base }; deals.set(a.key, { id: it.id, role: "sell", n: it.n, ic: it.ic, value: Vs, ask: base, opp: b.key, oppNick: b.nick, hist: [], pair }); deals.set(b.key, { id: it.id, role: "buy", n: it.n, ic: it.ic, value: Vb, ask: base, opp: a.key, oppNick: a.nick, hist: [], pair }); }
      else { const solo = { rs: C.rnd(r) * 1e9 >>> 0 }; const d = C.genDeal(solo, Math.floor(C.rnd(r) * 4)); deals.set(a.key, { id: d.id, ai: d, aiSt: solo, role: d.role, n: d.n, ic: d.ic, value: null, ask: d.ask, oppNick: NAMES[Math.floor(C.rnd(r) * NAMES.length)], hist: [] }); }
    }
    r.item = { deals, turns: 4 }; return phaseQ(r, M_MS.turn);
  }
  if (g === "bluff") {
    const deck = shuffleR(r, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), cards = new Map(); ps.forEach((p, i) => cards.set(p.key, deck[i % 10]));
    r.item = { hand: { phase: "bet", cards, bets: new Map(), calls: new Map() } }; return phaseQ(r, M_MS.q * 0.6);
  }
  phaseQ(r, M_MS.q);
}
function shuffleR(r, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(C.rnd(r) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function phaseQ(r, ms) { r.phase = "q"; r.qAt = now(); r.qMs = ms; setTimer(r, ms, () => resolve(r)); emitAll(r); }
function allIn(r) {
  const ps = roomPlayers(r).filter((p) => p.connected !== false || p.ans);
  if (r.g === "bluff") { const h = r.item.hand; return ps.every((p) => (h.phase === "bet" ? h.bets.has(p.key) : h.calls.has(p.key))); }
  if (r.g === "deal") return ps.every((p) => p.ans || r.item.deals.get(p.key)?.done);
  return ps.every((p) => p.ans);
}
// 친구 대결 답 검사: 정수·범위·형식이 틀리면 거절 (예전엔 1.5 같은 값이 판정 중 오류를 내 방이 멈췄음)
function validAns(r, p, a) {
  const g = r.g, int = (v, n) => Number.isInteger(C.numIn(v)) && C.numIn(v) >= 0 && C.numIn(v) < n;
  if (g === "lie") return int(a.pick, 4);
  if (g === "kakao") return int(a.pick, r.item.order.length);
  if (g === "major") { const n = MAJOR.find((x) => x.id === r.item.id)?.o.length || 0; return int(a.mine, n) && int(a.guess, n); }
  if (g === "trust") return a.move === "C" || a.move === "D";
  if (g === "deal") return Number.isFinite(C.numIn(a.price)) && C.numIn(a.price) > 0 && C.numIn(a.price) <= 1e9;
  if (g === "bluff") return r.item.hand.phase === "bet" ? true : typeof a.fold === "boolean" || a.fold == null;
  return false;
}
function answer(r, p, a) {
  if (r.phase !== "q") return { ok: false, error: "BAD_PHASE" };
  if (!validAns(r, p, a)) return { ok: false, error: "BAD_PICK" };
  const g = r.g;
  if (g === "bluff") { const h = r.item.hand; if (h.phase === "bet") { if (h.bets.has(p.key)) return { ok: false, error: "ALREADY" }; h.bets.set(p.key, Math.min(Math.max(1, Math.min(3, Math.round(Number(a.bet)) || 1)), Math.max(0, p.chips - 1))); } else { if (h.calls.has(p.key)) return { ok: false, error: "ALREADY" }; h.calls.set(p.key, !a.fold); } }
  else { if (p.ans) return { ok: false, error: "ALREADY" }; if (g === "deal" && r.item.deals.get(p.key)?.done) return { ok: false, error: "BAD_PHASE" }; p.ans = g === "deal" ? { price: Number(a.price), at: now() } : g === "trust" ? { move: a.move, at: now() } : g === "major" ? { mine: Number(a.mine), guess: Number(a.guess), at: now() } : { pick: Number(a.pick), at: now() }; }
  emitRoom(r); emitYou(r, p);
  if (allIn(r)) resolve(r);
  return { ok: true };
}
function scoreSpeed(r, p) { const t = p.ans ? (p.ans.at - r.qAt) / r.qMs : 1; return 0.6 + 0.4 * Math.max(0, 1 - t); }
function resolve(r) {
  clearTimeout(r.timer); const g = r.g, ps = roomPlayers(r);
  if (g === "lie") { const L = r.item.lie; for (const p of ps) { const ok = p.ans && Number(p.ans.pick) === L.c, sc = ok ? Math.round(100 * scoreSpeed(r, p)) : 0; p.st.scores.lie.push(ok ? 100 : 0); p.st.logs.lie.push({ ok }); p.pts += sc; p.last = sc; p.reveal = { ok, liar: L.c, rooms: L.rooms.map((x) => C.ROOMS[x]), names: L.names, got: sc }; } return reveal(r); }
  if (g === "kakao") { const q = KAKAO.find((x) => x.id === r.item.id), best = r.item.order.findIndex((i) => q.o[i][1] === 2), dist = r.item.order.map(() => 0);
    for (const p of ps) { const pk = p.ans ? Number(p.ans.pick) : -1, s = pk >= 0 && pk < r.item.order.length ? q.o[r.item.order[pk]][1] : 0; if (pk >= 0) dist[pk]++; const sc = Math.round(s * 50 * scoreSpeed(r, p)); p.st.scores.kakao.push(s * 50); p.st.logs.kakao.push({ id: q.id, s }); if (s === 2) p.st.met.kakaoBest++; p.pts += sc; p.last = sc; p.reveal = { s, best, why: q.why, got: sc, dist }; }
    for (const p of ps) p.reveal.dist = dist; return reveal(r); }
  if (g === "major") { const q = MAJOR.find((x) => x.id === r.item.id), cnt = q.o.map(() => 0); for (const p of ps) if (p.ans && Number(p.ans.mine) >= 0 && Number(p.ans.mine) < q.o.length) { cnt[Number(p.ans.mine)]++; crowdVote(q.id, Number(p.ans.mine)); }
    const max = Math.max(...cnt), top = cnt.map((c, i) => (c === max && max > 0 ? i : -1)).filter((i) => i >= 0), tot = cnt.reduce((s, x) => s + x, 0) || 1;
    for (const p of ps) { const gs = p.ans ? Number(p.ans.guess) : -1, ok = top.includes(gs), sc = ok ? 100 : 0; p.st.scores.major.push(sc); p.st.logs.major.push({ id: q.id, mine: Math.max(0, Number(p.ans?.mine) || 0), guess: Math.max(0, gs), ok, top }); p.pts += sc; p.last = sc; p.reveal = { ok, top, pct: cnt.map((c) => Math.round((c / tot) * 100)), cnt, got: sc }; } return reveal(r); }
  if (g === "trust") {
    const M = r.item.match;
    for (const p of ps) { const m = M.get(p.key); if (!m) continue; const mine = p.ans?.move === "D" ? "D" : "C"; let th;
      if (m.ai) th = C.aiMove(m.ai, r.turn, m.hist.map((h) => h.me), m.hist.map((h) => h.them), m.rs[r.turn]); else { const o = r.players.get(m.opp); th = o?.ans?.move === "D" ? "D" : "C"; }
      const pay = C.PAY[mine + th]; m.hist.push({ me: mine, them: th, pts: pay }); m.pts[0] += pay[0]; m.pts[1] += pay[1];
      p.st.met.turns++; if (mine === "C") p.st.met.coop++; if (mine === "C" && th === "D") p.st.met.betrayed++; p.pts += pay[0] * 5; p.last = pay[0] * 5; p.reveal = { me: mine, them: th, pay }; }
    for (const p of ps) p.ans = null;
    r.turn++;
    if (r.turn >= r.item.turns) { for (const p of ps) { const m = M.get(p.key); if (!m) continue; const sc = Math.round(Math.min(1, m.pts[0] / (r.item.turns * 3.75)) * 100); p.st.scores.trust.push(sc); p.st.logs.trust.push({ kind: m.ai || "human", pts: m.pts.slice(), best: r.item.turns * 5, coop: m.hist.filter((h) => h.me === "C").length }); p.reveal.end = { score: sc, opp: m.oppNick, ai: m.ai ? TRUST_AI[m.ai] : null }; } return reveal(r); }
    r.phase = "r"; emitAll(r); setTimer(r, M_MS.r, () => phaseQ(r, M_MS.turn)); return;
  }
  if (g === "deal") {
    const D = r.item.deals, seen = new Set();
    for (const p of ps) { const d = D.get(p.key); if (!d || d.done) continue;
      const x = Math.max(1000, Math.round((Number(p.ans?.price) || 0) / 1000) * 1000);
      if (d.ai) { const res = p.ans ? C.dealStep(d.aiSt, d.ai, x) : { kind: "counter", price: d.ai.counter, talk: "…" }; d.hist.push({ me: p.ans ? x : null, kind: res.kind, them: res.price ?? null, talk: res.talk }); if (d.ai.done || r.turn + 1 >= r.item.turns) { if (!d.ai.done) d.ai.done = { kind: "leave" }; const sc = C.dealScore(d.ai); d.done = { price: d.ai.done.price ?? null, score: sc, line: d.ai.M }; } continue; }
      if (seen.has(p.key)) continue; const o = r.players.get(d.opp), od = D.get(d.opp); seen.add(p.key); seen.add(d.opp);
      const sell = d.role === "sell" ? d : od, buy = d.role === "buy" ? d : od, sp = d.role === "sell" ? p : o, bp = d.role === "buy" ? p : o;
      const ask = sp?.ans ? Math.max(1000, Math.round(Number(sp.ans.price) / 1000) * 1000) : null, bid = bp?.ans ? Math.max(1000, Math.round(Number(bp.ans.price) / 1000) * 1000) : null;
      sell.hist.push({ me: ask, them: bid }); buy.hist.push({ me: bid, them: ask });
      const P = sell.pair, gap = Math.max(1000, P.Vb - P.Vs);
      if (ask != null && bid != null && bid >= ask) { const price = Math.round((ask + bid) / 2000) * 1000; sell.done = { price, score: Math.round(Math.max(0, Math.min(1, (price - P.Vs) / gap)) * 100), line: P.Vb }; buy.done = { price, score: Math.round(Math.max(0, Math.min(1, (P.Vb - price) / gap)) * 100), line: P.Vs }; }
      else if (r.turn + 1 >= r.item.turns) { sell.done = { price: null, score: 0, line: P.Vb }; buy.done = { price: null, score: 0, line: P.Vs }; }
    }
    for (const p of ps) { p.ans = null; const d = D.get(p.key); p.reveal = d ? { hist: d.hist.at(-1), done: d.done || null } : null; }
    r.turn++;
    if ([...D.values()].every((d) => d.done) || r.turn >= r.item.turns) { for (const p of ps) { const d = D.get(p.key); if (!d) continue; if (!d.done) d.done = { price: null, score: 0, line: null }; p.st.scores.deal.push(d.done.score); p.st.logs.deal.push({ id: d.id, role: d.role, price: d.done.price, ask: d.ask, line: d.done.line ?? 0, score: d.done.score }); p.pts += d.done.score; p.last = d.done.score; p.reveal.end = d.done; } return reveal(r); }
    r.phase = "r"; emitAll(r); setTimer(r, M_MS.r, () => phaseQ(r, M_MS.turn)); return;
  }
  if (g === "bluff") {
    const h = r.item.hand;
    if (h.phase === "bet") { for (const p of ps) if (!h.bets.has(p.key)) h.bets.set(p.key, 1); h.phase = "call"; return phaseQ(r, M_MS.q * 0.6); }
    for (const p of ps) if (!h.calls.has(p.key)) h.calls.set(p.key, true);
    const players = ps.map((p) => ({ key: p.key, card: h.cards.get(p.key), bet: h.bets.get(p.key) || 1, fold: !h.calls.get(p.key), chips: p.chips }));
    const before = new Map(ps.map((p) => [p.key, p.chips])), res = C.settleHand(players), top = Math.max(...players.map((x) => x.card));
    players.forEach((x) => (r.players.get(x.key).chips = x.chips));
    for (const p of ps) { const x = players.find((y) => y.key === p.key), won = players[res.winner].key === p.key; if (won && x.card !== top) p.st.met.bluffWin++; if (x.card <= 4 && x.bet === 3) p.st.met.bluffTry++; if (x.fold && x.card === top) p.st.met.foldBest++; p.st.met.chips = p.chips; p.st.logs.bluff.push({ card: x.card, bet: x.bet, fold: x.fold, won, delta: p.chips - before.get(p.key) });
      p.reveal = { show: players.map((y) => ({ nick: r.players.get(y.key).nick, card: y.card, bet: y.bet, fold: y.fold, chips: y.chips })), winner: r.players.get(players[res.winner].key).nick, pot: res.pot, delta: p.chips - before.get(p.key) }; p.last = p.reveal.delta; }
    if (r.k + 1 >= r.games.find((x) => x.g === "bluff").n) for (const p of ps) { const sc = Math.round(Math.max(0, Math.min(100, 50 + (p.chips - C.BLUFF_START) * 6))); p.st.scores.bluff.push(sc); p.pts += sc; }
    return reveal(r);
  }
}
function reveal(r) { r.phase = "r"; emitAll(r); setTimer(r, M_MS.r, () => nextRound(r)); }
async function finishRoom(r) {
  clearTimeout(r.timer); if (r.phase === "over") return;
  r.phase = "over"; r.deadline = null;
  const list = roomPlayers(r).map((p) => ({ p, d: C.diagnose(p.st) })).sort((a, b) => b.p.pts - a.p.pts);
  r.ranking = list.map(({ p, d }, i) => ({ rank: i + 1, nick: p.nick, avatar: p.avatar, pts: Math.round(p.pts), total: d.total, level: d.level, typeId: d.typeId, type: d.type.n, ic: d.type.ic }));
  const groupId = `${r.code}-${r.created.toString(36)}`;
  for (const { p } of list) { const row = buildRow({ key: p.key, me: p.me, prof: { nick: p.nick, age: null, avatar: p.avatar }, prefs: {}, mode: "multi", setKey: groupId, dev: p.dev, st: p.st, isPublic: true, avatarUrl: p.avatarUrl, groupId, extra: { roomPts: Math.round(p.pts), roomRank: list.findIndex((x) => x.p === p) + 1, roomSize: list.length } }); const id = await saveRow(row); p.result = { id, result: publicRow(row, { owner: true }) }; }
  emitAll(r);
}

// ---------- 등록 ----------
export function registerNunchi(io, supabaseAdmin, app, { getOptionalUser } = {}) {
  SB = supabaseAdmin; IO = io;
  loadCrowd();
  setInterval(sweep, 5 * 60e3).unref?.();
  setInterval(() => flushCrowd().catch(() => {}), 60e3).unref?.();
  setInterval(() => { for (const b of BC.values()) { bcFinalize(b).catch(() => {}); let gone = false; for (const [k, x] of b.playing) if (now() - x.at >= BC_PLAY_TTL) { b.playing.delete(k); gone = true; } if (gone) bcDirty(b); } }, 30000).unref?.();

  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const key = userKey(me);
    let win = now(), cnt = 0;
    const on = (ev, fn, lim = 60) => socket.on(ev, async (p, cb) => {
      const lang = p && (p.lang === "ja" || p.lang === "en") ? p.lang : "ko";
      const reply = typeof cb === "function" ? (o) => cb(tx(o, lang)) : () => {};
      const n = now(); if (n - win > 10000) { win = n; cnt = 0; } if (++cnt > lim * RL) return reply({ ok: false, error: "RATE_LIMITED" });
      try { await fn(p && typeof p === "object" ? p : {}, reply, lang); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); }
    });
    const mySess = (sid) => { const s = SESS.get(String(sid || "")); return s && s.key === key ? s : null; };
    const stepNo = (st) => { let n = 0; for (let i = 0; i < st.pi; i++) n += C.PLAN[i][1]; return n + st.k; };
    const live = (s) => { if (!s.bc) return; const b = BC.get(s.bc); if (!b || b.row.status === "final") return; const x = { nick: s.bcNick || "참가자", showName: s.bcShow, g: s.st.item?.g || "done", step: stepNo(s.st), at: now(), streamer: b.row.owner_key === key }; b.playing.set(key, x); bcDirty(b); };
    const ctxFor = (s) => {
      if (s.bc) { const b = BC.get(s.bc); return { crowd: (id) => b?.live.crowd[id] || null, vote: (id, i) => { if (!b) return; const a = b.live.crowd[id] || [0, 0, 0, 0]; a[i]++; b.live.crowd[id] = a; crowdVote(id, i); } }; }
      return { crowd: (id) => CROWD.get(id) || null, vote: (id, i) => crowdVote(id, i) };
    };

    // ----- 혼자·오늘·방송 -----
    on("nc:begin", async (p, reply) => {
      let mode = p.mode === "daily" ? "daily" : "normal", seed = newSeed(), setKey = null, bc = null, preview = false;
      if (p.bc) { const b = await loadBc(p.bc); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); if (!bcOpen(b)) return reply({ ok: false, error: "BC_CLOSED" }); mode = "bc"; seed = Number(b.row.seed) >>> 0; setKey = b.row.id; bc = b.row.id; if (b.starts.has(key)) preview = true; else b.starts.add(key); }
      else if (mode === "daily") { setKey = C.dayKey(); seed = C.hashSeed("nc-daily-" + setKey); const k = `${key}|${setKey}`; if (DAILY_STARTS.has(k)) preview = true; else DAILY_STARTS.set(k, now()); }
      const mine = [...SESS.entries()].filter(([, s]) => s.key === key).sort((a, b) => a[1].createdAt - b[1].createdAt); while (mine.length >= MAX_SESS) SESS.delete(mine.shift()[0]);
      const st = C.newRun(seed, { mode });
      const sid = "n" + now().toString(36) + Math.random().toString(36).slice(2, 8);
      const s = { key, mode, setKey, bc, preview, device: device(p.device), createdAt: now(), st, finished: null, bcNick: clean(p.bcNick, 12), bcShow: p.bcShowName !== false };
      SESS.set(sid, s); live(s);
      reply({ ok: true, sid, mode, setKey, step: C.publicStep(st), core: C.CORE_VERSION });
    });
    on("nc:resume", (p, reply) => { const s = mySess(p.sid); if (!s || s.finished) return reply({ ok: false, error: "NO_SESSION" }); reply({ ok: true, mode: s.mode, bc: s.bc, step: C.publicStep(s.st), over: s.st.over }); });
    on("nc:act", (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      const g = s.st.item?.g, r = C.act(s.st, p.a || {}, ctxFor(s));
      if (r.ok && s.bc && r.fb) { const b = BC.get(s.bc); if (b) { const L = b.live;
        if (g === "lie") { L.lie[1]++; if (r.fb.ok) L.lie[0]++; }
        if (g === "kakao") L.kakao[r.fb.s] = (L.kakao[r.fb.s] || 0) + 1;
        if (g === "trust") { L.trust[1]++; if (r.fb.me === "C") L.trust[0]++; }
        if (g === "deal" && r.fb.end) L.deal.push(r.fb.end.score);
        if (g === "bluff" && r.fb.chips != null && s.st.logs.bluff.length >= 3) L.bluff.push(r.fb.chips); } }
      live(s); reply(r);
    }, 90);
    on("nc:finish", async (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      if (s.finished) return reply({ ok: true, ...s.finished });
      if (!s.st.over) return reply({ ok: false, error: "NOT_OVER" });
      const prof = sanitizeProfile(p.profile); if (!prof) return reply({ ok: false, error: "BAD_PROFILE" });
      const mp = await memberProfile(SB, me); if (mp?.nickname) prof.nick = String(mp.nickname).slice(0, 12);
      const prefs = sanitizePrefs(p.prefs);
      let repeat = !!s.preview;
      if (s.mode === "daily" && SB) { try { const { count } = await SB.from("nc_results").select("id", { count: "exact", head: true }).eq("owner_key", key).eq("mode", "daily").eq("set_key", s.setKey); if (count) repeat = true; } catch {} }
      const row = buildRow({ key, me, prof, prefs, mode: s.mode, setKey: s.setKey, dev: s.device, st: s.st, isPublic: p.isPublic, avatarUrl: mp?.avatar_url, bc: s.bc, flagged: repeat });
      if (repeat) row.diag.repeat = true;
      const saved = await saveRow(row);
      const pct = repeat ? null : await percentile(s.mode === "bc" ? "normal" : s.mode, s.mode === "daily" ? s.setKey : null, row.total);
      s.finished = { id: saved, result: publicRow(row, { owner: true }), pct, repeat };
      if (s.bc) {
        const b = await loadBc(s.bc);
        if (b && b.row.status !== "final" && s.createdAt <= new Date(b.row.closes_at).getTime() && now() <= bcUntil(b) && !b.entries.has(key)) {
          const isStreamer = b.row.owner_key === key;
          const e = { bc_id: b.row.id, owner_key: key, user_id: me.isGuest ? null : me.id, result_id: saved, nickname: s.bcNick || prof.nick, show_name: s.bcShow || isStreamer, is_member: !me.isGuest, is_streamer: isStreamer, device: s.device, total: row.total, level: row.level, type_id: row.type_id, games: row.diag.games, flagged: !!s.preview, created_at: new Date().toISOString() };
          b.entries.set(key, e); let ok = true;
          if (SB) { const { error } = await SB.from("nc_bc_entries").insert(e); if (error && String(error.code) !== "23505") { b.entries.delete(key); ok = false; console.error("[nc bc] entry", error.message); } }
          b.playing.delete(key); b.feed.push({ nick: e.show_name ? e.nickname : "익명", total: e.total, level: e.level, typeId: e.type_id, at: now() }); if (b.feed.length > 40) b.feed.shift(); bcDirty(b);
          s.finished.bc = { id: b.row.id, counted: ok && !isStreamer && !s.preview, streamer: isStreamer, preview: !!s.preview };
        } else s.finished.bc = { id: s.bc, counted: false };
      }
      reply({ ok: true, ...s.finished });
    });
    on("nc:history", async (_p, reply) => { if (!SB) return reply({ ok: true, rows: [] }); const { data } = await SB.from("nc_results").select("id, mode, total, level, type_id, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(30); reply({ ok: true, rows: data || [] }); });
    on("nc:tr", (p, reply) => { const L = p.lang === "ja" || p.lang === "en" ? p.lang : "ko"; reply({ ok: true, list: (Array.isArray(p.list) ? p.list : []).slice(0, 60).map((x) => trStr(String(x ?? "").slice(0, 300), L)) }); }, 30);

    // ----- 친구 대결 -----
    // 새 소켓(재연결)이면 내가 들어 있던 진행 중 방을 찾아 자동으로 다시 붙임 — 답이 NO_ROOM으로 버려지지 않게
    const myRoom = () => { const r = ROOMS.get(socket.data.ncRoom || ""); if (r && r.players.has(key)) return r;
      let best = null; for (const x of ROOMS.values()) if (x.phase !== "over" && x.phase !== "lobby" && x.players.has(key) && (!best || x.touched > best.touched)) best = x;
      if (!best) return null; const pl = best.players.get(key); pl.sid = socket.id; pl.connected = true; socket.join(`ncm:${best.code}`); socket.data.ncRoom = best.code; return best; };
    const leavePrev = (code) => { const o = ROOMS.get(socket.data.ncRoom || ""); if (!o || o.code === code) return; socket.leave(`ncm:${o.code}`); const pl = o.players.get(key); if (pl && pl.sid === socket.id) { if (o.phase === "lobby") { o.players.delete(key); if (o.hostKey === key) { const nx = o.players.values().next().value; if (nx) { o.hostKey = nx.key; o.hostNick = nx.nick; } else { ROOMS.delete(o.code); return; } } } else { pl.connected = false; if (o.phase === "q" && allIn(o)) resolve(o); } emitRoom(o); } };
    const joinRoom = (r, lang) => { leavePrev(r.code); const pl = r.players.get(key); pl.sid = socket.id; pl.connected = true; pl.lang = lang; socket.join(`ncm:${r.code}`); socket.data.ncRoom = r.code; emitRoom(r); emitYou(r, pl); };
    const newPlayer = (prof, mp, p, r) => ({ key, me, nick: prof.nick, avatar: prof.avatar, avatarUrl: mp?.avatar_url || null, dev: device(p.device), pts: 0, chips: C.BLUFF_START, st: C.newRun(1), ans: null });
    on("ncm:create", async (p, reply, lang) => {
      if (ROOMS.size >= MAX_ROOMS) return reply({ ok: false, error: "TOO_MANY_ROOMS" });
      const prof = sanitizeProfile(p.profile); if (!prof) return reply({ ok: false, error: "BAD_PROFILE" });
      const mp = await memberProfile(SB, me); if (mp?.nickname) prof.nick = String(mp.nickname).slice(0, 12);
      let code; do code = roomCode(); while (ROOMS.has(code));
      const pickG = Array.isArray(p.games) ? C.GAMES.filter((g) => p.games.includes(g)) : C.GAMES;
      const r = { code, hostKey: key, hostNick: prof.nick, rs: newSeed(), phase: "lobby", g: null, k: 0, players: new Map(), timer: null, deadline: null, created: now(), touched: now(), games: (pickG.length ? pickG : C.GAMES).map((g) => ({ g, n: M_PLAN[g], ic: C.GAME_INFO[g].ic, name: C.GAME_INFO[g].n })), ranking: null };
      r.players.set(key, newPlayer(prof, mp, p, r));
      ROOMS.set(code, r); joinRoom(r, lang); reply({ ok: true, code });
    }, 20);
    on("ncm:join", async (p, reply, lang) => {
      const r = ROOMS.get(String(p.code || "").toUpperCase().slice(0, 8)); if (!r) return reply({ ok: false, error: "NO_ROOM" });
      if (!r.players.has(key)) {
        if (r.phase !== "lobby") return reply({ ok: false, error: "ALREADY_STARTED" });
        if (r.players.size >= 8) return reply({ ok: false, error: "ROOM_FULL" });
        const prof = sanitizeProfile(p.profile); if (!prof) return reply({ ok: false, error: "BAD_PROFILE" });
        const mp = await memberProfile(SB, me); if (mp?.nickname) prof.nick = String(mp.nickname).slice(0, 12);
        let nick = prof.nick; const used = new Set(roomPlayers(r).map((x) => x.nick)); for (let i = 2; used.has(nick); i++) nick = `${prof.nick.slice(0, 10)}${i}`;
        prof.nick = nick; r.players.set(key, newPlayer(prof, mp, p, r));
      }
      joinRoom(r, lang); reply({ ok: true, code: r.code });
    }, 20);
    on("ncm:start", (p, reply) => {
      const r = myRoom(); if (!r) return reply({ ok: false, error: "NO_ROOM" });
      if (r.hostKey !== key) return reply({ ok: false, error: "NOT_HOST" });
      if (r.phase !== "lobby") return reply({ ok: false, error: "ALREADY_STARTED" });
      if (r.players.size < 2) return reply({ ok: false, error: "NEED_2" });
      reply({ ok: true }); r.g = null; nextRound(r);
    }, 20);
    on("ncm:act", (p, reply) => { const r = myRoom(); const pl = r?.players.get(key); if (!r || !pl) return reply({ ok: false, error: "NO_ROOM" }); reply(answer(r, pl, p.a || {})); }, 60);
    on("ncm:leave", (p, reply) => { const r = myRoom(); if (!r) return reply({ ok: true }); socket.leave(`ncm:${r.code}`); socket.data.ncRoom = null; if (r.phase === "lobby") { r.players.delete(key); if (r.hostKey === key) { const nx = r.players.values().next().value; if (nx) { r.hostKey = nx.key; r.hostNick = nx.nick; } else { ROOMS.delete(r.code); return reply({ ok: true }); } } } else { const pl = r.players.get(key); if (pl) pl.connected = false; if (r.phase === "q" && allIn(r)) resolve(r); } emitRoom(r); reply({ ok: true }); });
    socket.on("disconnect", () => { const r = ROOMS.get(socket.data.ncRoom || ""); const pl = r?.players.get(key); if (pl && pl.sid === socket.id) { pl.connected = false; if (r.phase === "q" && allIn(r)) { try { resolve(r); } catch (e) { console.error("[ncm] dc", e); } } if (r.phase === "lobby") { const sid0 = socket.id; setTimeout(() => { const cur = r.players.get(key); if (!cur || cur.connected || cur.sid !== sid0 || r.phase !== "lobby" || ROOMS.get(r.code) !== r) return; r.players.delete(key); if (r.hostKey === key) { const nx = r.players.values().next().value; if (nx) { r.hostKey = nx.key; r.hostNick = nx.nick; } else { ROOMS.delete(r.code); return; } } emitRoom(r); }, LOBBY_GRACE).unref?.(); } emitRoom(r); } });   // 대기실에서 잠깐 끊긴 건 20초 기다려 줌 (예전엔 바로 빠져서 혼자 있던 방장의 방이 사라졌음)

    // ----- 방송 진단소 -----
    on("nc:bc:create", async (p, reply) => {
      if (!SB) return reply({ ok: false, error: "NO_DB" });
      if (me.isGuest) { if (!clean(p.streamerNick, 16)) return reply({ ok: false, error: "NEED_NICK" }); const ip = sockIp(socket), arr = (ipMakes.get(ip) || []).filter((t) => now() - t < GUEST_IP_WIN); if (arr.length >= GUEST_IP_MAX) return reply({ ok: false, error: "RATE_LIMITED" }); ipMakes.set(ip, arr); }
      const mins = Math.min(BC_MAX_MIN, Math.max(5, Math.round(Number(p.minutes) || 40)));
      const mp = !me.isGuest ? await memberProfile(SB, me) : null;
      const nick = clean(p.streamerNick, 16) || clean(mp?.nickname, 16) || "스트리머", title = clean(p.title, 40) || `${nick} 방송 눈치 대결`;
      const { count } = await SB.from("nc_broadcasts").select("id", { count: "exact", head: true }).eq("owner_key", key).eq("status", "open").gt("closes_at", new Date().toISOString());
      if ((count || 0) >= (me.isGuest ? GUEST_MAX_OPEN : MEMBER_MAX_OPEN)) return reply({ ok: false, error: "TOO_MANY_OPEN" });
      const row = { id: idNew(), owner_key: key, user_id: me.isGuest ? null : me.id, title, streamer_nick: nick, avatar_url: mp?.avatar_url || null, seed: newSeed(), core_ver: C.CORE_VERSION, status: "open", closes_at: new Date(now() + mins * 60000).toISOString(), created_at: new Date().toISOString() };
      const { error } = await SB.from("nc_broadcasts").insert(row);
      if (error) { console.error("[nc bc] create", error.message); return reply({ ok: false, error: "SAVE_FAIL" }); }
      if (me.isGuest) { const ip = sockIp(socket); ipMakes.set(ip, [...(ipMakes.get(ip) || []), now()]); if (ipMakes.size > 5000) ipMakes.clear(); }
      SB.from("streamer_chat_log").insert({ platform: "nunchi", channel_id: row.id, nickname: nick, content_id: null, content_title: title, content_mode: null, room_code: row.id, host_user_id: me.isGuest ? null : me.id, host_nick: me.isGuest ? null : (mp?.nickname || null) }).then(({ error: le }) => { if (le) console.error("[nc bc] streamer log", le.message); }, () => {});
      BC.set(row.id, newBc(row));
      reply({ ok: true, bc: { id: row.id, title, streamer_nick: nick, closes_at: row.closes_at } });
    }, 20);
    on("nc:bc:mine", async (_p, reply) => { if (!SB) return reply({ ok: true, rows: [] }); const { data } = await SB.from("nc_broadcasts").select("id, title, status, closes_at, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(20); reply({ ok: true, rows: data || [] }); });
    on("nc:bc:watch", async (p, reply) => { const b = await loadBc(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); await bcFinalize(b); socket.join(`nc:bc:${b.row.id}`); const pred = b.preds.get(key) || null; reply({ ok: true, stats: bcGet(b), owner: b.row.owner_key === key, myGuess: pred ? Number(pred.guess) : null }); });
    on("nc:bc:predict", async (p, reply) => {
      const b = await loadBc(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); if (!bcOpen(b)) return reply({ ok: false, error: "BC_CLOSED" }); if (b.preds.has(key)) return reply({ ok: false, error: "ALREADY" });
      const guess = Math.round(Number(p.guess) * 10) / 10; if (!(guess >= 0 && guess <= 100)) return reply({ ok: false, error: "BAD_GUESS" });
      const mp = !me.isGuest ? await memberProfile(SB, me) : null;
      const x = { bc_id: b.row.id, owner_key: key, nickname: clean(mp?.nickname || p.nick, 12) || "시청자", guess, created_at: new Date().toISOString() };
      b.preds.set(key, x); if (SB) { const { error } = await SB.from("nc_bc_predictions").insert(x); if (error && String(error.code) !== "23505") { b.preds.delete(key); return reply({ ok: false, error: "SAVE_FAIL" }); } }
      bcDirty(b); reply({ ok: true, guess });
    }, 20);
    on("nc:bc:control", async (p, reply) => {
      const b = await loadBc(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); if (b.row.owner_key !== key) return reply({ ok: false, error: "NOT_OWNER" }); if (b.row.status === "final") return reply({ ok: false, error: "BC_FINAL" });
      if (p.action === "extend") { const mins = Math.min(BC_MAX_MIN, Math.max(1, Math.round(Number(p.minutes) || 10))); b.row.closes_at = new Date(Math.max(now(), new Date(b.row.closes_at).getTime()) + mins * 60000).toISOString(); if (SB) await SB.from("nc_broadcasts").update({ closes_at: b.row.closes_at }).eq("id", b.row.id); }
      else if (p.action === "close") { b.row.closes_at = new Date(Math.min(now(), new Date(b.row.closes_at).getTime())).toISOString(); if (SB) await SB.from("nc_broadcasts").update({ closes_at: b.row.closes_at }).eq("id", b.row.id); }
      else if (p.action === "finalize") { if (bcOpen(b)) return reply({ ok: false, error: "STILL_OPEN" }); await bcFinalize(b, true); }
      else return reply({ ok: false, error: "BAD_ACTION" });
      bcDirty(b); reply({ ok: true, stats: bcGet(b) });
    }, 20);
  });

  if (!app) return;
  const isMine = async (req, row) => { const user = getOptionalUser ? await getOptionalUser(req) : null; const g = String(req.headers["x-nc-guest"] || ""); return (user && row.owner_key === `u:${user.id}`) || (g.startsWith("guest_") && row.owner_key === `g:${g}`); };
  app.get("/nc/result/:id", async (req, res) => {
    try { if (!SB) return res.status(503).json({ ok: false, error: "NO_DB" }); const { data: row, error } = await SB.from("nc_results").select("*").eq("id", String(req.params.id || "").slice(0, 16)).maybeSingle(); if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" }); if (!row) return res.status(404).json({ ok: false, error: "NOT_FOUND" }); const mine = await isMine(req, row); if (!row.is_public && !mine) return res.status(403).json({ ok: false, error: "PRIVATE" }); res.json(tx({ ok: true, result: publicRow(row, { owner: mine }) }, req.query.lang)); }
    catch (e) { console.error("[nc/result]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  const rankCache = new Map();
  app.get("/nc/ranking", async (req, res) => {
    try {
      if (!SB) return res.json({ ok: true, rows: [] });
      const mode = ["daily", "multi"].includes(req.query.mode) ? req.query.mode : "normal", board = req.query.board === "streamer" ? "streamer" : "all";
      const setKey = mode === "daily" ? (/^\d{4}-\d\d-\d\d$/.test(req.query.set || "") ? req.query.set : C.dayKey()) : null;
      const ck = JSON.stringify([mode, board, setKey]); const hit = rankCache.get(ck); if (hit && now() - hit.at < 30000) return res.json(tx(hit.body, req.query.lang));
      let q = SB.from("nc_results").select("id, owner_key, user_id, nickname, avatar, total, level, type_id, is_streamer").eq("mode", mode).eq("is_public", true).eq("flagged", false);
      if (setKey) q = q.eq("set_key", setKey); if (board === "streamer") q = q.eq("is_streamer", true);
      const { data, error } = await q.order("total", { ascending: false }).limit(500); if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
      const seen = new Set(), rows = []; for (const r of data || []) { if (seen.has(r.owner_key)) continue; seen.add(r.owner_key); rows.push({ id: r.id, nick: r.nickname, avatar: r.avatar, total: r.total, level: r.level, typeId: r.type_id, type: C.TYPES[r.type_id]?.n || "", ic: C.TYPES[r.type_id]?.ic || "", isGuest: !r.user_id, streamer: !!r.is_streamer }); if (rows.length >= 50) break; }
      const body = { ok: true, mode, board, setKey, rows }; rankCache.set(ck, { at: now(), body }); if (rankCache.size > 100) rankCache.clear(); res.json(tx(body, req.query.lang));
    } catch (e) { console.error("[nc/ranking]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  app.get("/nc/bc/:id", async (req, res) => { try { const b = await loadBc(req.params.id); if (!b) return res.status(404).json({ ok: false, error: "BC_NOT_FOUND" }); await bcFinalize(b); res.json({ ok: true, stats: bcGet(b) }); } catch (e) { res.status(500).json({ ok: false, error: "INTERNAL" }); } });
}
export const _ncTest = { SESS, BC, ROOMS, CROWD };
