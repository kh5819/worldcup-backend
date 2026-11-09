// 플듀 게임 종합 진단소 — 결과 저장·조회. 점수는 클라이언트 값을 믿지 않고 게임 원자료(raw)로 서버가 다시 계산.
// DB: gamelab_results (sql/gamelab_tables.sql, RLS 켬·정책 0 = 서버 전용). 기존 게임 테이블은 읽지도 쓰지도 않음.
// 한계: 게임이 브라우저에서 돌기 때문에 raw 자체는 조작될 수 있음 → verified=false, 명백히 불가능한 값은 flagged(칭호 제외)
import { randomBytes } from "crypto";
import * as C from "./gamelab-core.js";
import { memberProfile } from "./clinic.js";

const newId = () => randomBytes(6).toString("base64url").replace(/[-_]/g, "x").slice(0, 10);
const cleanNick = (s) => String(s || "").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 14) || "플레이어";
const planOk = (mode, plan) => {
  if (!Array.isArray(plan)) return false;
  if (mode === "single") return plan.length === 1 && !!C.byId[plan[0]];
  const want = mode === "quick" ? C.QUICK : mode === "full" ? C.FULL : null;
  return !!want && plan.length === want.length && plan.every((id, i) => id === want[i]);
};
/** 게임이 낼 수 없는 값이면 사유 — 점수가 낮은 건 문제 삼지 않음 */
export function suspicious(id, diff, raw) {
  const m = C.byId[id], c = C.cfgOf(id, diff), t = Number(raw?.t) || 0;
  if (!raw || typeof raw !== "object") return "BAD_RAW";
  if (m.kind === "survive" && raw.ok && t < c.goal - 1) return "TOO_SHORT";
  if (m.kind === "reach" && raw.ok && t < 3) return "TOO_QUICK";
  if (m.kind === "golf" && Number(raw.done) >= c.holes && Number(raw.strokes) < c.holes) return "BAD_STROKES";
  return null;
}
const hits = new Map();
const limited = (key) => { const now = Date.now(), a = (hits.get(key) || []).filter((t) => now - t < 60000); a.push(now); hits.set(key, a); if (hits.size > 5000) hits.clear(); return a.length > 12; };

export function registerGamelab(app, sb, { getOptionalUser } = {}) {
  if (!app) return;
  app.post("/gamelab/result", async (req, res) => {
    try {
      const b = req.body || {}, mode = String(b.mode || ""), diff = C.DIFFS.includes(b.diff) ? b.diff : null;
      if (!diff || !planOk(mode, b.plan)) return res.status(400).json({ ok: false, error: "BAD_REQUEST" });
      const user = getOptionalUser ? await getOptionalUser(req) : null;
      const guest = String(req.headers["x-iq-guest"] || "").slice(0, 64);
      if (!user && !/^guest_[a-z0-9]{4,40}$/i.test(guest)) return res.status(400).json({ ok: false, error: "NO_OWNER" });
      const key = user ? `u:${user.id}` : `g:${guest}`;
      if (limited(key)) return res.status(429).json({ ok: false, error: "RATE" });
      const inRaw = b.raws && typeof b.raws === "object" ? b.raws : {};
      if (JSON.stringify(inRaw).length > 8000) return res.status(413).json({ ok: false, error: "TOO_BIG" });
      const results = {}, flags = {}, raws = {};
      for (const id of b.plan) { const raw = inRaw[id]; if (!raw) continue; const why = suspicious(id, diff, raw); if (why) flags[id] = why; results[id] = C.scoreMission(id, diff, raw); raws[id] = raw; }
      const sum = C.summarize(b.plan, results);
      if (!sum.done) return res.status(400).json({ ok: false, error: "NOTHING_MEASURED" });
      const mp = user && sb ? await memberProfile(sb, { id: user.id, isGuest: false }) : null;   // 회원은 프로필 닉네임이 우선
      const id = newId(), nickname = cleanNick(mp?.nickname || b.nick), isStreamer = !!b.streamer, flagged = Object.keys(flags).length > 0;
      const row = { id, owner_key: key, user_id: user?.id || null, nickname, mode, diff, ver: C.VER, plan: b.plan, scores: sum.scores, raws, flags, total: sum.total, tier: sum.tier, type: sum.type, areas: sum.areas, done: sum.done, of_count: sum.of, is_public: b.isPublic !== false, is_streamer: isStreamer, flagged, verified: false, duration_ms: Math.max(0, Math.min(1e8, Number(b.durationMs) || 0)) };
      if (!sb) return res.json({ ok: false, error: "NO_DB" });
      const { error } = await sb.from("gamelab_results").insert(row);
      if (error) { console.error("[gamelab] save", error.message); return res.json({ ok: false, error: "SAVE_FAIL" }); }
      if (isStreamer) {
        const names = { quick: "빠른 검사", full: "전체 검사", single: `${C.byId[b.plan[0]]?.name} 도전` };
        sb.from("streamer_chat_log").insert({ platform: "gamelab", channel_id: id, nickname, content_id: null, content_title: `게임 종합 진단소 · ${names[mode]} · ${C.DIFF_NAME[diff]} · ${sum.total}점 ${sum.tier}`, content_mode: mode, room_code: id, host_user_id: user?.id || null, host_nick: user ? nickname : null }).then(({ error: le }) => { if (le) console.error("[gamelab] streamer log", le.message); }, () => {});
      }
      res.json({ ok: true, id, total: sum.total, tier: sum.tier, flagged });
    } catch (e) { console.error("[gamelab/result]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  // 로그인하면 이 기기의 게스트 기록을 내 계정으로 (다른 진단소의 mergeGuest와 같은 규칙)
  app.post("/gamelab/merge", async (req, res) => {
    try {
      const user = getOptionalUser ? await getOptionalUser(req) : null; if (!user) return res.status(401).json({ ok: false, error: "LOGIN_REQUIRED" });
      if (!sb) return res.json({ ok: false, error: "NO_DB" });
      const gid = String(req.headers["x-iq-guest"] || ""); if (!/^guest_[a-z0-9]{4,40}$/i.test(gid)) return res.status(400).json({ ok: false, error: "BAD_GUEST" });
      const mp = await memberProfile(sb, { id: user.id, isGuest: false });
      const { data: moved, error } = await sb.from("gamelab_results").update({ owner_key: `u:${user.id}`, user_id: user.id, ...(mp?.nickname ? { nickname: cleanNick(mp.nickname) } : {}) }).eq("owner_key", `g:${gid}`).select("id");
      if (error) return res.json({ ok: false, error: "UPDATE_FAIL" });
      res.json({ ok: true, moved: moved?.length || 0 });
    } catch (e) { console.error("[gamelab/merge]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
  app.get("/gamelab/result/:id", async (req, res) => {
    try {
      if (!sb) return res.json({ ok: false, error: "NO_DB" });
      const { data: r, error } = await sb.from("gamelab_results").select("id, owner_key, nickname, mode, diff, plan, scores, total, tier, type, areas, done, of_count, is_public, is_streamer, flagged, created_at").eq("id", String(req.params.id || "").slice(0, 16)).maybeSingle();
      if (error) return res.json({ ok: false, error: "LOAD_FAIL" });
      if (!r) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      const user = getOptionalUser ? await getOptionalUser(req) : null, g = String(req.headers["x-iq-guest"] || ""), mine = (user && r.owner_key === `u:${user.id}`) || (g && r.owner_key === `g:${g}`);
      if (!r.is_public && !mine) return res.status(403).json({ ok: false, error: "PRIVATE" });
      const { owner_key, ...pub } = r; void owner_key;
      res.json({ ok: true, result: { ...pub, mine: !!mine } });
    } catch (e) { console.error("[gamelab/get]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });
}
