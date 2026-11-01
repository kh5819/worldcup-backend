// =========================
// 플듀 IQ 진단소 「우리 방송에서 가장 똑똑한 사람은?」 — 방송 진단소 (iq:bc:* 소켓 + /iq/bc/* REST)
// - 스트리머가 방송 진단소를 만들고, 시청자는 ?bc=ID로 각자 검사 (8인 멀티와 별개 구조)
// - 시청자마다 같은 구성·같은 난이도·같은 채점 버전이지만 문제 자체는 다름 → 채팅으로 정답 스포일러 불가
// - 점수는 서버 채점 결과만 집계, 한 사람당 첫 완료 기록 1개, 통계는 2초 묶음 재계산, 마감 후 확정 보관
// - 평균 IQ 예측 이벤트: 마감 전까지 한 사람 한 번, 확정 때 가장 가까운 사람 공개
// DB: iq_broadcasts / iq_bc_entries / iq_bc_predictions (sql/iq_tables.sql)
// =========================
import * as C from "./iq-core.js?v=c2";

const BC = new Map();
const REST_CACHE = new Map();
const STATS_MS = 2000;
const GRACE_MS = 25 * 60 * 1000;   // 마감 전에 시작한 검사는 마감 후 25분까지 인정 (정밀 30문항 고려)
const MIN_BATTLE = 10;
const MAX_DEADLINE_MIN = 24 * 60;
const GUEST_MAX_OPEN = 1, MEMBER_MAX_OPEN = 3;
const GUEST_IP_WIN = 10 * 60 * 1000, GUEST_IP_MAX = 5;
const PLAY_TTL = 5 * 60 * 1000;
const ipMakes = new Map();
function sockIp(socket) {
  const h = socket.handshake?.headers || {};
  const cf = String(h["cf-connecting-ip"] || "").trim(); if (cf) return cf;
  const xff = String(h["x-forwarded-for"] || "").split(",").map((x) => x.trim()).filter(Boolean); if (xff.length) return xff[0];
  return String(socket.handshake?.address || "").replace(/^::ffff:/, "");
}
const now = () => Date.now();
function bcId() { const a = "abcdefghijkmnpqrstuvwxyz23456789"; let s = ""; for (let i = 0; i < 8; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
let SB = null, IO = null;
const room = (id) => `iq:bc:${id}`;

async function loadBc(id) {
  id = String(id || "").slice(0, 16);
  if (BC.has(id)) return BC.get(id);
  if (!SB) return null;
  const { data: row } = await SB.from("iq_broadcasts").select("*").eq("id", id).maybeSingle();
  if (!row) return null;
  const { data: ents } = await SB.from("iq_bc_entries").select("*").eq("bc_id", id).limit(20000);
  const { data: preds } = await SB.from("iq_bc_predictions").select("*").eq("bc_id", id).limit(20000);
  const b = { row, entries: new Map((ents || []).map((e) => [e.owner_key, e])), preds: new Map((preds || []).map((x) => [x.owner_key, x])), stats: null, dirty: true, at: 0, timer: null };
  BC.set(id, b);
  if (BC.size > 300) { const old = [...BC.entries()].sort((a, c) => a[1].at - c[1].at)[0]; if (old) BC.delete(old[0]); }
  return b;
}
const isOpen = (b) => b.row.status === "open" && now() < new Date(b.row.closes_at).getTime();
const acceptsUntil = (b) => new Date(b.row.closes_at).getTime() + GRACE_MS;

export function computeStats(b) {
  const all = [...b.entries.values()];
  const valid = all.filter((e) => !e.flagged && !e.is_streamer);
  const tot = valid.map((e) => e.total), iqs = valid.map((e) => e.iq);
  const streamer = all.find((e) => e.is_streamer) || null;
  const perArea = {};
  for (const a of C.AREAS) { const v = valid.map((e) => e.areas?.[a]).filter(Number.isFinite); perArea[a] = r1(avg(v)); }
  const sorted = [...valid].sort((x, y) => y.total - x.total || new Date(x.created_at) - new Date(y.created_at));
  const name = (e) => (e.show_name ? e.nickname : "익명 시청자");
  const pub = (e, i) => ({ rank: i + 1, nick: name(e), anon: !e.show_name, total: e.total, iq: e.iq, device: e.device, member: !!e.is_member });
  // 분야별 1위 (논리왕·기억력왕 …) — 동점이면 먼저 끝낸 사람
  const kings = {};
  for (const a of C.AREAS) {
    let best = null;
    for (const e of valid) { const v = e.areas?.[a]; if (!Number.isFinite(v)) continue; if (!best || v > best.v || (v === best.v && new Date(e.created_at) < new Date(best.at))) best = { v, nick: name(e), anon: !e.show_name, at: e.created_at }; }
    if (best && best.v > 0) kings[a] = { score: best.v, nick: best.nick, anon: best.anon };
  }
  const s = {
    id: b.row.id, title: b.row.title, streamer: b.row.streamer_nick, mode: b.row.mode, setVer: b.row.set_ver,
    status: b.row.status, closesAt: b.row.closes_at, open: isOpen(b),
    count: valid.length, flaggedCount: all.filter((e) => e.flagged).length,
    device: { pc: valid.filter((e) => e.device === "pc").length, mobile: valid.filter((e) => e.device === "mobile").length },
    avgTotal: r1(avg(tot)), medianTotal: median(tot), avgIq: r1(avg(iqs)), medianIq: median(iqs), perArea, kings,
    top10: sorted.slice(0, 10).map(pub),
    streamerScore: streamer ? { total: streamer.total, iq: streamer.iq, areas: streamer.areas } : null,
    beatStreamer: streamer && valid.length ? Math.round((valid.filter((e) => e.total > streamer.total).length / valid.length) * 100) : null,
    predictions: b.preds?.size || 0,
    updatedAt: new Date().toISOString(),
  };
  // 예측 이벤트: 확정 뒤에만 결과 공개 (진행 중엔 개수만)
  if (b.row.status === "final" && s.avgIq != null) {
    s.predictWinners = [...(b.preds?.values() || [])].map((x) => ({ nick: x.nickname, guess: x.guess, gap: Math.round(Math.abs(x.guess - s.avgIq) * 10) / 10, streamer: x.owner_key === b.row.owner_key }))
      .sort((x, y) => x.gap - y.gap).slice(0, 5);
  }
  const play = [...(b.playing?.values() || [])].filter((x) => now() - x.at < PLAY_TTL).sort((x, y) => y.round - x.round || x.since - y.since);
  s.playing = b.row.status === "final" ? 0 : play.length;
  s.playingList = b.row.status === "final" ? [] : play.slice(0, 60).map((x) => ({ nick: x.streamer ? x.nick : x.showName ? x.nick : "익명 시청자", anon: !x.streamer && !x.showName, round: x.round, total: x.total, done: x.done, device: x.device, streamer: !!x.streamer }));
  return s;
}
function markDirty(b) {
  b.dirty = true; REST_CACHE.delete(b.row.id);
  if (b.timer) return;
  const wait = Math.max(0, STATS_MS - (now() - b.at));
  b.timer = setTimeout(() => { b.timer = null; b.stats = computeStats(b); b.dirty = false; b.at = now(); IO?.to(room(b.row.id)).emit("iq:bc:stats", b.stats); }, wait);
}
function getStats(b) {
  if (b.row.final_stats) return b.row.final_stats;
  const stale = b.stats && (b.stats.open !== isOpen(b) || b.stats.closesAt !== b.row.closes_at || b.stats.status !== b.row.status);
  if (!b.stats || stale || (b.dirty && now() - b.at > STATS_MS)) { b.stats = computeStats(b); b.dirty = false; b.at = now(); }
  return b.stats;
}

// ---------- iq.js에서 부르는 고리 ----------
export async function bcOnBegin(bcIdArg, mode) {
  if (!bcIdArg) return { ok: true, bc: null };
  const b = await loadBc(bcIdArg);
  if (!b) return { ok: false, error: "BC_NOT_FOUND" };
  if (!isOpen(b)) return { ok: false, error: "BC_CLOSED" };
  if (mode !== b.row.mode) return { ok: false, error: "BC_MODE" };
  if (b.row.set_ver !== C.SET_VERSION) return { ok: false, error: "BC_VERSION" };
  return { ok: true, bc: b.row.id };
}
export function bcPlay(bcIdArg, key, info) {
  const b = BC.get(String(bcIdArg || ""));
  if (!b || b.row.status === "final") return;
  b.playing ||= new Map();
  const cur = b.playing.get(key);
  const x = { since: cur?.since || now(), ...cur, ...info, at: now(), streamer: b.row.owner_key === key };
  x.nick = String(x.nick || "시청자").replace(/[<>]/g, "").slice(0, 12) || "시청자";
  b.playing.set(key, x);
  if (b.playing.size > 3000) { const old = [...b.playing.entries()].sort((p, q) => p[1].at - q[1].at)[0]; if (old) b.playing.delete(old[0]); }
  markDirty(b);
}
export function bcPlayEnd(bcIdArg, key) { const b = BC.get(String(bcIdArg || "")); if (b?.playing?.delete(key)) markDirty(b); }
export async function bcOnFinish(bcIdArg, { key, me, row, sessStarted, showName }) {
  const b = await loadBc(bcIdArg);
  if (!b) return { counted: false, reason: "BC_NOT_FOUND" };
  if (b.row.status === "final") return { counted: false, reason: "BC_FINAL" };
  if (sessStarted > new Date(b.row.closes_at).getTime() || now() > acceptsUntil(b)) return { counted: false, reason: "BC_CLOSED" };
  if (b.entries.has(key)) return { counted: false, reason: "ALREADY", first: true };
  const isStreamer = b.row.owner_key === key;
  const e = {
    bc_id: b.row.id, owner_key: key, user_id: me.isGuest ? null : me.id, result_id: row.id,
    nickname: row.nickname, show_name: showName !== false, is_member: !me.isGuest, is_streamer: isStreamer,
    device: row.device, total: row.total, iq: row.iq, areas: row.areas, flagged: !!row.flagged, created_at: new Date().toISOString(),
  };
  b.entries.set(key, e);
  if (SB) {
    const { error } = await SB.from("iq_bc_entries").insert(e);
    if (error && String(error.code) !== "23505") { b.entries.delete(key); console.error("[iq bc] entry", error.message); return { counted: false, reason: "SAVE_FAIL" }; }
  }
  markDirty(b);
  return { counted: !e.flagged && !isStreamer, streamer: isStreamer, flagged: e.flagged };
}
async function finalizeIfDue(b, force = false) {
  if (b.row.status === "final") return;
  if (!force && now() < acceptsUntil(b)) return;
  b.row.status = "final";
  const stats = computeStats(b);
  stats.status = "final"; stats.open = false; stats.finalAt = new Date().toISOString();
  b.row.final_stats = stats;
  REST_CACHE.delete(b.row.id);
  if (SB) await SB.from("iq_broadcasts").update({ status: "final", final_stats: stats, finalized_at: stats.finalAt }).eq("id", b.row.id);
  IO?.to(room(b.row.id)).emit("iq:bc:stats", stats);
}

export function registerIqBroadcast(io, supabaseAdmin, app, { memberProfile } = {}) {
  SB = supabaseAdmin; IO = io;
  setInterval(() => {
    for (const b of BC.values()) {
      finalizeIfDue(b).catch(() => {});
      if (b.playing) { let gone = false; for (const [k, x] of b.playing) if (now() - x.at >= PLAY_TTL) { b.playing.delete(k); gone = true; } if (gone) markDirty(b); }
    }
  }, 30000).unref?.();

  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;
    const key = me.isGuest ? `g:${me.id}` : `u:${me.id}`;
    let win = now(), cnt = 0;
    const on = (ev, fn) => socket.on(ev, async (p, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      const n = now(); if (n - win > 10000) { win = n; cnt = 0; } if (++cnt > 30) return reply({ ok: false, error: "RATE_LIMITED" });
      try { await fn(p || {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); }
    });

    on("iq:bc:create", async (p, reply) => {
      if (!SB) return reply({ ok: false, error: "NO_DB" });
      if (me.isGuest) {
        if (!String(p.streamerNick || "").replace(/[<>]/g, "").trim()) return reply({ ok: false, error: "NEED_NICK" });
        const ip = sockIp(socket), n = now();
        const arr = (ipMakes.get(ip) || []).filter((t) => n - t < GUEST_IP_WIN);
        if (arr.length >= GUEST_IP_MAX) return reply({ ok: false, error: "RATE_LIMITED" });
        ipMakes.set(ip, arr);
      }
      const mode = p.mode === "full" ? "full" : "quick";
      const mins = Math.min(MAX_DEADLINE_MIN, Math.max(5, Math.round(Number(p.minutes) || 30)));
      const mp = !me.isGuest && memberProfile ? await memberProfile(SB, me) : null;
      const nick = String(String(p.streamerNick || "").trim() || mp?.nickname || "스트리머")   // 직접 적은 방송 닉네임 우선.replace(/[<>]/g, "").trim().slice(0, 16) || "스트리머";
      const title = String(p.title || `${nick} 방송 IQ 진단소`).replace(/[<>]/g, "").trim().slice(0, 40) || `${nick} 방송 IQ 진단소`;
      const { count } = await SB.from("iq_broadcasts").select("id", { count: "exact", head: true }).eq("owner_key", key).eq("status", "open").gt("closes_at", new Date().toISOString());
      if ((count || 0) >= (me.isGuest ? GUEST_MAX_OPEN : MEMBER_MAX_OPEN)) return reply({ ok: false, error: "TOO_MANY_OPEN", max: me.isGuest ? GUEST_MAX_OPEN : MEMBER_MAX_OPEN });
      const row = { id: bcId(), owner_key: key, user_id: me.isGuest ? null : me.id, title, streamer_nick: nick, avatar_url: mp?.avatar_url || null, mode, set_ver: C.SET_VERSION, status: "open", closes_at: new Date(now() + mins * 60000).toISOString(), created_at: new Date().toISOString() };
      const { error } = await SB.from("iq_broadcasts").insert(row);
      if (error) { console.error("[iq bc] create", error.message); return reply({ ok: false, error: "SAVE_FAIL" }); }
      if (me.isGuest) { const ip = sockIp(socket); ipMakes.set(ip, [...(ipMakes.get(ip) || []), now()]); if (ipMakes.size > 5000) ipMakes.clear(); }
      // admin 「📺 스트리머」 탭 기록 — "닉네임 (IQ)"
      SB.from("streamer_chat_log").insert({ platform: "iq", channel_id: row.id, nickname: nick, content_id: null, content_title: title, content_mode: null, room_code: row.id, host_user_id: me.isGuest ? null : me.id, host_nick: me.isGuest ? null : (mp?.nickname || null) })
        .then(({ error: le }) => { if (le) console.error("[iq bc] streamer log", le.message); }, () => {});
      BC.set(row.id, { row, entries: new Map(), preds: new Map(), stats: null, dirty: true, at: 0, timer: null });
      reply({ ok: true, bc: row });
    });

    on("iq:bc:mine", async (_p, reply) => {
      if (!SB) return reply({ ok: true, rows: [] });
      const { data } = await SB.from("iq_broadcasts").select("id, title, mode, status, closes_at, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(20);
      reply({ ok: true, rows: data || [] });
    });

    on("iq:bc:watch", async (p, reply) => {
      const b = await loadBc(p.id);
      if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" });
      await finalizeIfDue(b);
      socket.join(room(b.row.id));
      const mine = b.entries.get(key) || null, pred = b.preds?.get(key) || null;
      reply({ ok: true, stats: getStats(b), owner: b.row.owner_key === key, mine: mine ? { total: mine.total, iq: mine.iq, flagged: mine.flagged, streamer: mine.is_streamer } : null, myGuess: pred ? pred.guess : null });
    });

    // 평균 IQ 예측 (마감 전까지, 한 사람 한 번)
    on("iq:bc:predict", async (p, reply) => {
      const b = await loadBc(p.id);
      if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" });
      if (!isOpen(b)) return reply({ ok: false, error: "BC_CLOSED" });
      if (b.preds.has(key)) return reply({ ok: false, error: "ALREADY" });
      const guess = Math.round(Number(p.guess) * 10) / 10;
      if (!(guess >= 60 && guess <= 150)) return reply({ ok: false, error: "BAD_GUESS" });
      const mp = !me.isGuest && memberProfile ? await memberProfile(SB, me) : null;
      const x = { bc_id: b.row.id, owner_key: key, nickname: String(mp?.nickname || p.nick || "시청자").replace(/[<>]/g, "").slice(0, 12) || "시청자", guess, created_at: new Date().toISOString() };
      b.preds.set(key, x);
      if (SB) { const { error } = await SB.from("iq_bc_predictions").insert(x); if (error && String(error.code) !== "23505") { b.preds.delete(key); return reply({ ok: false, error: "SAVE_FAIL" }); } }
      markDirty(b);
      reply({ ok: true, guess });
    });

    on("iq:bc:control", async (p, reply) => {
      const b = await loadBc(p.id);
      if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" });
      if (b.row.owner_key !== key) return reply({ ok: false, error: "NOT_OWNER" });
      if (b.row.status === "final") return reply({ ok: false, error: "BC_FINAL" });
      if (p.action === "extend") {
        const mins = Math.min(MAX_DEADLINE_MIN, Math.max(1, Math.round(Number(p.minutes) || 10)));
        b.row.closes_at = new Date(Math.max(now(), new Date(b.row.closes_at).getTime()) + mins * 60000).toISOString();
        if (SB) await SB.from("iq_broadcasts").update({ closes_at: b.row.closes_at }).eq("id", b.row.id);
      } else if (p.action === "close") {
        b.row.closes_at = new Date(Math.min(now(), new Date(b.row.closes_at).getTime())).toISOString();
        if (SB) await SB.from("iq_broadcasts").update({ closes_at: b.row.closes_at }).eq("id", b.row.id);
      } else if (p.action === "finalize") {
        if (isOpen(b)) return reply({ ok: false, error: "STILL_OPEN" });
        await finalizeIfDue(b, true);
      } else return reply({ ok: false, error: "BAD_ACTION" });
      markDirty(b);
      reply({ ok: true, stats: getStats(b) });
    });
  });

  if (!app) return;
  app.get("/iq/bc/:id", async (req, res) => {
    try {
      const id = String(req.params.id || "").slice(0, 16);
      const c = REST_CACHE.get(id); if (c && now() - c.at < 1500) return res.json(c.body);
      const b = await loadBc(id);
      if (!b) return res.status(404).json({ ok: false, error: "BC_NOT_FOUND" });
      await finalizeIfDue(b);
      const body = { ok: true, stats: getStats(b) };
      REST_CACHE.set(id, { at: now(), body }); if (REST_CACHE.size > 500) REST_CACHE.clear();
      res.json(body);
    } catch (e) { console.error("[iq bc/get]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  // 방송 대항전: 같은 모드·같은 세트 버전만 순위, 참여자 10명 미만은 순위 밖
  app.get("/iq/bc-battle", async (req, res) => {
    try {
      const ids = String(req.query.ids || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 8);
      if (ids.length < 2) return res.status(400).json({ ok: false, error: "NEED_2" });
      const list = [];
      for (const id of ids) { const b = await loadBc(id); if (b) { await finalizeIfDue(b); list.push(getStats(b)); } }
      if (list.length < 2) return res.status(404).json({ ok: false, error: "BC_NOT_FOUND" });
      const base = list[0];
      const rows = list.map((s) => ({ id: s.id, title: s.title, streamer: s.streamer, mode: s.mode, count: s.count, avgTotal: s.avgTotal, medianTotal: s.medianTotal, avgIq: s.avgIq, medianIq: s.medianIq, perArea: s.perArea, final: s.status === "final", top10: s.top10, comparable: s.mode === base.mode && s.setVer === base.setVer, enough: s.count >= MIN_BATTLE }));
      const ranked = rows.filter((r) => r.comparable && r.enough && r.avgTotal != null).sort((a, b) => b.avgTotal - a.avgTotal || b.medianTotal - a.medianTotal);
      ranked.forEach((r, i) => { r.rank = i + 1; });
      res.json({ ok: true, mode: base.mode, minCount: MIN_BATTLE, rows });
    } catch (e) { console.error("[iq bc/battle]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  // 방송 대항전 랭킹(확정된 방송, 같은 모드·버전, 참여 10명 이상)
  app.get("/iq/bc-ranking", async (req, res) => {
    try {
      const mode = req.query.mode === "full" ? "full" : "quick";
      const { data, error } = await SB.from("iq_broadcasts").select("id, title, streamer_nick, mode, final_stats, finalized_at").eq("status", "final").eq("mode", mode).eq("set_ver", C.SET_VERSION).order("finalized_at", { ascending: false }).limit(300);
      if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
      const rows = (data || []).filter((r) => (r.final_stats?.count || 0) >= MIN_BATTLE).map((r) => ({ id: r.id, title: r.title, streamer: r.streamer_nick, count: r.final_stats.count, avgIq: r.final_stats.avgIq, avgTotal: r.final_stats.avgTotal, at: r.finalized_at }))
        .sort((a, b) => b.avgTotal - a.avgTotal).slice(0, 50);
      res.json({ ok: true, mode, minCount: MIN_BATTLE, rows });
    } catch (e) { console.error("[iq bc-ranking]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
}
export const _bcTest = { BC, computeStats, finalizeIfDue, GRACE_MS, PLAY_TTL };
