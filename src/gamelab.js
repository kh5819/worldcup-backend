// 플듀 게임 종합 진단소 — 결과 저장·조회. 점수는 클라이언트 값을 믿지 않고 게임 원자료(raw)로 서버가 다시 계산.
// DB: gamelab_results (sql/gamelab_tables.sql, RLS 켬·정책 0 = 서버 전용). 기존 게임 테이블은 읽지도 쓰지도 않음.
// 한계: 게임이 브라우저에서 돌기 때문에 raw 자체는 조작될 수 있음 → verified=false, 명백히 불가능한 값은 flagged(칭호 제외)
import { randomBytes } from "crypto";
import * as C from "./gamelab-core.js";
import { memberProfile } from "./clinic.js";

let HOOKS = null;
export const setGamelabHooks = (h) => { HOOKS = h; };
const newId = () => randomBytes(6).toString("base64url").replace(/[-_]/g, "x").slice(0, 10);
export const newResultId = () => newId();
/** 요청한 사람의 기록 주인 키 (회원 u: / 게스트 g:) */
export async function ownerOf(req, getOptionalUser) { const user = getOptionalUser ? await getOptionalUser(req) : null; if (user) return `u:${user.id}`; const g = String(req.headers["x-iq-guest"] || "").slice(0, 64); return /^guest_[a-z0-9]{4,40}$/i.test(g) ? `g:${g}` : null; }
/** gamelab_results 한 행 (혼자·대결·방송 공용) */
export function buildRow({ id, key, userId, nickname, mode, diff, plan, sum, raws, flags, isPublic, isStreamer, durationMs, groupId = null, bcId = null }) { return { id, owner_key: key, user_id: userId || null, nickname: cleanNick(nickname), mode, diff, ver: C.VER, plan, scores: sum.scores, raws, flags, total: sum.total, tier: sum.tier, type: sum.type, areas: sum.areas, done: sum.done, of_count: sum.of, is_public: isPublic !== false, is_streamer: !!isStreamer, flagged: Object.keys(flags || {}).length > 0, verified: false, duration_ms: Math.max(0, Math.min(1e8, Number(durationMs) || 0)), group_id: groupId, bc_id: bcId }; }
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
      const bcId = b.bc ? String(b.bc).slice(0, 16) : null; let bcGate = null;
      if (bcId) { if (!HOOKS) return res.json({ ok: false, error: "BC_NOT_FOUND" }); bcGate = await HOOKS.check(bcId, key, { mode, diff, plan: b.plan }, b.startedAt); if (!bcGate.ok) return res.json({ ok: false, error: bcGate.error }); }
      const id = newId(), nickname = cleanNick(mp?.nickname || b.nick), isStreamer = bcId ? !!bcGate.isOwner : !!b.streamer, flagged = Object.keys(flags).length > 0;
      const row = { id, owner_key: key, user_id: user?.id || null, nickname, mode, diff, ver: C.VER, plan: b.plan, scores: sum.scores, raws, flags, total: sum.total, tier: sum.tier, type: sum.type, areas: sum.areas, done: sum.done, of_count: sum.of, is_public: b.isPublic !== false, is_streamer: isStreamer, flagged, verified: false, duration_ms: Math.max(0, Math.min(1e8, Number(b.durationMs) || 0)), bc_id: bcId };
      if (!sb) return res.json({ ok: false, error: "NO_DB" });
      const { error } = await sb.from("gamelab_results").insert(row);
      if (error) { if (bcId && String(error.code) === "23505") return res.json({ ok: false, error: "ALREADY" }); console.error("[gamelab] save", error.message); return res.json({ ok: false, error: "SAVE_FAIL" }); }
      const bcInfo = bcId ? HOOKS.done(bcId, { ...row, created_at: new Date().toISOString() }) : null;
      if (isStreamer && !bcId) {
        const names = { quick: "빠른 검사", full: "전체 검사", single: `${C.byId[b.plan[0]]?.name} 도전` };
        sb.from("streamer_chat_log").insert({ platform: "gamelab", channel_id: id, nickname, content_id: null, content_title: `게임 종합 진단소 · ${names[mode]} · ${C.DIFF_NAME[diff]} · ${sum.total}점 ${sum.tier}`, content_mode: mode, room_code: id, host_user_id: user?.id || null, host_nick: user ? nickname : null }).then(({ error: le }) => { if (le) console.error("[gamelab] streamer log", le.message); }, () => {});
      }
      res.json({ ok: true, id, total: sum.total, tier: sum.tier, flagged, bc: bcInfo });
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
  // 랭킹: 전체·빠른 검사 × 난이도. 모든 미션을 측정한 공개 기록, 한 사람 최고 1개. verified=true 기록은 board=verified 로만
  app.get("/gamelab/ranking", async (req, res) => {
    try {
      if (!sb) return res.json({ ok: true, rows: [] });
      const mode = req.query.mode === "quick" ? "quick" : "full", diff = C.DIFFS.includes(req.query.diff) ? req.query.diff : "normal", verified = req.query.board === "verified";
      const { data, error } = await sb.from("gamelab_results").select("id, owner_key, nickname, total, tier, type, done, of_count, is_streamer, created_at").eq("mode", mode).eq("diff", diff).eq("is_public", true).eq("flagged", false).eq("verified", verified).order("total", { ascending: false }).limit(500);
      if (error) return res.json({ ok: false, error: "LOAD_FAIL" });
      const seen = new Set(), rows = [];
      for (const r of data || []) { if (r.tier === C.UNRATED || r.done < r.of_count || seen.has(r.owner_key)) continue; seen.add(r.owner_key); rows.push({ rank: rows.length + 1, id: r.id, nick: r.nickname, total: r.total, tier: r.tier, type: r.type, streamer: !!r.is_streamer }); if (rows.length >= 50) break; }
      res.set("Cache-Control", "public, max-age=15"); res.json({ ok: true, mode, diff, board: verified ? "verified" : "normal", rows });
    } catch (e) { console.error("[gamelab/ranking]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
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
