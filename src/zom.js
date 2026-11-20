// =========================
// 플듀 좀비 생존 진단소 — 서버 (zom:* 소켓 + /zom/* REST)
// - 한 판은 서버 세션: 장면·결과 확률·숨은 감염·손 작업 정답은 서버만 앎. 화면은 고른 번호·손 작업 결과만 보냄
// - 모드: normal(매번 다른 사태) · daily(오늘의 좀비 사태: 모두 같은 씨앗, 첫 기록만 순위) · bc(방송 진단소: 방송마다 같은 씨앗)
// - 방송 진단소(IQ 방송 진단소와 같은 구조): 스트리머가 만들고 시청자는 ?bc=ID로 각자 플레이 → 현황판(생존 중·사망 피드·사인 순위·TOP)
//   만들 때 admin 「📺 스트리머」 기록(platform "zombie")
// DB: zom_results · zom_broadcasts · zom_bc_entries · zom_bc_predictions (sql/zom_tables_20261120.sql, RLS 켬·정책 0 = 서버 전용)
// =========================
import * as C from "./zom-core.js";
import { memberProfile, sanitizeProfile, sanitizePrefs, resultId, userKey, device } from "./iq.js";
import { tx, trStr } from "./zom-tr.js";

const SESS = new Map();
const SESS_TTL = 3 * 60 * 60 * 1000;
const MAX_SESS = 3;
const DAILY_STARTS = new Map();   // 사람|날짜 → 처음 시작 (오늘의 사태를 미리 보고 다시 하기 방지)
const BC = new Map();
const BC_STATS_MS = 2000, BC_GRACE = 40 * 60 * 1000, BC_MAX_MIN = 24 * 60, BC_PLAY_TTL = 6 * 60 * 1000;
const GUEST_MAX_OPEN = 1, MEMBER_MAX_OPEN = 3, GUEST_IP_WIN = 10 * 60 * 1000, GUEST_IP_MAX = 5;
const ipMakes = new Map();
const RL = Math.max(1, Number(process.env.ZOM_RL) || 1);   // 시험할 때만 늘림 (운영은 1)
let SB = null, IO = null;
const now = () => Date.now();
const newSeed = () => (Math.floor(Math.random() * 0xffffffff) >>> 0) || 7;
const bcRoom = (id) => `zom:bc:${id}`;
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);
function sockIp(socket) {
  const h = socket.handshake?.headers || {};
  const cf = String(h["cf-connecting-ip"] || "").trim(); if (cf) return cf;
  const xff = String(h["x-forwarded-for"] || "").split(",").map((x) => x.trim()).filter(Boolean); if (xff.length) return xff[0];
  return String(socket.handshake?.address || "").replace(/^::ffff:/, "");
}
function bcIdNew() { const a = "abcdefghijkmnpqrstuvwxyz23456789"; let s = ""; for (let i = 0; i < 8; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
function sweep() { const n = now(); for (const [k, s] of SESS) if (n - s.createdAt > SESS_TTL) SESS.delete(k); if (DAILY_STARTS.size > 50000) DAILY_STARTS.clear(); }

// ---------- 결과 행 ----------
function publicRow(row, { owner = false } = {}) {
  if (!row) return null;
  return {
    id: row.id, nick: row.nickname, avatar: row.avatar, avatarUrl: row.avatar_url || null, mode: row.mode, setKey: row.set_key, device: row.device,
    days: row.days, rescued: row.rescued, score: row.score, cause: row.cause, typeId: row.type_id, abil: row.abil, diag: row.diag,
    isPublic: row.is_public, flagged: row.flagged, isGuest: !row.user_id, mine: owner, isStreamer: !!row.is_streamer, bcId: row.bc_id || null, createdAt: row.created_at,
    age: owner || row.show_age ? row.age : null,
  };
}
async function percentile(mode, setKey, score) {
  if (!SB) return null;
  try {
    let q = SB.from("zom_results").select("id", { count: "exact", head: true }).eq("mode", mode).eq("flagged", false);
    if (setKey) q = q.eq("set_key", setKey);
    const { count: all } = await q;
    if (!all || all < 20) return null;
    let q2 = SB.from("zom_results").select("id", { count: "exact", head: true }).eq("mode", mode).eq("flagged", false).gt("score", score);
    if (setKey) q2 = q2.eq("set_key", setKey);
    const { count: better } = await q2;
    return Math.max(1, Math.round(((better || 0) / all) * 100));
  } catch { return null; }
}

// ---------- 방송 진단소 ----------
async function loadBc(id) {
  id = String(id || "").slice(0, 16);
  if (BC.has(id)) return BC.get(id);
  if (!SB) return null;
  const { data: row } = await SB.from("zom_broadcasts").select("*").eq("id", id).maybeSingle();
  if (!row) return null;
  const { data: ents } = await SB.from("zom_bc_entries").select("*").eq("bc_id", id).limit(20000);
  const { data: preds } = await SB.from("zom_bc_predictions").select("*").eq("bc_id", id).limit(20000);
  const b = { row, entries: new Map((ents || []).map((e) => [e.owner_key, e])), preds: new Map((preds || []).map((x) => [x.owner_key, x])), playing: new Map(), feed: [], stats: null, dirty: true, at: 0, timer: null };
  BC.set(id, b);
  if (BC.size > 300) { const old = [...BC.entries()].sort((a, c) => a[1].at - c[1].at)[0]; if (old && old[0] !== id) BC.delete(old[0]); }
  return b;
}
const bcOpen = (b) => b.row.status === "open" && now() < new Date(b.row.closes_at).getTime();
const bcUntil = (b) => new Date(b.row.closes_at).getTime() + BC_GRACE;
const nameOf = (e) => (e.show_name ? e.nickname : "익명 시청자");
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
function bcStats(b) {
  const all = [...b.entries.values()], valid = all.filter((e) => !e.flagged && !e.is_streamer), streamer = all.find((e) => e.is_streamer) || null;
  const sorted = [...valid].sort((x, y) => y.score - x.score || new Date(x.created_at) - new Date(y.created_at));
  const causes = {}; for (const e of valid) if (e.cause) causes[e.cause] = (causes[e.cause] || 0) + 1;
  const types = {}; for (const e of valid) types[e.type_id] = (types[e.type_id] || 0) + 1;
  const play = [...b.playing.values()].filter((x) => now() - x.at < BC_PLAY_TTL).sort((x, y) => y.day - x.day || x.since - y.since);
  const s = {
    id: b.row.id, title: b.row.title, streamer: b.row.streamer_nick, status: b.row.status, closesAt: b.row.closes_at, open: bcOpen(b),
    count: valid.length, avgDays: r1(avg(valid.map((e) => e.days))), rescued: valid.filter((e) => e.rescued).length,
    top10: sorted.slice(0, 10).map((e, i) => ({ rank: i + 1, nick: nameOf(e), anon: !e.show_name, days: e.days, rescued: e.rescued, cause: e.cause, typeId: e.type_id })),
    causes: Object.entries(causes).sort((a, c) => c[1] - a[1]).slice(0, 6).map(([k, n]) => ({ cause: k, n })),
    types: Object.entries(types).sort((a, c) => c[1] - a[1]).map(([k, n]) => ({ typeId: k, n, name: C.TYPES[k]?.n || k, ic: C.TYPES[k]?.ic || "" })),
    streamerRes: streamer ? { days: streamer.days, rescued: streamer.rescued, cause: streamer.cause, typeId: streamer.type_id } : null,
    beatStreamer: streamer && valid.length ? Math.round((valid.filter((e) => e.score > streamer.score).length / valid.length) * 100) : null,
    predictions: b.preds.size,
    playing: b.row.status === "final" ? 0 : play.length,
    playingList: b.row.status === "final" ? [] : play.slice(0, 60).map((x) => ({ nick: x.streamer || x.showName ? x.nick : "익명 시청자", day: x.day, hp: x.hp, streamer: !!x.streamer })),
    feed: b.feed.slice(-14),
    updatedAt: new Date().toISOString(),
  };
  if (b.row.status === "final" && s.avgDays != null) s.predictWinners = [...b.preds.values()].map((x) => ({ nick: x.nickname, guess: x.guess, gap: r1(Math.abs(x.guess - s.avgDays)) })).sort((x, y) => x.gap - y.gap).slice(0, 5);
  return s;
}
function bcDirty(b) {
  b.dirty = true;
  if (b.timer) return;
  b.timer = setTimeout(() => { b.timer = null; b.stats = bcStats(b); b.dirty = false; b.at = now(); IO?.to(bcRoom(b.row.id)).emit("zom:bc:stats", b.stats); }, Math.max(0, BC_STATS_MS - (now() - b.at)));
}
function bcGet(b) {
  if (b.row.final_stats) return b.row.final_stats;
  if (!b.stats || b.dirty || b.stats.open !== bcOpen(b)) { b.stats = bcStats(b); b.dirty = false; b.at = now(); }
  return b.stats;
}
function bcPlay(b, key, info) {
  if (!b || b.row.status === "final") return;
  const cur = b.playing.get(key);
  const x = { since: cur?.since || now(), ...cur, ...info, at: now(), streamer: b.row.owner_key === key };
  x.nick = clean(x.nick, 12) || "시청자";
  b.playing.set(key, x);
  if (b.playing.size > 3000) { const old = [...b.playing.entries()].sort((p, q) => p[1].at - q[1].at)[0]; if (old) b.playing.delete(old[0]); }
  bcDirty(b);
}
async function bcFinalize(b, force = false) {
  if (b.row.status === "final" || (!force && now() < bcUntil(b))) return;
  b.row.status = "final";
  const st = bcStats(b); st.status = "final"; st.open = false; st.finalAt = new Date().toISOString();
  b.row.final_stats = st;
  if (SB) await SB.from("zom_broadcasts").update({ status: "final", final_stats: st, finalized_at: st.finalAt }).eq("id", b.row.id);
  IO?.to(bcRoom(b.row.id)).emit("zom:bc:stats", st);
}

// ---------- 등록 ----------
export function registerZombie(io, supabaseAdmin, app, { getOptionalUser } = {}) {
  SB = supabaseAdmin; IO = io;
  setInterval(sweep, 5 * 60 * 1000).unref?.();
  setInterval(() => { for (const b of BC.values()) { bcFinalize(b).catch(() => {}); let gone = false; for (const [k, x] of b.playing) if (now() - x.at >= BC_PLAY_TTL) { b.playing.delete(k); gone = true; } if (gone) bcDirty(b); } }, 30000).unref?.();

  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const key = userKey(me);
    let win = now(), cnt = 0;
    const on = (ev, fn, lim = 50) => socket.on(ev, async (p, cb) => {
      const lang = p && (p.lang === "ja" || p.lang === "en") ? p.lang : "ko";   // 화면 언어로 번역해서 보냄 (저장은 한국어)
      const reply = typeof cb === "function" ? (o) => cb(tx(o, lang)) : () => {};
      const n = now(); if (n - win > 10000) { win = n; cnt = 0; } if (++cnt > lim * RL) return reply({ ok: false, error: "RATE_LIMITED" });
      try { await fn(p && typeof p === "object" ? p : {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); }
    });
    const mySess = (sid) => { const s = SESS.get(String(sid || "")); return s && s.key === key ? s : null; };
    const live = (s) => { if (s.bc) bcPlay(BC.get(s.bc), key, { nick: s.bcNick, showName: s.bcShow, day: s.st.day, hp: Math.round(s.st.hp) }); };

    on("zom:begin", async (p, reply) => {
      let mode = p.mode === "daily" ? "daily" : "normal", seed = newSeed(), setKey = null, bc = null, preview = false;
      if (p.bc) {
        const b = await loadBc(p.bc);
        if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" });
        if (!bcOpen(b)) return reply({ ok: false, error: "BC_CLOSED" });
        mode = "bc"; seed = Number(b.row.seed) >>> 0; setKey = b.row.id; bc = b.row.id;
        // 같은 방송 사태를 두 번째로 시작하면 (미리 본 상태) 현황판 순위에서 빠짐
        b.starts ||= new Set(); if (b.starts.has(key)) preview = true; else b.starts.add(key); if (b.starts.size > 20000) b.starts.clear();
      } else if (mode === "daily") {
        setKey = C.dayKey(); seed = C.hashSeed("zom-daily-" + setKey);
        const k = `${key}|${setKey}`; if (DAILY_STARTS.has(k)) preview = true; else DAILY_STARTS.set(k, now());
      }
      const mine = [...SESS.entries()].filter(([, s]) => s.key === key).sort((a, b) => a[1].createdAt - b[1].createdAt);
      while (mine.length >= MAX_SESS) SESS.delete(mine.shift()[0]);
      const st = C.newRun(seed); C.nextScene(st);
      const sid = "z" + now().toString(36) + Math.random().toString(36).slice(2, 8);
      const s = { key, mode, setKey, bc, preview, device: device(p.device), createdAt: now(), st, finished: null, bcNick: clean(p.bcNick, 12), bcShow: p.bcShowName !== false };
      SESS.set(sid, s);
      live(s);
      reply({ ok: true, sid, mode, setKey, scene: C.publicScene(st), st: C.publicState(st), coreVersion: C.CORE_VERSION });
    });
    on("zom:resume", (p, reply) => {
      const s = mySess(p.sid);
      if (!s || s.finished) return reply({ ok: false, error: "NO_SESSION" });
      reply({ ok: true, mode: s.mode, setKey: s.setKey, bc: s.bc, scene: C.publicScene(s.st), st: C.publicState(s.st), over: C.overInfo(s.st), log: s.st.log.slice(-4) });
    });
    const afterStep = (s, r) => {
      live(s);
      if (r.over && s.bc) { const b = BC.get(s.bc); if (b && b.row.status !== "final") { b.feed.push({ nick: s.bcShow || b.row.owner_key === key ? s.bcNick || "시청자" : "익명 시청자", day: C.survivalDays(s.st), rescued: !!r.over.rescued, cause: r.over.cause, at: now() }); if (b.feed.length > 40) b.feed.shift(); b.playing.delete(key); bcDirty(b); } }
    };
    on("zom:choose", (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      const r = C.choose(s.st, p.ci);
      if (!r.ok) return reply(r);
      afterStep(s, r);
      reply(r);
    });
    on("zom:task", (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      let res = p.res; try { if (JSON.stringify(res ?? {}).length > 4000) res = {}; } catch { res = {}; }
      const r = C.finishTask(s.st, res);
      if (!r.ok) return reply(r);
      afterStep(s, r);
      reply(r);
    });

    on("zom:finish", async (p, reply) => {
      const s = mySess(p.sid); if (!s) return reply({ ok: false, error: "NO_SESSION" });
      if (s.finished) return reply({ ok: true, ...s.finished });
      if (!s.st.over) return reply({ ok: false, error: "NOT_OVER" });
      const prof = sanitizeProfile(p.profile); if (!prof) return reply({ ok: false, error: "BAD_PROFILE" });
      const mp = await memberProfile(SB, me); if (mp?.nickname) prof.nick = String(mp.nickname).slice(0, 12);
      const prefs = sanitizePrefs(p.prefs);
      const dg = C.diagnose(s.st);
      let repeat = !!s.preview;
      if (s.mode === "daily" && SB) { try { const { count } = await SB.from("zom_results").select("id", { count: "exact", head: true }).eq("owner_key", key).eq("mode", "daily").eq("set_key", s.setKey); if (count) repeat = true; } catch {} }
      const row = {
        id: resultId(), owner_key: key, user_id: me.isGuest ? null : me.id, nickname: prof.nick, age: prof.age, avatar: prof.avatar, avatar_url: mp?.avatar_url || null,
        mode: s.mode, set_key: s.setKey, device: s.device, core_ver: C.CORE_VERSION, seed: s.st.seed,
        days: dg.days, rescued: dg.rescued, score: dg.score, cause: dg.cause, type_id: dg.typeId, abil: dg.abil, diag: dg,
        is_public: p.isPublic !== false, flagged: repeat, show_age: !!prefs.showAge, is_streamer: !!prefs.streamer, bc_id: s.bc, created_at: new Date().toISOString(),
      };
      if (repeat) row.diag.repeat = true;
      let saved = null;
      if (SB) { const { error } = await SB.from("zom_results").insert(row); if (error) console.error("[zom] save", error.message); else saved = row.id; }
      const pct = repeat ? null : await percentile(s.mode === "bc" ? "normal" : s.mode, s.mode === "daily" ? s.setKey : null, row.score);
      s.finished = { id: saved, result: publicRow(row, { owner: true }), pct, repeat };
      if (s.bc) {
        const b = await loadBc(s.bc);
        if (b && b.row.status !== "final" && s.createdAt <= new Date(b.row.closes_at).getTime() && now() <= bcUntil(b) && !b.entries.has(key)) {
          const isStreamer = b.row.owner_key === key;
          const e = { bc_id: b.row.id, owner_key: key, user_id: me.isGuest ? null : me.id, result_id: saved, nickname: s.bcNick || prof.nick, show_name: s.bcShow || isStreamer, is_member: !me.isGuest, is_streamer: isStreamer, device: s.device, days: dg.days, rescued: dg.rescued, score: dg.score, cause: dg.cause, type_id: dg.typeId, flagged: !!s.preview, created_at: new Date().toISOString() };
          b.entries.set(key, e);
          let ok = true;
          if (SB) { const { error } = await SB.from("zom_bc_entries").insert(e); if (error && String(error.code) !== "23505") { b.entries.delete(key); ok = false; console.error("[zom bc] entry", error.message); } }
          b.playing.delete(key); bcDirty(b);
          s.finished.bc = { id: b.row.id, counted: ok && !isStreamer && !s.preview, streamer: isStreamer, preview: !!s.preview };
        } else s.finished.bc = { id: s.bc, counted: false, reason: b?.entries.has(key) ? "ALREADY" : "BC_CLOSED" };
      }
      reply({ ok: true, ...s.finished });
    });
    on("zom:setPublic", async (p, reply) => {
      if (!SB) return reply({ ok: false, error: "NO_DB" });
      const { error } = await SB.from("zom_results").update({ is_public: !!p.isPublic }).eq("id", String(p.id || "")).eq("owner_key", key);
      reply(error ? { ok: false, error: "UPDATE_FAIL" } : { ok: true });
    });
    on("zom:history", async (_p, reply) => {
      if (!SB) return reply({ ok: true, rows: [] });
      const { data } = await SB.from("zom_results").select("id, mode, set_key, days, rescued, score, cause, type_id, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(30);
      reply({ ok: true, rows: data || [] });
    });
    on("zom:mergeGuest", async (p, reply) => {
      if (me.isGuest) return reply({ ok: false, error: "LOGIN_REQUIRED" });
      if (!SB) return reply({ ok: false, error: "NO_DB" });
      const g = String(p.guestId || ""); if (!/^guest_[a-z0-9]{6,40}$/.test(g)) return reply({ ok: false, error: "BAD_GUEST" });
      const { data: moved, error } = await SB.from("zom_results").update({ owner_key: key, user_id: me.id }).eq("owner_key", `g:${g}`).select("id");
      reply(error ? { ok: false, error: "UPDATE_FAIL" } : { ok: true, moved: moved?.length || 0 });
    });

    // 현황판처럼 한 번에 여러 사람에게 보낸 한국어 글(사인·유형)을 보는 사람 언어로
    on("zom:tr", (p, reply) => {
      const list = (Array.isArray(p.list) ? p.list : []).slice(0, 60).map((x) => String(x ?? "").slice(0, 300));
      const L = p.lang === "ja" || p.lang === "en" ? p.lang : "ko";
      reply({ ok: true, list: list.map((x) => trStr(x, L)) });
    }, 30);

    // ---------- 방송 진단소 ----------
    on("zom:bc:create", async (p, reply) => {
      if (!SB) return reply({ ok: false, error: "NO_DB" });
      if (me.isGuest) {
        if (!clean(p.streamerNick, 16)) return reply({ ok: false, error: "NEED_NICK" });
        const ip = sockIp(socket), arr = (ipMakes.get(ip) || []).filter((t) => now() - t < GUEST_IP_WIN);
        if (arr.length >= GUEST_IP_MAX) return reply({ ok: false, error: "RATE_LIMITED" });
        ipMakes.set(ip, arr);
      }
      const mins = Math.min(BC_MAX_MIN, Math.max(5, Math.round(Number(p.minutes) || 40)));
      const mp = !me.isGuest ? await memberProfile(SB, me) : null;
      const nick = clean(p.streamerNick, 16) || clean(mp?.nickname, 16) || "스트리머";
      const title = clean(p.title, 40) || `${nick} 방송 좀비 사태`;
      const { count } = await SB.from("zom_broadcasts").select("id", { count: "exact", head: true }).eq("owner_key", key).eq("status", "open").gt("closes_at", new Date().toISOString());
      if ((count || 0) >= (me.isGuest ? GUEST_MAX_OPEN : MEMBER_MAX_OPEN)) return reply({ ok: false, error: "TOO_MANY_OPEN" });
      const row = { id: bcIdNew(), owner_key: key, user_id: me.isGuest ? null : me.id, title, streamer_nick: nick, avatar_url: mp?.avatar_url || null, seed: newSeed(), core_ver: C.CORE_VERSION, status: "open", closes_at: new Date(now() + mins * 60000).toISOString(), created_at: new Date().toISOString() };
      const { error } = await SB.from("zom_broadcasts").insert(row);
      if (error) { console.error("[zom bc] create", error.message); return reply({ ok: false, error: "SAVE_FAIL" }); }
      if (me.isGuest) { const ip = sockIp(socket); ipMakes.set(ip, [...(ipMakes.get(ip) || []), now()]); if (ipMakes.size > 5000) ipMakes.clear(); }
      // admin 「📺 스트리머」 탭 기록 — 스트리머 모드를 켜면 바로 남음 (채팅 연동 필요 없음)
      SB.from("streamer_chat_log").insert({ platform: "zombie", channel_id: row.id, nickname: nick, content_id: null, content_title: title, content_mode: null, room_code: row.id, host_user_id: me.isGuest ? null : me.id, host_nick: me.isGuest ? null : (mp?.nickname || null) })
        .then(({ error: le }) => { if (le) console.error("[zom bc] streamer log", le.message); }, () => {});
      BC.set(row.id, { row, entries: new Map(), preds: new Map(), playing: new Map(), feed: [], stats: null, dirty: true, at: 0, timer: null });
      reply({ ok: true, bc: { id: row.id, title, streamer_nick: nick, closes_at: row.closes_at } });
    }, 20);
    on("zom:bc:mine", async (_p, reply) => {
      if (!SB) return reply({ ok: true, rows: [] });
      const { data } = await SB.from("zom_broadcasts").select("id, title, status, closes_at, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(20);
      reply({ ok: true, rows: data || [] });
    });
    on("zom:bc:watch", async (p, reply) => {
      const b = await loadBc(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" });
      await bcFinalize(b);
      socket.join(bcRoom(b.row.id));
      const mine = b.entries.get(key) || null, pred = b.preds.get(key) || null;
      reply({ ok: true, stats: bcGet(b), owner: b.row.owner_key === key, mine: mine ? { days: mine.days, rescued: mine.rescued, cause: mine.cause } : null, myGuess: pred ? pred.guess : null });
    });
    on("zom:bc:predict", async (p, reply) => {
      const b = await loadBc(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" });
      if (!bcOpen(b)) return reply({ ok: false, error: "BC_CLOSED" });
      if (b.preds.has(key)) return reply({ ok: false, error: "ALREADY" });
      const guess = Math.round(Number(p.guess) * 10) / 10;
      if (!(guess >= 1 && guess <= 30)) return reply({ ok: false, error: "BAD_GUESS" });
      const mp = !me.isGuest ? await memberProfile(SB, me) : null;
      const x = { bc_id: b.row.id, owner_key: key, nickname: clean(mp?.nickname || p.nick, 12) || "시청자", guess, created_at: new Date().toISOString() };
      b.preds.set(key, x);
      if (SB) { const { error } = await SB.from("zom_bc_predictions").insert(x); if (error && String(error.code) !== "23505") { b.preds.delete(key); return reply({ ok: false, error: "SAVE_FAIL" }); } }
      bcDirty(b);
      reply({ ok: true, guess });
    }, 20);
    on("zom:bc:control", async (p, reply) => {
      const b = await loadBc(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" });
      if (b.row.owner_key !== key) return reply({ ok: false, error: "NOT_OWNER" });
      if (b.row.status === "final") return reply({ ok: false, error: "BC_FINAL" });
      if (p.action === "extend") {
        const mins = Math.min(BC_MAX_MIN, Math.max(1, Math.round(Number(p.minutes) || 10)));
        b.row.closes_at = new Date(Math.max(now(), new Date(b.row.closes_at).getTime()) + mins * 60000).toISOString();
        if (SB) await SB.from("zom_broadcasts").update({ closes_at: b.row.closes_at }).eq("id", b.row.id);
      } else if (p.action === "close") {
        b.row.closes_at = new Date(Math.min(now(), new Date(b.row.closes_at).getTime())).toISOString();
        if (SB) await SB.from("zom_broadcasts").update({ closes_at: b.row.closes_at }).eq("id", b.row.id);
      } else if (p.action === "finalize") {
        if (bcOpen(b)) return reply({ ok: false, error: "STILL_OPEN" });
        await bcFinalize(b, true);
      } else return reply({ ok: false, error: "BAD_ACTION" });
      bcDirty(b);
      reply({ ok: true, stats: bcGet(b) });
    }, 20);
  });

  if (!app) return;
  const isMine = async (req, row) => {
    const user = getOptionalUser ? await getOptionalUser(req) : null;
    const g = String(req.headers["x-zom-guest"] || "");
    return (user && row.owner_key === `u:${user.id}`) || (g.startsWith("guest_") && row.owner_key === `g:${g}`);
  };
  app.get("/zom/result/:id", async (req, res) => {
    try {
      if (!SB) return res.status(503).json({ ok: false, error: "NO_DB" });
      const { data: row, error } = await SB.from("zom_results").select("*").eq("id", String(req.params.id || "").slice(0, 16)).maybeSingle();
      if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
      if (!row) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      const mine = await isMine(req, row);
      if (!row.is_public && !mine) return res.status(403).json({ ok: false, error: "PRIVATE" });
      res.json(tx({ ok: true, result: publicRow(row, { owner: mine }) }, req.query.lang));
    } catch (e) { console.error("[zom/result]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  app.get("/zom/today", (_req, res) => res.json({ ok: true, day: C.dayKey(), core: C.CORE_VERSION }));
  const rankCache = new Map();
  app.get("/zom/ranking", async (req, res) => {
    try {
      if (!SB) return res.json({ ok: true, rows: [] });
      const mode = req.query.mode === "daily" ? "daily" : "normal";
      const board = req.query.board === "streamer" ? "streamer" : "all";
      const setKey = mode === "daily" ? (/^\d{4}-\d\d-\d\d$/.test(req.query.set || "") ? req.query.set : C.dayKey()) : null;
      const ck = JSON.stringify([mode, board, setKey]);
      const hit = rankCache.get(ck); if (hit && now() - hit.at < 30000) return res.json(tx(hit.body, req.query.lang));
      let q = SB.from("zom_results").select("id, owner_key, user_id, nickname, avatar, avatar_url, days, rescued, score, cause, type_id, is_streamer, created_at").eq("mode", mode).eq("is_public", true).eq("flagged", false);
      if (setKey) q = q.eq("set_key", setKey);
      if (board === "streamer") q = q.eq("is_streamer", true);
      const { data, error } = await q.order("score", { ascending: false }).order("created_at", { ascending: true }).limit(500);
      if (error) return res.status(500).json({ ok: false, error: "QUERY_FAIL" });
      const seen = new Set(), rows = [];
      for (const r of data || []) { if (seen.has(r.owner_key)) continue; seen.add(r.owner_key); rows.push({ id: r.id, nick: r.nickname, avatar: r.avatar, avatarUrl: r.avatar_url, days: r.days, rescued: r.rescued, score: r.score, cause: r.cause, typeId: r.type_id, isGuest: !r.user_id, streamer: !!r.is_streamer }); if (rows.length >= 50) break; }
      const body = { ok: true, mode, board, setKey, rows };
      rankCache.set(ck, { at: now(), body }); if (rankCache.size > 100) rankCache.clear();
      res.json(tx(body, req.query.lang));
    } catch (e) { console.error("[zom/ranking]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  app.get("/zom/bc/:id", async (req, res) => {
    try {
      const b = await loadBc(req.params.id); if (!b) return res.status(404).json({ ok: false, error: "BC_NOT_FOUND" });
      await bcFinalize(b);
      res.json({ ok: true, stats: bcGet(b) });
    } catch (e) { console.error("[zom bc/get]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  app.get("/zom/bc/:id/rank", async (req, res) => {
    try {
      const b = await loadBc(req.params.id); if (!b) return res.status(404).json({ ok: false, error: "BC_NOT_FOUND" });
      const from = Math.max(0, Math.min(1000, parseInt(req.query.from, 10) || 0)), n = Math.max(1, Math.min(50, parseInt(req.query.n, 10) || 50));
      const list = [...b.entries.values()].filter((e) => !e.flagged && !e.is_streamer).sort((x, y) => y.score - x.score || new Date(x.created_at) - new Date(y.created_at));
      const end = Math.min(list.length, from + n, 1000), rows = [];
      for (let i = from; i < end; i++) { const e = list[i]; rows.push({ rank: i + 1, nick: nameOf(e), anon: !e.show_name, days: e.days, rescued: e.rescued, cause: e.cause, typeId: e.type_id }); }
      res.json({ ok: true, total: list.length, from, rows, more: end < Math.min(list.length, 1000) });
    } catch (e) { console.error("[zom bc/rank]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
}
export const _zomTest = { SESS, BC, bcStats };
