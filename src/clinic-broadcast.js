// =========================
// 진단소 「우리 방송 피지컬 평균」 — 방송 진단소 (clinic:bc:* 소켓 + /clinic/bc/* REST)
// - 스트리머(로그인 필수)가 방송 진단소를 만들고, 시청자는 ?bc=ID로 각자 검사
// - 점수·나이는 서버 채점 결과만 집계 (클라가 보낸 숫자 안 받음), 한 사람당 첫 완료 기록 1개
// - 통계는 메모리 캐시 + 2초 단위 묶음 재계산·방송, 마감 후 확정(final_stats)해 그대로 보관
// DB: clinic_broadcasts / clinic_bc_entries (sql/clinic_broadcast.sql, RLS 켬·정책 0 = 서버 전용)
// =========================
import * as C from "./clinic-core.js";

const BC = new Map();              // id → { row, entries: Map(owner_key → entry), stats, dirty, at }
const REST_CACHE = new Map();      // OBS 오버레이 응답 짧은 캐시 (바뀌면 바로 지움)
const STATS_MS = 2000;             // 통계 재계산·전송 묶음 간격
const GRACE_MS = 15 * 60 * 1000;   // 마감 전에 시작한 검사는 마감 후 15분까지 인정
const MIN_BATTLE = 10;             // 대항전 순위에 넣을 최소 참여자 수
const MAX_DEADLINE_MIN = 24 * 60;
const GUEST_MAX_OPEN = 1, MEMBER_MAX_OPEN = 3;      // 동시에 열 수 있는 방송 수 (게스트는 브라우저 = 주인)
const GUEST_IP_WIN = 10 * 60 * 1000, GUEST_IP_MAX = 5;   // 게스트 만들기: 같은 IP 10분에 5개까지 (도배 방지)
const ipMakes = new Map();
const PLAY_TTL = 4 * 60 * 1000;    // 이 시간 동안 아무 진행이 없으면 "검사 중" 목록에서 뺌 (창 닫음 등)
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
const room = (id) => `clinic:bc:${id}`;

async function loadBc(id) {
  id = String(id || "").slice(0, 16);
  if (BC.has(id)) return BC.get(id);
  if (!SB) return null;
  const { data: row } = await SB.from("clinic_broadcasts").select("*").eq("id", id).maybeSingle();
  if (!row) return null;
  const { data: ents } = await SB.from("clinic_bc_entries").select("*").eq("bc_id", id).limit(20000);
  const b = { row, entries: new Map((ents || []).map((e) => [e.owner_key, e])), stats: null, dirty: true, at: 0, timer: null };
  BC.set(id, b);
  if (BC.size > 300) { const old = [...BC.entries()].sort((a, c) => a[1].at - c[1].at)[0]; if (old) BC.delete(old[0]); }
  return b;
}
const isOpen = (b) => b.row.status === "open" && now() < new Date(b.row.closes_at).getTime();
const acceptsUntil = (b) => new Date(b.row.closes_at).getTime() + GRACE_MS;

// ---------- 통계 (서버 계산) ----------
export function computeStats(b) {
  const all = [...b.entries.values()];
  const valid = all.filter((e) => !e.flagged && !e.is_streamer);
  const tot = valid.map((e) => e.total), phys = valid.map((e) => e.phys);
  const streamer = all.find((e) => e.is_streamer) || null;
  const ageDist = {};
  for (const e of valid) if (e.age_group) ageDist[e.age_group] = (ageDist[e.age_group] || 0) + 1;
  const tests = C.MODES[b.row.mode].tests;
  const perTest = {};
  for (const t of tests) { const v = valid.map((e) => e.scores?.[t]).filter(Number.isFinite); perTest[t] = r1(avg(v)); }
  const dev = { pc: valid.filter((e) => e.device === "pc").length, mobile: valid.filter((e) => e.device === "mobile").length };
  const sorted = [...valid].sort((x, y) => y.total - x.total || new Date(x.created_at) - new Date(y.created_at));
  const pub = (e, i) => ({ rank: i + 1, nick: e.show_name ? e.nickname : `익명 시청자`, anon: !e.show_name, total: e.total, phys: e.phys, device: e.device, member: !!e.is_member });
  const s = {
    id: b.row.id, title: b.row.title, streamer: b.row.streamer_nick, mode: b.row.mode, coreVer: b.row.core_ver,
    status: b.row.status, closesAt: b.row.closes_at, open: isOpen(b),
    count: valid.length, flaggedCount: all.filter((e) => e.flagged).length, device: dev,
    avgTotal: r1(avg(tot)), avgPhys: r1(avg(phys)), medianPhys: median(phys), medianTotal: median(tot),
    ageDist, perTest,
    top10: sorted.slice(0, 10).map(pub),
    best: sorted[0] ? pub(sorted[0], 0) : null, worst: sorted.length ? pub(sorted[sorted.length - 1], sorted.length - 1) : null,
    streamerScore: streamer ? { total: streamer.total, phys: streamer.phys, scores: streamer.scores } : null,
    beatStreamer: streamer && valid.length ? Math.round((valid.filter((e) => e.total > streamer.total).length / valid.length) * 100) : null,
    updatedAt: new Date().toISOString(),
  };
  // 지금 검사 중인 시청자 (메모리에만 — 저장 안 함). 닉네임 숨김 선택이면 익명
  const play = [...(b.playing?.values() || [])].filter((x) => now() - x.at < PLAY_TTL).sort((x, y) => y.round - x.round || x.since - y.since);
  s.playing = b.row.status === "final" ? 0 : play.length;
  s.playingList = b.row.status === "final" ? [] : play.slice(0, 30).map((x) => ({ nick: x.streamer ? x.nick : x.showName ? x.nick : "익명 시청자", anon: !x.streamer && !x.showName, round: x.round, total: x.total, done: x.done, device: x.device, streamer: !!x.streamer }));
  return s;
}
function markDirty(b) {
  b.dirty = true;
  REST_CACHE.delete(b.row.id);
  if (b.timer) return;
  const wait = Math.max(0, STATS_MS - (now() - b.at));
  b.timer = setTimeout(() => {
    b.timer = null;
    b.stats = computeStats(b); b.dirty = false; b.at = now();
    IO?.to(room(b.row.id)).emit("clinic:bc:stats", b.stats);
  }, wait);
}
function getStats(b) {
  if (b.row.final_stats) return b.row.final_stats;
  // 마감 시각이 지났거나(시간이 흘러서) 마감·연장으로 열림 상태가 바뀌었으면 묶음 간격과 상관없이 바로 다시 계산
  const stale = b.stats && (b.stats.open !== isOpen(b) || b.stats.closesAt !== b.row.closes_at || b.stats.status !== b.row.status);
  if (!b.stats || stale || (b.dirty && now() - b.at > STATS_MS)) { b.stats = computeStats(b); b.dirty = false; b.at = now(); }
  return b.stats;
}

// ---------- clinic.js에서 부르는 고리 ----------
// 검사 시작: 방송 진단소면 모드 강제·마감 확인
export async function bcOnBegin(bcIdArg, mode) {
  if (!bcIdArg) return { ok: true, bc: null };
  const b = await loadBc(bcIdArg);
  if (!b) return { ok: false, error: "BC_NOT_FOUND" };
  if (!isOpen(b)) return { ok: false, error: "BC_CLOSED" };
  if (mode !== b.row.mode) return { ok: false, error: "BC_MODE" };
  return { ok: true, bc: b.row.id };
}
// 진행 표시: 시작·라운드 넘어감·제출 때 부름 (round = 지금 하는 라운드 1부터, done = 끝낸 라운드 수)
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
export function bcPlayEnd(bcIdArg, key) {
  const b = BC.get(String(bcIdArg || ""));
  if (b?.playing?.delete(key)) markDirty(b);
}
// 발급: 서버가 채점·저장한 결과로만 집계 (한 사람당 첫 완료 기록 1개)
export async function bcOnFinish(bcIdArg, { key, me, row, sessStarted, showName }) {
  const b = await loadBc(bcIdArg);
  if (!b) return { counted: false, reason: "BC_NOT_FOUND" };
  if (b.row.status === "final") return { counted: false, reason: "BC_FINAL" };
  if (sessStarted > new Date(b.row.closes_at).getTime()) return { counted: false, reason: "BC_CLOSED" };   // 마감 시각까지 시작한 검사는 인정
  if (now() > acceptsUntil(b)) return { counted: false, reason: "BC_CLOSED" };
  if (b.entries.has(key)) return { counted: false, reason: "ALREADY", first: true };
  const isStreamer = b.row.owner_key === key;
  const e = {
    bc_id: b.row.id, owner_key: key, user_id: me.isGuest ? null : me.id, result_id: row.id,
    nickname: row.nickname, show_name: showName !== false, is_member: !me.isGuest, is_streamer: isStreamer,
    device: row.device, total: row.total, phys: row.phys, age_group: row.show_age === false ? null : C.ageGroup(row.age),
    scores: row.scores, flagged: !!row.flagged, created_at: new Date().toISOString(),
  };
  b.entries.set(key, e);
  if (SB) {
    const { error } = await SB.from("clinic_bc_entries").insert(e);
    if (error && String(error.code) !== "23505") { b.entries.delete(key); console.error("[bc] entry", error.message); return { counted: false, reason: "SAVE_FAIL" }; }
  }
  markDirty(b);
  return { counted: !e.flagged && !isStreamer, streamer: isStreamer, flagged: e.flagged };
}

// 마감 처리: 마감+유예 지나면 확정 (요청 들어올 때·주기적으로)
async function finalizeIfDue(b, force = false) {
  if (b.row.status === "final") return;
  if (!force && now() < acceptsUntil(b)) return;
  const stats = computeStats(b);
  stats.status = "final"; stats.open = false; stats.finalAt = new Date().toISOString();
  b.row.status = "final"; b.row.final_stats = stats;
  REST_CACHE.delete(b.row.id);
  if (SB) await SB.from("clinic_broadcasts").update({ status: "final", final_stats: stats, finalized_at: stats.finalAt }).eq("id", b.row.id);
  IO?.to(room(b.row.id)).emit("clinic:bc:stats", stats);
}

export function registerClinicBroadcast(io, supabaseAdmin, app, { memberProfile } = {}) {
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

    // 방송 진단소 만들기 — 회원(프로필 닉네임) 또는 게스트(직접 입력 닉네임, 이 브라우저가 주인)
    on("clinic:bc:create", async (p, reply) => {
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
      const nick = String(mp?.nickname || p.streamerNick || "스트리머").replace(/[<>]/g, "").trim().slice(0, 16) || "스트리머";
      const title = String(p.title || `${nick} 방송 진단소`).replace(/[<>]/g, "").trim().slice(0, 40) || `${nick} 방송 진단소`;
      // 동시에 열 수 있는 방송: 회원 3개 · 게스트 1개 (마감 시간이 지난 방송은 안 셈)
      const { count } = await SB.from("clinic_broadcasts").select("id", { count: "exact", head: true }).eq("owner_key", key).eq("status", "open").gt("closes_at", new Date().toISOString());
      if ((count || 0) >= (me.isGuest ? GUEST_MAX_OPEN : MEMBER_MAX_OPEN)) return reply({ ok: false, error: "TOO_MANY_OPEN", max: me.isGuest ? GUEST_MAX_OPEN : MEMBER_MAX_OPEN });
      const row = { id: bcId(), owner_key: key, user_id: me.isGuest ? null : me.id, title, streamer_nick: nick, avatar_url: mp?.avatar_url || null, mode, core_ver: C.CORE_VERSION, status: "open", closes_at: new Date(now() + mins * 60000).toISOString(), created_at: new Date().toISOString() };
      const { error } = await SB.from("clinic_broadcasts").insert(row);
      if (error) { console.error("[bc] create", error.message); return reply({ ok: false, error: "SAVE_FAIL" }); }
      if (me.isGuest) { const ip = sockIp(socket); ipMakes.set(ip, [...(ipMakes.get(ip) || []), now()]); if (ipMakes.size > 5000) ipMakes.clear(); }   // 실제로 만든 것만 셈
      // admin 「📺 스트리머」 탭에 "닉네임 (에이징커브)"로 남김 — 실패해도 방송 만들기에는 영향 없음
      SB.from("streamer_chat_log").insert({
        platform: "clinic", channel_id: row.id, nickname: nick, content_id: null, content_title: title, content_mode: null,
        room_code: row.id, host_user_id: me.isGuest ? null : me.id, host_nick: me.isGuest ? null : (mp?.nickname || null),
      }).then(({ error: le }) => { if (le) console.error("[bc] streamer log", le.message); }, () => {});
      BC.set(row.id, { row, entries: new Map(), stats: null, dirty: true, at: 0, timer: null });
      reply({ ok: true, bc: row });
    });

    on("clinic:bc:mine", async (_p, reply) => {
      if (!SB) return reply({ ok: true, rows: [] });
      const { data } = await SB.from("clinic_broadcasts").select("id, title, mode, status, closes_at, created_at").eq("owner_key", key).order("created_at", { ascending: false }).limit(20);
      reply({ ok: true, rows: data || [] });
    });

    // 방송 정보·통계 구독 (대시보드·참여 화면)
    on("clinic:bc:watch", async (p, reply) => {
      const b = await loadBc(p.id);
      if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" });
      await finalizeIfDue(b);
      socket.join(room(b.row.id));
      const mine = b.entries.get(key) || null;
      reply({ ok: true, stats: getStats(b), owner: b.row.owner_key === key, mine: mine ? { total: mine.total, phys: mine.phys, flagged: mine.flagged, streamer: mine.is_streamer } : null });
    });

    // 마감 시간 바꾸기 / 지금 마감 / 결과 확정 — 방송 주인만
    on("clinic:bc:control", async (p, reply) => {
      const b = await loadBc(p.id);
      if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" });
      if (b.row.owner_key !== key) return reply({ ok: false, error: "NOT_OWNER" });
      if (b.row.status === "final") return reply({ ok: false, error: "BC_FINAL" });
      if (p.action === "extend") {
        const mins = Math.min(MAX_DEADLINE_MIN, Math.max(1, Math.round(Number(p.minutes) || 10)));
        b.row.closes_at = new Date(Math.max(now(), new Date(b.row.closes_at).getTime()) + mins * 60000).toISOString();
        if (SB) await SB.from("clinic_broadcasts").update({ closes_at: b.row.closes_at }).eq("id", b.row.id);
      } else if (p.action === "close") {
        b.row.closes_at = new Date(Math.min(now(), new Date(b.row.closes_at).getTime())).toISOString();
        if (SB) await SB.from("clinic_broadcasts").update({ closes_at: b.row.closes_at }).eq("id", b.row.id);
      } else if (p.action === "finalize") {
        if (isOpen(b)) return reply({ ok: false, error: "STILL_OPEN" });
        await finalizeIfDue(b, true);
      } else return reply({ ok: false, error: "BAD_ACTION" });
      markDirty(b);
      reply({ ok: true, stats: getStats(b) });
    });
  });

  if (!app) return;
  // OBS 오버레이·공유용 (짧은 캐시)
  const cache = REST_CACHE;
  app.get("/clinic/bc/:id", async (req, res) => {
    try {
      const id = String(req.params.id || "").slice(0, 16);
      const c = cache.get(id);
      if (c && now() - c.at < 1500) return res.json(c.body);
      const b = await loadBc(id);
      if (!b) return res.status(404).json({ ok: false, error: "BC_NOT_FOUND" });
      await finalizeIfDue(b);
      const body = { ok: true, stats: getStats(b) };
      cache.set(id, { at: now(), body });
      if (cache.size > 500) cache.clear();
      res.json(body);
    } catch (e) { console.error("[bc/get]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  // 방송 대항전: 같은 검사 모드·같은 채점 버전만 순위, 참여자 적은 방송은 별도 표시
  app.get("/clinic/bc-battle", async (req, res) => {
    try {
      const ids = String(req.query.ids || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 8);
      if (ids.length < 2) return res.status(400).json({ ok: false, error: "NEED_2" });
      const list = [];
      for (const id of ids) { const b = await loadBc(id); if (b) { await finalizeIfDue(b); list.push(getStats(b)); } }
      if (list.length < 2) return res.status(404).json({ ok: false, error: "BC_NOT_FOUND" });
      const base = list[0];
      const rows = list.map((s) => ({
        id: s.id, title: s.title, streamer: s.streamer, mode: s.mode, count: s.count, avgTotal: s.avgTotal, medianTotal: s.medianTotal, avgPhys: s.avgPhys, medianPhys: s.medianPhys, final: s.status === "final",
        top10: s.top10, comparable: s.mode === base.mode && s.coreVer === base.coreVer, enough: s.count >= MIN_BATTLE,
      }));
      const ranked = rows.filter((r) => r.comparable && r.enough && r.avgTotal != null).sort((a, b) => b.avgTotal - a.avgTotal || b.medianTotal - a.medianTotal);
      ranked.forEach((r, i) => { r.rank = i + 1; });
      res.json({ ok: true, mode: base.mode, minCount: MIN_BATTLE, rows });
    } catch (e) { console.error("[bc/battle]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
}

export const _bcTest = { BC, computeStats, finalizeIfDue, GRACE_MS, PLAY_TTL };
