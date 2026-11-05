// =========================
// 인생 방송국 — 서버 저장 (lbs:*)
// 회원만. 칸 0 = 아침 자동 저장, 1~3 = 직접 저장. 브라우저 저장은 그대로 두고 '추가로' 서버에도 보관.
// DB: lifebc_saves (sql/lifebc_saves.sql, RLS 켬·정책 0 = 서버 전용)
// 테이블이 아직 없으면 NO_TABLE을 돌려주고 조용히 꺼져 있음 (10분마다 다시 확인)
// =========================
const MAX_BYTES = 450000, SAVE_GAP = 15000;
let noTableUntil = 0;
const isNoTable = (e) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache/i.test(e.message || ""));
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f<>`]/g, "").trim().slice(0, n);
const nameOf = (v) => (typeof v === "string" ? v : v && typeof v === "object" ? v.ko || v.en || v.ja || "" : "");

// 저장 내용 검사: 우리 게임 상태 모양인지 · 메타는 서버가 직접 뽑음 (클라가 보낸 값 안 믿음)
export function inspectSave(json) {
  if (typeof json !== "string") return { error: "BAD_DATA" };
  const bytes = Buffer.byteLength(json, "utf8"); if (bytes > MAX_BYTES) return { error: "TOO_BIG" };
  let S; try { S = JSON.parse(json); } catch { return { error: "BAD_JSON" }; }
  if (!S || typeof S !== "object" || !Array.isArray(S.cast) || !S.rels || typeof S.day !== "number" || typeof S.money !== "number") return { error: "BAD_SHAPE" };
  return { meta: { station_name: clean(nameOf(S.stationName), 40), mode: S.mode === "free" ? "free" : "story", day: Math.max(1, Math.min(100000, S.day | 0)), money: Math.round(Math.max(-1e12, Math.min(1e12, S.money))), ver: S.ver | 0 || 1, bytes } };
}

export function registerLifeSave(io, sb) {
  const lastSave = new Map();
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const member = !me.isGuest, key = "u:" + me.id;
    let win = Date.now(), cnt = 0;
    const on = (ev, fn) => socket.on(ev, async (p, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      const t = Date.now(); if (t - win > 60000) { win = t; cnt = 0; } if (++cnt > 40) return reply({ ok: false, error: "RATE_LIMITED" });
      if (!member) return reply({ ok: false, error: "NEED_LOGIN" });
      if (!sb) return reply({ ok: false, error: "NO_DB" });
      if (Date.now() < noTableUntil) return reply({ ok: false, error: "NO_TABLE" });
      try { await fn(p && typeof p === "object" ? p : {}, reply); }
      catch (e) { if (isNoTable(e)) { noTableUntil = Date.now() + 600e3; return reply({ ok: false, error: "NO_TABLE" }); } console.warn("[lbs]", ev, e?.message); reply({ ok: false, error: "SERVER_ERROR" }); }
    });
    const slotOf = (p) => { const s = Number(p.slot); return Number.isInteger(s) && s >= 0 && s <= 3 ? s : null; };
    const chk = (error) => { if (error) { if (isNoTable(error)) { noTableUntil = Date.now() + 600e3; const e = new Error("NO_TABLE"); e.code = "42P01"; throw e; } throw error; } };

    on("lbs:list", async (p, reply) => {
      const { data, error } = await sb.from("lifebc_saves").select("slot, station_name, mode, day, money, bytes, updated_at").eq("owner_key", key).order("slot"); chk(error);
      reply({ ok: true, slots: data || [] });
    });
    on("lbs:save", async (p, reply) => {
      const slot = slotOf(p); if (slot == null) return reply({ ok: false, error: "BAD_SLOT" });
      const gap = Date.now() - (lastSave.get(key + ":" + slot) || 0); if (gap < SAVE_GAP) return reply({ ok: false, error: "TOO_SOON", wait: Math.ceil((SAVE_GAP - gap) / 1000) });
      const r = inspectSave(p.json); if (r.error) return reply({ ok: false, error: r.error });
      const row = { owner_key: key, slot, user_id: me.id, ...r.meta, data: p.json, updated_at: new Date().toISOString() };
      const { error } = await sb.from("lifebc_saves").upsert(row, { onConflict: "owner_key,slot" }); chk(error);
      lastSave.set(key + ":" + slot, Date.now()); if (lastSave.size > 20000) lastSave.clear();
      reply({ ok: true, slot, meta: r.meta });
    });
    on("lbs:load", async (p, reply) => {
      const slot = slotOf(p); if (slot == null) return reply({ ok: false, error: "BAD_SLOT" });
      const { data, error } = await sb.from("lifebc_saves").select("data, updated_at").eq("owner_key", key).eq("slot", slot).maybeSingle(); chk(error);
      if (!data) return reply({ ok: false, error: "EMPTY" });
      reply({ ok: true, json: data.data, updated_at: data.updated_at });
    });
    on("lbs:delete", async (p, reply) => {
      const slot = slotOf(p); if (slot == null) return reply({ ok: false, error: "BAD_SLOT" });
      const { error } = await sb.from("lifebc_saves").delete().eq("owner_key", key).eq("slot", slot); chk(error);
      reply({ ok: true });
    });
  });
}
