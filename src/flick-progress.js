// =========================
// 증강 알까기 — 업적·칭호·도전 모드 별 + 오늘의 도전 랭킹 (2026-11-25, 물고기·슬롯과 같은 방식)
// · 표: sql/flick_progress_daily_20261125.sql
//   flick_progress (사람당 1줄: stats·깬 업적·칭호, stars = 도전 모드 별 합 → 별 랭킹)
//   flick_daily (날짜+사람당 1줄, 그날 최고 점수만)
// · 판이 끝나면 게임 서버가 확정한 결과로만 더함 (화면이 보낸 숫자는 안 씀)
// · 표가 아직 없거나 DB가 느려도 게임은 그대로 (조용히 건너뜀)
// =========================
import { achApply, achDone, achEquip, ACHS, todayKst } from "./flick-data.js";

const T = "flick_progress", TD = "flick_daily";
const KEY_RE = /^(guest_[A-Za-z0-9_-]{4,74}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const CACHE_MS = 10 * 60_000;
export const validKey = (k) => typeof k === "string" && KEY_RE.test(k);
const isUuid = (k) => /^[0-9a-f]{8}-/i.test(k) && !k.startsWith("guest_");
const empty = (key) => ({ player_key: key, stats: {}, unlocked: [], equip: {}, ach_count: 0, plays: 0, stars: 0 });
const COLS = "player_key, stats, unlocked, equip, ach_count, plays, stars";

export function createProgress(SA) {
  const cache = new Map();
  let down = 0, warned = false;
  const up = () => !!SA && (!down || Date.now() - down > 5 * 60_000);
  const offline = (error) => { if (/does not exist|schema cache|relation|column/i.test(error?.message || "")) { if (!warned) { warned = true; console.warn("[flick-progress] 표 없음 — sql/flick_progress_daily_20261125.sql 적용 전"); } down = Date.now(); return true; } return false; };
  const put = (row) => { cache.set(row.player_key, { row, at: Date.now() }); if (cache.size > 20000) { const old = Date.now() - CACHE_MS; for (const [k, v] of cache) if (v.at < old) cache.delete(k); } };

  async function load(key, { fresh = false } = {}) {
    if (!validKey(key)) return null;
    const c = cache.get(key); if (c && !fresh && Date.now() - c.at < CACHE_MS) return c.row;
    if (!up()) return c?.row || empty(key);
    const { data, error } = await SA.from(T).select(COLS).eq("player_key", key).maybeSingle();
    if (error) { if (!offline(error)) { console.error("[flick-progress] read", error.message); return c?.row || { ...empty(key), failed: true }; } return c?.row || empty(key); }
    down = 0; const row = data || empty(key); put(row); return row;
  }
  /** 캐시에 있는 칭호 (자리 만들 때 바로 씀) */
  const titleOf = (key) => { const row = cache.get(key)?.row; if (!row) return null; return achEquip(row.unlocked, row.equip).t; };

  /** 판 결과 기록. entries: [{ key, isGuest, name, run }] → Map(key → { newly, unlocked, count, stats }) */
  async function record(entries) {
    const out = new Map();
    const list = entries.filter(e => validKey(e.key) && (e.isGuest ? e.key.startsWith("guest_") : isUuid(e.key)));
    if (!up() || !list.length) return out;
    const keys = list.map(e => e.key);
    const { data, error } = await SA.from(T).select(COLS).in("player_key", keys);
    if (error) { if (!offline(error)) console.error("[flick-progress] read many", error.message); return out; }
    const old = new Map((data || []).map(d => [d.player_key, d])), rows = [], nowIso = new Date().toISOString();
    for (const e of list) {
      const o = old.get(e.key) || empty(e.key);
      const stats = achApply(o.stats, e.run), done = achDone(stats), had = new Set(o.unlocked || []);
      const unlocked = [...new Set([...(o.unlocked || []), ...done])].filter(id => ACHS.some(a => a.id === id));
      const newly = unlocked.filter(id => !had.has(id));
      rows.push({ player_key: e.key, user_id: e.isGuest ? null : e.key, guest_id: e.isGuest ? e.key : null, nickname: String(e.name || "").slice(0, 14) || null, stats, unlocked, ach_count: unlocked.length, plays: stats.plays || 0, stars: stats.stars || 0, updated_at: nowIso });
      out.set(e.key, { newly, unlocked, count: unlocked.length, stats, prevStg: o.stats?.stg || {} });
    }
    let saved = rows;
    const { error: e2 } = await SA.from(T).upsert(rows, { onConflict: "player_key" });
    if (e2) {
      if (offline(e2)) { out.clear(); return out; }
      console.error("[flick-progress] write", e2.message);
      saved = [];
      for (const r of rows) { const { error: e3 } = await SA.from(T).upsert([r], { onConflict: "player_key" }); if (e3) { console.error("[flick-progress] write one", r.player_key.slice(0, 12), e3.message); out.delete(r.player_key); } else saved.push(r); }
    }
    for (const r of saved) put({ player_key: r.player_key, stats: r.stats, unlocked: r.unlocked, equip: old.get(r.player_key)?.equip || cache.get(r.player_key)?.row?.equip || {}, ach_count: r.ach_count, plays: r.plays, stars: r.stars });
    starsBoardAt = 0;
    return out;
  }

  /** 칭호 바꾸기 (깬 업적 것만) */
  async function setEquip(key, want) {
    if (!validKey(key)) return { ok: false, error: "NO_PLAYER" };
    const row = await load(key, { fresh: true }); if (!row) return { ok: false, error: "NO_PLAYER" };
    if (row.failed) return { ok: false, error: "BUSY" };
    const eq = achEquip(row.unlocked, want);
    if (!up()) return { ok: false, error: "NOT_READY" };
    if (!(row.unlocked || []).length) return { ok: true, equip: eq };
    const { error } = await SA.from(T).update({ equip: eq }).eq("player_key", key);
    if (error) { if (!offline(error)) console.error("[flick-progress] equip", error.message); return { ok: false, error: "INTERNAL" }; }
    put({ ...row, equip: eq }); return { ok: true, equip: eq };
  }

  // ---------- 랭킹 ----------
  const withProfiles = async (rows) => {
    const ids = rows.map(r => r.user_id).filter(Boolean), prof = new Map();
    if (ids.length) { try { const { data: ps } = await SA.from("profiles").select("id, nickname, avatar_url").in("id", ids); for (const p of ps || []) prof.set(p.id, p); } catch {} }
    return rows.map((r) => { const p = r.user_id ? prof.get(r.user_id) : null; return { ...r, name: (p?.nickname || r.nickname || "?").slice(0, 20), avatar: p?.avatar_url || null }; });
  };
  let starsBoard = null, starsBoardAt = 0;
  async function starsTop(key) {
    if (!up()) return { ok: false, error: "NOT_READY" };
    if (!starsBoard || Date.now() - starsBoardAt > 20_000) {
      const { data, error } = await SA.from(T).select("player_key, user_id, guest_id, nickname, stars, ach_count").gt("stars", 0).order("stars", { ascending: false }).order("ach_count", { ascending: false }).limit(50);
      if (error) { if (!offline(error)) console.error("[flick-progress] stars top", error.message); return { ok: false, error: "BUSY" }; }
      starsBoard = (await withProfiles(data || [])).map((r, i) => ({ rank: i + 1, name: r.name, avatar: r.avatar, stars: r.stars, ach: r.ach_count, guest: !!r.guest_id, k: r.player_key })); starsBoardAt = Date.now();
    }
    const mine = starsBoard.find(r => r.k === key);
    return { ok: true, list: starsBoard.map(({ k, ...r }) => ({ ...r, me: k === key })), me: mine ? { rank: mine.rank, stars: mine.stars } : null };
  }
  let dBoard = null, dDay = "", dAt = 0;
  async function dailyRecord(e) {
    if (!up() || !validKey(e.key)) return null; const day = todayKst();
    const { data, error } = await SA.from(TD).select("best, tries").eq("day", day).eq("player_key", e.key).maybeSingle();
    if (error) { if (!offline(error)) console.error("[flick-daily] read", error.message); return null; }
    const better = !data || e.best > data.best;
    const row = { day, player_key: e.key, user_id: e.isGuest ? null : e.key, guest_id: e.isGuest ? e.key : null, nickname: String(e.name || "").slice(0, 14), best: better ? e.best : data.best, win: better ? !!e.win : undefined, tries: (data?.tries || 0) + 1, updated_at: new Date().toISOString() };
    if (row.win === undefined) delete row.win;
    const { error: e2 } = await SA.from(TD).upsert(row, { onConflict: "day,player_key" }); if (e2) { if (!offline(e2)) console.error("[flick-daily] write", e2.message); return null; }
    dAt = 0; return { best: row.best, newBest: better, tries: row.tries, score: e.best };
  }
  async function dailyTop(key) {
    if (!up()) return { ok: false, error: "NOT_READY" }; const day = todayKst();
    if (!dBoard || dDay !== day || Date.now() - dAt > 20_000) {
      const { data, error } = await SA.from(TD).select("player_key, user_id, guest_id, nickname, best, win, tries").eq("day", day).order("best", { ascending: false }).limit(50);
      if (error) { if (!offline(error)) console.error("[flick-daily] top", error.message); return { ok: false, error: "BUSY" }; }
      dBoard = (await withProfiles(data || [])).map((r, i) => ({ rank: i + 1, name: r.name, avatar: r.avatar, best: r.best, win: !!r.win, tries: r.tries, guest: !!r.guest_id, k: r.player_key })); dDay = day; dAt = Date.now();
    }
    const mine = dBoard.find(r => r.k === key);
    return { ok: true, day, list: dBoard.map(({ k, ...r }) => ({ ...r, me: k === key })), me: mine ? { rank: mine.rank, best: mine.best } : null };
  }
  return { load, titleOf, record, setEquip, starsTop, dailyRecord, dailyTop, isReady: up };
}
