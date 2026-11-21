// =========================
// 증강 슬롯 타워 — 오늘의 도전 랭킹 (2026-11-21) · 표 slot_daily (날짜+사람당 1줄, 그날 최고만)
// · 모두 같은 날은 같은 씨앗(한국 날짜) → 같은 첫 릴. 서버가 끝난 판의 값으로만 기록
// =========================
const T = "slot_daily";
const KEY_RE = /^(guest_[A-Za-z0-9_-]{4,74}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
/** 한국 날짜 (YYYY-MM-DD) */
export const todayKst = (t = Date.now()) => new Date(t + 9 * 3600_000).toISOString().slice(0, 10);
/** 날짜 → 씨앗 */
export const daySeed = (day) => { let h = 2166136261; for (const ch of "duo-slot-" + day) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export function createDaily(SA) {
  let down = 0, board = null, boardDay = "", boardAt = 0;
  const up = () => !!SA && (!down || Date.now() - down > 5 * 60_000);
  const offline = (e) => { if (/does not exist|schema cache|relation/i.test(e?.message || "")) { down = Date.now(); return true; } return false; };
  async function record(e) {
    if (!up() || !KEY_RE.test(e.key || "")) return null; const day = todayKst();
    const { data, error } = await SA.from(T).select("best, tries").eq("day", day).eq("player_key", e.key).maybeSingle();
    if (error) { if (!offline(error)) console.error("[slot-daily] read", error.message); return null; }
    const better = !data || e.best > data.best, row = { day, player_key: e.key, user_id: e.isGuest ? null : e.key, guest_id: e.isGuest ? e.key : null, nickname: String(e.name || "").slice(0, 14), best: better ? e.best : data.best, floor: better ? e.floor : undefined, tries: (data?.tries || 0) + 1, updated_at: new Date().toISOString() };
    if (row.floor === undefined) delete row.floor;
    const { error: e2 } = await SA.from(T).upsert(row, { onConflict: "day,player_key" }); if (e2) { if (!offline(e2)) console.error("[slot-daily] write", e2.message); return null; }
    boardAt = 0; return { best: row.best, newBest: better, tries: row.tries };
  }
  async function top(key) {
    if (!up()) return { ok: false, error: "NOT_READY" }; const day = todayKst();
    if (!board || boardDay !== day || Date.now() - boardAt > 20_000) {
      const { data, error } = await SA.from(T).select("player_key, user_id, nickname, best, floor, tries, guest_id").eq("day", day).order("best", { ascending: false }).limit(50);
      if (error) { if (!offline(error)) console.error("[slot-daily] top", error.message); return { ok: false, error: "BUSY" }; }
      const ids = (data || []).map(r => r.user_id).filter(Boolean), prof = new Map();
      if (ids.length) { try { const { data: ps } = await SA.from("profiles").select("id, nickname, avatar_url").in("id", ids); for (const p of ps || []) prof.set(p.id, p); } catch {} }
      board = (data || []).map((r, i) => { const p = r.user_id ? prof.get(r.user_id) : null; return { rank: i + 1, name: (p?.nickname || r.nickname || "?").slice(0, 20), avatar: p?.avatar_url || null, best: r.best, floor: r.floor, tries: r.tries, guest: !!r.guest_id, k: r.player_key }; }); boardDay = day; boardAt = Date.now();
    }
    const mine = board.find(r => r.k === key);
    return { ok: true, day, list: board.map(({ k, ...r }) => ({ ...r, me: k === key })), me: mine ? { rank: mine.rank, best: mine.best } : null };
  }
  return { record, top };
}
