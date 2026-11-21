// =========================
// 증강 물고기 키우기 — 업적·꾸미기 기록 (2026-11-21, 서바이벌과 같은 방식)
// · 표: sql/aq_progress_20261121.sql (aq_progress, 사람당 1줄, 회원=user_id / 게스트=guest_id)
// · 판이 끝나면 게임 서버가 확정한 결과로만 더함 (화면이 보낸 숫자는 안 씀)
// · 꾸미기(색·칭호)는 깬 업적으로만 고를 수 있음 → 서버가 확인
// · 표가 아직 없거나 DB가 느려도 게임은 그대로 (조용히 건너뜀)
// =========================
import { achApply, achDone, achEquip, ACHS } from "./aq-data.js";

const T = "aq_progress";
const KEY_RE = /^(guest_[A-Za-z0-9_-]{4,74}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const CACHE_MS = 10 * 60_000;
export const validKey = (k) => typeof k === "string" && KEY_RE.test(k);
const isUuid = (k) => /^[0-9a-f]{8}-/i.test(k) && !k.startsWith("guest_");
const empty = (key) => ({ player_key: key, stats: {}, unlocked: [], equip: {}, ach_count: 0, plays: 0 });

export function createProgress(SA) {
  const cache = new Map(); // key → { row, at }
  let down = 0, warned = false; // 표가 없으면 5분 동안 쉬었다가 다시 시도 (SQL 적용 뒤 서버 재시작 없이 붙음)
  const up = () => !!SA && (!down || Date.now() - down > 5 * 60_000);
  const offline = (error) => { if (/does not exist|schema cache|relation/i.test(error?.message || "")) { if (!warned) { warned = true; console.warn("[aq-progress] 표 없음 — sql/aq_progress_20261121.sql 적용 전"); } down = Date.now(); return true; } return false; };
  const put = (row) => { cache.set(row.player_key, { row, at: Date.now() }); if (cache.size > 20000) { const old = Date.now() - CACHE_MS; for (const [k, v] of cache) if (v.at < old) cache.delete(k); } };

  async function load(key, { fresh = false } = {}) {
    if (!validKey(key)) return null;
    const c = cache.get(key); if (c && !fresh && Date.now() - c.at < CACHE_MS) return c.row;
    if (!up()) return c?.row || empty(key);
    const { data, error } = await SA.from(T).select("player_key, stats, unlocked, equip, ach_count, plays").eq("player_key", key).maybeSingle();
    if (error) { if (!offline(error)) { console.error("[aq-progress] read", error.message); return c?.row || { ...empty(key), failed: true }; } return c?.row || empty(key); }
    down = 0; const row = data || empty(key); put(row); return row;
  }
  /** 캐시에 있는 꾸미기 (방 자리 만들 때 바로 씀) */
  const cosOf = (key) => { const row = cache.get(key)?.row; if (!row) return null; const e = achEquip(row.unlocked, row.equip); return e.c || e.t ? e : null; };

  /** 판 결과 기록. entries: [{ key, isGuest, name, run }] → Map(key → { newly: [업적 id], unlocked, count }) */
  async function record(entries) {
    const out = new Map();
    const list = entries.filter(e => validKey(e.key) && (e.isGuest ? e.key.startsWith("guest_") : isUuid(e.key)));
    if (!up() || !list.length) return out;
    const keys = list.map(e => e.key);
    const { data, error } = await SA.from(T).select("player_key, stats, unlocked, equip, ach_count, plays").in("player_key", keys);
    if (error) { if (!offline(error)) console.error("[aq-progress] read many", error.message); return out; }
    const old = new Map((data || []).map(d => [d.player_key, d])), rows = [], nowIso = new Date().toISOString();
    for (const e of list) {
      const o = old.get(e.key) || empty(e.key);
      const stats = achApply(o.stats, e.run), done = achDone(stats), had = new Set(o.unlocked || []);
      const unlocked = [...new Set([...(o.unlocked || []), ...done])].filter(id => ACHS.some(a => a.id === id));
      const newly = unlocked.filter(id => !had.has(id));
      rows.push({ player_key: e.key, user_id: e.isGuest ? null : e.key, guest_id: e.isGuest ? e.key : null, nickname: String(e.name || "").slice(0, 14) || null, stats, unlocked, ach_count: unlocked.length, plays: stats.plays || 0, updated_at: nowIso });
      out.set(e.key, { newly, unlocked, count: unlocked.length, stats });
    }
    let saved = rows;
    const { error: e2 } = await SA.from(T).upsert(rows, { onConflict: "player_key" });
    if (e2) {
      if (offline(e2)) { out.clear(); return out; }
      console.error("[aq-progress] write", e2.message);
      saved = [];
      for (const r of rows) { const { error: e3 } = await SA.from(T).upsert([r], { onConflict: "player_key" }); if (e3) { console.error("[aq-progress] write one", r.player_key.slice(0, 12), e3.message); out.delete(r.player_key); } else saved.push(r); }
    }
    for (const r of saved) put({ player_key: r.player_key, stats: r.stats, unlocked: r.unlocked, equip: old.get(r.player_key)?.equip || cache.get(r.player_key)?.row?.equip || {}, ach_count: r.ach_count, plays: r.plays });
    return out;
  }

  /** 꾸미기 바꾸기 (깬 업적 것만). 반환: { ok, equip } */
  async function setEquip(key, isGuest, want) {
    if (!validKey(key)) return { ok: false, error: "NO_PLAYER" };
    const row = await load(key, { fresh: true }); if (!row) return { ok: false, error: "NO_PLAYER" };
    if (row.failed) return { ok: false, error: "BUSY" };
    const eq = achEquip(row.unlocked, want);
    if (!up()) return { ok: false, error: "NOT_READY" };
    if (!(row.unlocked || []).length) return { ok: true, equip: eq }; // 아직 깬 업적 없음 → 저장할 것 없음
    const { error } = await SA.from(T).update({ equip: eq }).eq("player_key", key);
    if (error) { if (!offline(error)) console.error("[aq-progress] equip", error.message); return { ok: false, error: "INTERNAL" }; }
    put({ ...row, equip: eq }); return { ok: true, equip: eq };
  }
  return { load, cosOf, record, setEquip, isReady: up };
}
