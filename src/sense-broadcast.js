// =========================
// 플듀 게임 센스 진단소 — 스트리머 모드 「우리 방송 시청자 평균 게임 센스는?」 (sbc:* 소켓 + /sense/bc/* REST)
// - 스트리머가 방송 진단소를 만들고, 시청자는 링크 하나(sense-streamer.html?bc=ID)로 현황을 보고 「나도 검사하기」로 참여
// - 시청자마다 같은 구성·같은 채점 버전이지만 문제(시드)는 다름 → 채팅으로 답을 알려 줄 수 없음
// - 서버가 채점한 결과만 집계, 한 사람당 첫 완료 기록 1개, 통계는 2초 묶음으로 다시 계산해 방(room)에 한 번만 보냄 (수백 명 대비)
// - 마감 후 확정 보관 → 방송 끝 요약
// DB: sense_broadcasts / sense_bc_entries (sql/sense_tables.sql)
// 구조는 IQ 진단소 방송(iq-broadcast.js)과 같음
// =========================
import * as C from "./sense-core.js";
import { setSenseHooks } from "./sense.js";

const BC = new Map(), REST_CACHE = new Map();
const STATS_MS = 2000, GRACE_MS = 25 * 60 * 1000, MAX_DEADLINE_MIN = 24 * 60, MIN_BATTLE = 10;
const GUEST_MAX_OPEN = 1, MEMBER_MAX_OPEN = 3, GUEST_IP_WIN = 10 * 60 * 1000, PLAY_TTL = 5 * 60 * 1000;
const GUEST_IP_MAX = () => Number(process.env.SENSE_BC_IP_MAX || 5);
const ipMakes = new Map();
function sockIp(socket) { const h = socket.handshake?.headers || {}; const cf = String(h["cf-connecting-ip"] || "").trim(); if (cf) return cf; const xff = String(h["x-forwarded-for"] || "").split(",").map((x) => x.trim()).filter(Boolean); if (xff.length) return xff[0]; return String(socket.handshake?.address || "").replace(/^::ffff:/, ""); }
const now = () => Date.now();
function bcId() { const a = "abcdefghijkmnpqrstuvwxyz23456789"; let s = ""; for (let i = 0; i < 8; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
let SB = null, IO = null;
const room = (id) => `sbc:${id}`;

async function loadBc(id) {
  id = String(id || "").slice(0, 16);
  if (BC.has(id)) return BC.get(id);
  if (!SB) return null;
  const { data: row } = await SB.from("sense_broadcasts").select("*").eq("id", id).maybeSingle();
  if (!row) return null;
  const { data: ents } = await SB.from("sense_bc_entries").select("*").eq("bc_id", id).limit(20000);
  const b = { row, entries: new Map((ents || []).map((e) => [e.owner_key, e])), stats: null, dirty: true, at: 0, timer: null };
  BC.set(id, b);
  if (BC.size > 300) { const old = [...BC.entries()].sort((a, c) => a[1].at - c[1].at)[0]; if (old) BC.delete(old[0]); }
  return b;
}
const isOpen = (b) => b.row.status === "open" && now() < new Date(b.row.closes_at).getTime();
const TIER_ORDER = C.TIERS.map((t) => t.id).reverse();   // 아이언(0) → 챌린저(9)
const acceptsUntil = (b) => new Date(b.row.closes_at).getTime() + GRACE_MS;

export function computeStats(b) {
  const all = [...b.entries.values()], valid = all.filter((e) => !e.flagged && !e.is_streamer), tot = valid.map((e) => e.total);
  const streamer = all.find((e) => e.is_streamer) || null, name = (e) => (e.show_name ? e.nickname : "익명 시청자");
  const sorted = [...valid].sort((x, y) => y.total - x.total || new Date(x.created_at) - new Date(y.created_at));
  const perArea = {}; for (const a of C.AREAS) perArea[a] = r1(avg(valid.map((e) => e.areas?.[a]).filter(Number.isFinite)));
  const kings = {};
  for (const a of C.AREAS) { let best = null; for (const e of valid) { const v = e.areas?.[a]; if (!Number.isFinite(v)) continue; if (!best || v > best.v || (v === best.v && new Date(e.created_at) < new Date(best.at))) best = { v, nick: name(e), anon: !e.show_name, at: e.created_at }; } if (best && best.v > 0) kings[a] = { score: best.v, nick: best.nick, anon: best.anon }; }
  const tiers = Object.fromEntries(C.TIERS.map((t) => [t.id, 0])); for (const e of valid) tiers[C.tierOf(e.total).id]++;
  const hist = Array(10).fill(0); for (const v of tot) hist[Math.min(9, Math.floor(v / 100))]++;
  const styles = {}; for (const e of valid) if (e.style) styles[e.style] = (styles[e.style] || 0) + 1;
  const avgT = avg(tot);
  const s = {
    id: b.row.id, title: b.row.title, streamer: b.row.streamer_nick, avatarUrl: b.row.avatar_url || null, mode: b.row.mode, setVer: b.row.set_ver,
    status: b.row.status, closesAt: b.row.closes_at, open: isOpen(b), settings: b.row.settings || {},
    count: valid.length, flaggedCount: all.filter((e) => e.flagged).length, device: { pc: valid.filter((e) => e.device === "pc").length, mobile: valid.filter((e) => e.device === "mobile").length },
    avgTotal: r1(avgT), medianTotal: median(tot), topTotal: tot.length ? Math.max(...tot) : null, bottomTotal: tot.length ? Math.min(...tot) : null, paused: !!b.row.settings?.paused, revealAt: b.row.settings?.revealAt || null, avgTier: avgT == null ? null : C.tierOf(Math.round(avgT)).id,
    perArea, kings, tiers, hist, styleTop: Object.entries(styles).sort((a, b2) => b2[1] - a[1]).slice(0, 3).map(([id, n]) => ({ id, n })),
    top10: sorted.slice(0, 10).map((e, i) => ({ rank: i + 1, nick: name(e), anon: !e.show_name, total: e.total, tier: C.tierOf(e.total).id, style: e.style, device: e.device, member: !!e.is_member })),
    streamerScore: streamer ? { total: streamer.total, tier: C.tierOf(streamer.total).id, areas: streamer.areas, style: streamer.style } : null,
    beatStreamer: streamer && valid.length ? Math.round((valid.filter((e) => e.total > streamer.total).length / valid.length) * 100) : null,
    updatedAt: new Date().toISOString(),
  };
  // 평균 티어 예측 (진행자가 시작 전에): 결과는 끝난 뒤에만 비교 공개
  const pr = b.row.settings?.predict || null; s.predict = pr;
  if (pr && b.row.status === "final" && s.avgTier) { const d = TIER_ORDER.indexOf(s.avgTier) - TIER_ORDER.indexOf(pr); s.predictResult = { hit: d === 0, diff: d }; }
  if (s.streamerScore && s.avgTotal != null) s.streamerVsViewers = { streamer: s.streamerScore.total, viewers: s.avgTotal, win: s.streamerScore.total > s.avgTotal };
  const play = [...(b.playing?.values() || [])].filter((x) => now() - x.at < PLAY_TTL).sort((x, y) => y.done - x.done || x.since - y.since);
  s.playing = b.row.status === "final" ? 0 : play.length;
  s.playingList = b.row.status === "final" ? [] : play.slice(0, 60).map((x) => ({ nick: x.streamer || x.showName ? x.nick : "익명 시청자", done: x.done || 0, total: x.total, device: x.device, streamer: !!x.streamer }));
  return s;
}
function markDirty(b) {
  b.dirty = true; REST_CACHE.delete(b.row.id);
  if (b.timer) return;
  b.timer = setTimeout(() => { b.timer = null; b.stats = computeStats(b); b.dirty = false; b.at = now(); IO?.to(room(b.row.id)).emit("sbc:stats", b.stats); }, Math.max(0, STATS_MS - (now() - b.at)));
}
function getStats(b) {
  if (b.row.final_stats) return b.row.final_stats;
  const stale = b.stats && (b.stats.open !== isOpen(b) || b.stats.closesAt !== b.row.closes_at || b.stats.status !== b.row.status);
  if (!b.stats || stale || (b.dirty && now() - b.at > STATS_MS)) { b.stats = computeStats(b); b.dirty = false; b.at = now(); }
  return b.stats;
}

// ---------- sense.js 검사 흐름에 거는 고리 ----------
async function onBegin(id, mode) {
  const b = await loadBc(id); if (!b) return { ok: false, error: "BC_NOT_FOUND" };
  if (b.row.status === "wait") return { ok: false, error: "BC_WAIT" };
  if (!isOpen(b)) return { ok: false, error: "BC_CLOSED" };
  if (b.row.settings?.paused) return { ok: false, error: "BC_PAUSED" };
  if (mode !== b.row.mode) return { ok: false, error: "BC_MODE" };
  if (b.row.set_ver !== C.SET_VERSION) return { ok: false, error: "BC_VERSION" };
  return { ok: true, bc: b.row.id };
}
function onPlay(id, key, info) {
  const b = BC.get(String(id || "")); if (!b || b.row.status === "final") return;
  b.playing ||= new Map(); const cur = b.playing.get(key);
  const x = { since: cur?.since || now(), ...cur, ...info, at: now(), streamer: b.row.owner_key === key };
  x.nick = String(x.nick || "시청자").replace(/[<>]/g, "").slice(0, 12) || "시청자";
  b.playing.set(key, x);
  if (b.playing.size > 3000) { const old = [...b.playing.entries()].sort((p, q) => p[1].at - q[1].at)[0]; if (old) b.playing.delete(old[0]); }
  markDirty(b);
}
function onEnd(id, key) { const b = BC.get(String(id || "")); if (b?.playing?.delete(key)) markDirty(b); }
async function onFinish(id, { key, me, row, sessStarted, showName }) {
  const b = await loadBc(id); if (!b) return { counted: false, reason: "BC_NOT_FOUND" };
  if (b.row.status === "final") return { counted: false, reason: "BC_FINAL" };
  if (sessStarted > new Date(b.row.closes_at).getTime() || now() > acceptsUntil(b)) return { counted: false, reason: "BC_CLOSED" };
  if (b.entries.has(key)) return { counted: false, reason: "ALREADY", first: true };
  const isStreamer = b.row.owner_key === key;
  const e = { bc_id: b.row.id, owner_key: key, user_id: me.isGuest ? null : me.id, result_id: row.id, nickname: row.nickname, show_name: showName !== false, is_member: !me.isGuest, is_streamer: isStreamer, device: row.device, total: row.total, tier: row.tier, style: row.style, areas: row.areas, flagged: !!row.flagged, created_at: new Date().toISOString() };
  b.entries.set(key, e);
  if (SB) { const { error } = await SB.from("sense_bc_entries").insert(e); if (error && String(error.code) !== "23505") { b.entries.delete(key); console.error("[sense bc] entry", error.message); return { counted: false, reason: "SAVE_FAIL" }; } }
  markDirty(b);
  const rank = [...b.entries.values()].filter((x) => !x.flagged && !x.is_streamer && x.total > e.total).length + 1;
  return { counted: !e.flagged && !isStreamer, streamer: isStreamer, flagged: e.flagged, rank };
}
async function finalizeIfDue(b, force = false) {
  if (b.row.status === "final") return;
  if (b.row.status === "wait" && !force) { if (now() - new Date(b.row.created_at).getTime() > MAX_DEADLINE_MIN * 60000) force = true; else return; }   // 하루 넘게 시작 안 한 방송은 정리
  if (!force && now() < acceptsUntil(b)) return;
  b.row.status = "final";
  const stats = computeStats(b); stats.status = "final"; stats.open = false; stats.finalAt = new Date().toISOString();
  b.row.final_stats = stats; REST_CACHE.delete(b.row.id);
  if (SB) await SB.from("sense_broadcasts").update({ status: "final", final_stats: stats, finalized_at: stats.finalAt }).eq("id", b.row.id);
  IO?.to(room(b.row.id)).emit("sbc:stats", stats);
}

export function registerSenseBroadcast(io, supabaseAdmin, app, { memberProfile } = {}) {
  SB = supabaseAdmin; IO = io;
  setSenseHooks({ begin: onBegin, play: onPlay, finish: onFinish, end: onEnd });
  setInterval(() => { for (const b of BC.values()) { finalizeIfDue(b).catch(() => {}); if (b.playing) { let gone = false; for (const [k, x] of b.playing) if (now() - x.at >= PLAY_TTL) { b.playing.delete(k); gone = true; } if (gone) markDirty(b); } } }, 30000).unref?.();

  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const key = me.isGuest ? `g:${me.id}` : `u:${me.id}`;
    let win = now(), cnt = 0;
    const on = (ev, fn) => socket.on(ev, async (p, cb) => { const reply = typeof cb === "function" ? cb : () => {}; const n = now(); if (n - win > 10000) { win = n; cnt = 0; } if (++cnt > Number(process.env.SENSE_RL || 30)) return reply({ ok: false, error: "RATE_LIMITED" }); try { await fn(p || {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); } });

    on("sbc:create", async (p, reply) => {
      if (!SB) return reply({ ok: false, error: "NO_DB" });
      if (me.isGuest) { if (!String(p.streamerNick || "").replace(/[<>]/g, "").trim()) return reply({ ok: false, error: "NEED_NICK" }); const ip = sockIp(socket), n = now(); const arr = (ipMakes.get(ip) || []).filter((t) => n - t < GUEST_IP_WIN); if (arr.length >= GUEST_IP_MAX()) return reply({ ok: false, error: "RATE_LIMITED" }); ipMakes.set(ip, arr); }
      const mode = p.mode === "full" ? "full" : "quick";
      const mins = Math.min(MAX_DEADLINE_MIN, Math.max(5, Math.round(Number(p.minutes) || 30)));
      const mp = !me.isGuest && memberProfile ? await memberProfile(SB, me) : null;
      const nick = String(String(p.streamerNick || "").trim() || mp?.nickname || "스트리머").replace(/[<>]/g, "").trim().slice(0, 16) || "스트리머";
      const title = String(p.title || `${nick} 방송 게임 센스 진단소`).replace(/[<>]/g, "").trim().slice(0, 40) || `${nick} 방송 게임 센스 진단소`;
      const { count } = await SB.from("sense_broadcasts").select("id", { count: "exact", head: true }).eq("owner_key", key).eq("status", "open").gt("closes_at", new Date().toISOString());
      if ((count || 0) >= (me.isGuest ? GUEST_MAX_OPEN : MEMBER_MAX_OPEN)) return reply({ ok: false, error: "TOO_MANY_OPEN", max: me.isGuest ? GUEST_MAX_OPEN : MEMBER_MAX_OPEN });
      const settings = { hideNicks: !!p.hideNicks, minutes: mins };
      const startNow = p.startNow !== false && p.startNow !== 0 && p.wait !== true;
      const row = { id: bcId(), owner_key: key, user_id: me.isGuest ? null : me.id, title, streamer_nick: nick, avatar_url: mp?.avatar_url || null, mode, set_ver: C.SET_VERSION, status: startNow ? "open" : "wait", closes_at: new Date(now() + (startNow ? mins : MAX_DEADLINE_MIN) * 60000).toISOString(), settings, created_at: new Date().toISOString() };
      const { error } = await SB.from("sense_broadcasts").insert(row);
      if (error) { console.error("[sense bc] create", error.message); return reply({ ok: false, error: "SAVE_FAIL" }); }
      if (me.isGuest) { const ip = sockIp(socket); ipMakes.set(ip, [...(ipMakes.get(ip) || []), now()]); if (ipMakes.size > 5000) ipMakes.clear(); }
      // admin 「📺 스트리머」 목록 — 게임센스
      SB.from("streamer_chat_log").insert({ platform: "sense", channel_id: row.id, nickname: nick, content_id: null, content_title: title, content_mode: null, room_code: row.id, host_user_id: me.isGuest ? null : me.id, host_nick: me.isGuest ? null : mp?.nickname || null }).then(({ error: le }) => { if (le) console.error("[sense bc] streamer log", le.message); }, () => {});
      BC.set(row.id, { row, entries: new Map(), stats: null, dirty: true, at: 0, timer: null });
      reply({ ok: true, bc: row });
    });
    on("sbc:mine", async (_p, reply) => { if (!SB) return reply({ ok: true, rows: [] }); const { data } = await SB.from("sense_broadcasts").select("id, title, mode, status, closes_at, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(20); reply({ ok: true, rows: data || [] }); });
    on("sbc:watch", async (p, reply) => {
      const b = await loadBc(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" });
      await finalizeIfDue(b); socket.join(room(b.row.id));
      const mine = b.entries.get(key) || null;
      reply({ ok: true, stats: getStats(b), owner: b.row.owner_key === key, mine: mine ? { total: mine.total, tier: mine.tier, flagged: mine.flagged, streamer: mine.is_streamer, resultId: mine.result_id } : null });
    });
    on("sbc:control", async (p, reply) => {
      const b = await loadBc(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" });
      if (b.row.owner_key !== key) return reply({ ok: false, error: "NOT_OWNER" });
      if (p.action === "reveal") { if (b.row.status !== "final") return reply({ ok: false, error: "NOT_FINAL" }); const at = new Date().toISOString(); b.row.settings = { ...(b.row.settings || {}), revealAt: at }; if (b.row.final_stats) b.row.final_stats = { ...b.row.final_stats, revealAt: at }; if (SB) await SB.from("sense_broadcasts").update({ settings: b.row.settings, final_stats: b.row.final_stats }).eq("id", b.row.id); REST_CACHE.delete(b.row.id); IO?.to(room(b.row.id)).emit("sbc:reveal", { at }); IO?.to(room(b.row.id)).emit("sbc:stats", getStats(b)); return reply({ ok: true, stats: getStats(b) }); }
      if (b.row.status === "final") return reply({ ok: false, error: "BC_FINAL" });
      if (p.action === "extend") { const mins = Math.min(MAX_DEADLINE_MIN, Math.max(1, Math.round(Number(p.minutes) || 10))); b.row.closes_at = new Date(Math.max(now(), new Date(b.row.closes_at).getTime()) + mins * 60000).toISOString(); if (SB) await SB.from("sense_broadcasts").update({ closes_at: b.row.closes_at }).eq("id", b.row.id); }
      else if (p.action === "close") { b.row.closes_at = new Date(Math.min(now(), new Date(b.row.closes_at).getTime())).toISOString(); if (SB) await SB.from("sense_broadcasts").update({ closes_at: b.row.closes_at }).eq("id", b.row.id); }
      else if (p.action === "finalize") { if (isOpen(b)) return reply({ ok: false, error: "STILL_OPEN" }); await finalizeIfDue(b, true); }
      else if (p.action === "start") { if (b.row.status !== "wait") return reply({ ok: false, error: "NOT_WAITING" }); b.row.status = "open"; b.row.closes_at = new Date(now() + (b.row.settings?.minutes || 30) * 60000).toISOString(); if (SB) await SB.from("sense_broadcasts").update({ status: "open", closes_at: b.row.closes_at }).eq("id", b.row.id); IO?.to(room(b.row.id)).emit("sbc:start", { id: b.row.id }); }
      else if (p.action === "pause" || p.action === "resume") { if (b.row.status !== "open") return reply({ ok: false, error: "NOT_OPEN" }); b.row.settings = { ...(b.row.settings || {}), paused: p.action === "pause" }; if (SB) await SB.from("sense_broadcasts").update({ settings: b.row.settings }).eq("id", b.row.id); }
      else if (p.action === "predict") { if (b.row.status !== "wait") return reply({ ok: false, error: "PREDICT_BEFORE_START" }); if (!TIER_ORDER.includes(p.tier)) return reply({ ok: false, error: "BAD_TIER" }); b.row.settings = { ...(b.row.settings || {}), predict: p.tier }; if (SB) await SB.from("sense_broadcasts").update({ settings: b.row.settings }).eq("id", b.row.id); }
      else if (p.action === "settings") { b.row.settings = { ...(b.row.settings || {}), hideNicks: !!p.hideNicks }; if (SB) await SB.from("sense_broadcasts").update({ settings: b.row.settings }).eq("id", b.row.id); }
      else return reply({ ok: false, error: "BAD_ACTION" });
      markDirty(b); reply({ ok: true, stats: getStats(b) });
    });
  });

  if (!app) return;
  app.get("/sense/bc/:id", async (req, res) => {
    try {
      const id = String(req.params.id || "").slice(0, 16); const c = REST_CACHE.get(id); if (c && now() - c.at < 1500) return res.json(c.body);
      const b = await loadBc(id); if (!b) return res.status(404).json({ ok: false, error: "BC_NOT_FOUND" });
      await finalizeIfDue(b); const body = { ok: true, stats: getStats(b) };
      REST_CACHE.set(id, { at: now(), body }); if (REST_CACHE.size > 500) REST_CACHE.clear(); res.json(body);
    } catch (e) { console.error("[sense bc/get]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  // 시청자 순위 더보기 (TOP 10 다음부터 50명씩, 최대 1000위)
  app.get("/sense/bc/:id/rank", async (req, res) => {
    try {
      const id = String(req.params.id || "").slice(0, 16), from = Math.max(0, Math.min(1000, parseInt(req.query.from, 10) || 0)), n = Math.max(1, Math.min(50, parseInt(req.query.n, 10) || 50));
      const b = await loadBc(id); if (!b) return res.status(404).json({ ok: false, error: "BC_NOT_FOUND" });
      if (!b.rankCache || b.rankCache.at < b.at || now() - b.rankCache.at > 3000) b.rankCache = { at: now(), list: [...b.entries.values()].filter((e) => !e.flagged && !e.is_streamer).sort((x, y) => y.total - x.total || new Date(x.created_at) - new Date(y.created_at)) };
      const list = b.rankCache.list, end = Math.min(list.length, from + n, 1000), rows = [];
      for (let i = from; i < end; i++) { const e = list[i]; rows.push({ rank: i + 1, nick: e.show_name ? e.nickname : "익명 시청자", anon: !e.show_name, total: e.total, tier: C.tierOf(e.total).id, style: e.style, device: e.device }); }
      res.json({ ok: true, total: list.length, from, rows, more: end < Math.min(list.length, 1000) });
    } catch (e) { console.error("[sense bc/rank]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  // 방송 대항전 랭킹 (확정된 방송, 같은 모드·버전, 참여 10명 이상)
  app.get("/sense/bc-ranking", async (req, res) => {
    try {
      const mode = req.query.mode === "full" ? "full" : "quick";
      const { data, error } = await SB.from("sense_broadcasts").select("id, title, streamer_nick, mode, final_stats, finalized_at").eq("status", "final").eq("mode", mode).eq("set_ver", C.SET_VERSION).order("finalized_at", { ascending: false }).limit(300);
      if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
      const rows = (data || []).filter((r) => (r.final_stats?.count || 0) >= MIN_BATTLE).map((r) => ({ id: r.id, title: r.title, streamer: r.streamer_nick, count: r.final_stats.count, avgTotal: r.final_stats.avgTotal, avgTier: r.final_stats.avgTier, at: r.finalized_at })).sort((a, b) => b.avgTotal - a.avgTotal).slice(0, 50);
      res.json({ ok: true, mode, minCount: MIN_BATTLE, rows });
    } catch (e) { console.error("[sense bc-ranking]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
}
export const _sbcTest = { BC, computeStats, finalizeIfDue, GRACE_MS, PLAY_TTL };
