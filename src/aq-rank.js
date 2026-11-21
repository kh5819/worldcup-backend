// =========================
// 증강 물고기 키우기 — 최고 크기 랭킹 (2026-11-21)
// · 표: sql/aq_best_20261121.sql (aq_best, 사람당 1줄, 회원=user_id / 게스트=guest_id). RLS만 켜고 정책 없음 → 서버(service key)만 읽고 씀
// · 판이 끝나면 게임 서버가 확정한 값(최고 크기·먹은 물고기)으로만 기록 (화면이 보낸 숫자는 안 씀)
// · 표가 아직 없거나 DB가 느려도 게임은 그대로 (조용히 건너뛰고 5분 뒤 다시 시도)
// =========================
const T = "aq_best";
const KEY_RE = /^(guest_[A-Za-z0-9_-]{4,74}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
export const validKey = (k) => typeof k === "string" && KEY_RE.test(k);
const isUuid = (k) => /^[0-9a-f]{8}-/i.test(k) && !k.startsWith("guest_");
export const TOP_N = 50;
const MAX_SANE = 20000; // 이보다 크면 이상한 값 (크기 상한 8,400)

export function createRank(SA) {
  let down = 0, warned = false, board = null, boardAt = 0;
  const up = () => !!SA && (!down || Date.now() - down > 5 * 60_000);
  const offline = (error) => { if (/does not exist|schema cache|relation/i.test(error?.message || "")) { if (!warned) { warned = true; console.warn("[aq-rank] 표 없음 — sql/aq_best_20261121.sql 적용 전"); } down = Date.now(); return true; } return false; };

  /** entries: [{ key, isGuest, name, best, eats, mode }] → Map(key → { best, prev, rank? }) */
  async function record(entries) {
    const out = new Map();
    const list = entries.filter(e => validKey(e.key) && (e.isGuest ? e.key.startsWith("guest_") : isUuid(e.key)) && e.best > 0 && e.best < MAX_SANE);
    if (!up() || !list.length) return out;
    const { data, error } = await SA.from(T).select("player_key, best, eats, games").in("player_key", list.map(e => e.key));
    if (error) { if (!offline(error)) console.error("[aq-rank] read", error.message); return out; }
    const old = new Map((data || []).map(d => [d.player_key, d])), rows = [], nowIso = new Date().toISOString();
    for (const e of list) {
      const o = old.get(e.key), prev = o?.best || 0, better = Math.round(e.best) > prev;
      rows.push({ player_key: e.key, user_id: e.isGuest ? null : e.key, guest_id: e.isGuest ? e.key : null, nickname: String(e.name || "").slice(0, 14) || null,
        best: better ? Math.round(e.best) : prev, eats: better ? e.eats | 0 : o?.eats || 0, games: (o?.games || 0) + 1, mode: better ? String(e.mode || "ffa").slice(0, 8) : undefined, best_at: better ? nowIso : undefined, updated_at: nowIso });
      out.set(e.key, { best: Math.max(prev, Math.round(e.best)), prev, newBest: better });
    }
    for (const r of rows) { for (const k of Object.keys(r)) if (r[k] === undefined) delete r[k]; }
    const { error: e2 } = await SA.from(T).upsert(rows, { onConflict: "player_key" });
    if (e2) {
      if (offline(e2)) { out.clear(); return out; }
      console.error("[aq-rank] write", e2.message);
      for (const r of rows) { const { error: e3 } = await SA.from(T).upsert([r], { onConflict: "player_key" }); if (e3) { console.error("[aq-rank] write one", r.player_key.slice(0, 12), e3.message); out.delete(r.player_key); } }
    }
    if (out.size) boardAt = 0; // 순위표 새로
    return out;
  }
  /** TOP 50 + 내 순위 */
  async function top(key) {
    if (!up()) return { ok: false, error: down ? "NOT_READY" : "NO_DB" };
    if (!board || Date.now() - boardAt > 20_000) {
      const { data, error } = await SA.from(T).select("player_key, nickname, best, eats, games, best_at, guest_id").order("best", { ascending: false }).order("best_at", { ascending: true }).limit(TOP_N);
      if (error) { if (!offline(error)) console.error("[aq-rank] top", error.message); return { ok: false, error: "BUSY" }; }
      board = (data || []).map((r, i) => ({ rank: i + 1, name: r.nickname || "?", best: r.best, eats: r.eats, games: r.games, guest: !!r.guest_id, k: r.player_key })); boardAt = Date.now();
    }
    let me = null;
    if (validKey(key)) {
      const mine = board.find(r => r.k === key);
      if (mine) me = { rank: mine.rank, best: mine.best };
      else { const { data } = await SA.from(T).select("best").eq("player_key", key).maybeSingle(); if (data?.best) { const { count } = await SA.from(T).select("player_key", { count: "exact", head: true }).gt("best", data.best); me = { rank: (count || 0) + 1, best: data.best }; } }
    }
    return { ok: true, list: board.map(({ k, ...r }) => ({ ...r, me: k === key })), me };
  }
  return { record, top, isReady: up };
}
