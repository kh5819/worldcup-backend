// =========================
// 플듀 끝말잇기 — 오늘의 도전 (2026-11-22) · 표 wd_daily (날짜+사람당 1줄, 그날 최고만)
// · 혼자 잇기: 내 단어의 끝 글자로 내가 계속 이어 감. 하트 3
// · 같은 날은 모두 같은 시작 글자 순서(한국 날짜 씨앗) + 같은 오늘의 규칙(dailyRules)
// · 서버가 끝난 판의 값으로만 기록 · 표가 없거나 DB가 느려도 게임은 그대로
// =========================
import { todayKst, daySeed, dailyRules } from "./wd-ach.js";
export { todayKst, daySeed, dailyRules };
const T = "wd_daily";
const KEY_RE = /^(guest_[A-Za-z0-9_-]{4,74}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
/** 씨앗 → 0~1 난수 (mulberry32) */
export function seededRng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function createDaily(SA) {
  let down = 0, board = null, boardDay = "", boardAt = 0;
  const up = () => !!SA && (!down || Date.now() - down > 5 * 60_000);
  const offline = (e) => { if (/does not exist|schema cache|relation/i.test(e?.message || "")) { down = Date.now(); return true; } return false; };
  /** e: { key, isGuest, name, best, words, day } */
  async function record(e) {
    if (!up() || !KEY_RE.test(e.key || "") || !(e.best >= 0)) return null; const day = e.day || todayKst();
    const { data, error } = await SA.from(T).select("best, tries").eq("day", day).eq("player_key", e.key).maybeSingle();
    if (error) { if (!offline(error)) console.error("[wd-daily] read", error.message); return null; }
    const better = !data || e.best > data.best, row = { day, player_key: e.key, user_id: e.isGuest ? null : e.key, guest_id: e.isGuest ? e.key : null, nickname: String(e.name || "").slice(0, 14), best: better ? Math.round(e.best) : data.best, words: better ? e.words | 0 : undefined, tries: (data?.tries || 0) + 1, updated_at: new Date().toISOString() };
    if (row.words === undefined) delete row.words;
    const { error: e2 } = await SA.from(T).upsert(row, { onConflict: "day,player_key" }); if (e2) { if (!offline(e2)) console.error("[wd-daily] write", e2.message); return null; }
    boardAt = 0; return { best: row.best, newBest: better, tries: row.tries };
  }
  async function top(key) {
    if (!up()) return { ok: false, error: "NOT_READY" }; const day = todayKst();
    if (!board || boardDay !== day || Date.now() - boardAt > 20_000) {
      const { data, error } = await SA.from(T).select("player_key, user_id, nickname, best, words, tries, guest_id").eq("day", day).order("best", { ascending: false }).order("updated_at", { ascending: true }).limit(50);
      if (error) { if (!offline(error)) console.error("[wd-daily] top", error.message); return { ok: false, error: "BUSY" }; }
      const ids = (data || []).map(r => r.user_id).filter(Boolean), prof = new Map();
      if (ids.length) { try { const { data: ps } = await SA.from("profiles").select("id, nickname, avatar_url").in("id", ids); for (const p of ps || []) prof.set(p.id, p); } catch {} }
      board = (data || []).map((r, i) => { const p = r.user_id ? prof.get(r.user_id) : null; return { rank: i + 1, name: (p?.nickname || r.nickname || "?").slice(0, 20), avatar: p?.avatar_url || null, best: r.best, words: r.words, tries: r.tries, guest: !!r.guest_id, k: r.player_key }; }); boardDay = day; boardAt = Date.now();
    }
    const mine = board.find(r => r.k === key);
    return { ok: true, day, rules: dailyRules(day), list: board.map(({ k, ...r }) => ({ ...r, me: k === key })), me: mine ? { rank: mine.rank, best: mine.best } : null };
  }
  return { record, top };
}
