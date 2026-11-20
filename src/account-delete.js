// =========================
// 회원탈퇴 (2026-11-20)
// 정책: 제작 콘텐츠는 남기고 작성자만 '삭제된 계정' · 개인정보(프로필·사진·기록·로그인 계정) 삭제 · 재가입은 새 계정
// 보안 (본인 계정이 갑자기 지워지지 않게)
//  1) 로그인 토큰(Authorization 헤더)만 받음 → 다른 사이트가 몰래 요청 못 함 (쿠키 안 씀)
//  2) 본인 재확인: 비밀번호 재입력 또는 10분 안에 다시 로그인한 토큰(amr 시각)
//  3) 2단계: request(재확인) → 5분짜리 1회용 확인권 → confirm(확인권 + "탈퇴합니다" 직접 입력)
//  4) 시도 제한(회원·IP별) · 관리자 계정 탈퇴 불가 · 같은 회원 동시 요청 막음
// 처리 순서 (실패해도 '개인정보는 남고 계정만 삭제' / '콘텐츠 삭제'가 안 생기게)
//  ① 기록(account_deletions) 시작 → ② DB 함수 account_delete_data (한 트랜잭션: 콘텐츠 이전·익명화·개인 기록 삭제·프로필 삭제, 실패 시 전부 되돌림)
//  → ③ 이 회원 토큰 즉시 차단 → ④ 프로필 사진 파일 삭제 → ⑤ 로그인 계정 삭제(Auth) → 실패하면 10분마다 재시도 → ⑥ 완료(회원 번호 기록 지움)
// =========================
import crypto from "crypto";

export const DELETE_PHRASE = "탈퇴합니다";
const TICKET_MS = 5 * 60 * 1000;
const REAUTH_MS = 10 * 60 * 1000;
const tickets = new Map();            // ticket → { uid, exp }
const inProgress = new Set();
const deletedHashes = new Set();      // sha256(회원 번호) — 탈퇴한 회원의 남은 토큰 차단
const rl = new Map();                 // key → [시각…]
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const limited = (key, max, win) => { const n = Date.now(); const a = (rl.get(key) || []).filter((t) => n - t < win); if (a.length >= max) { rl.set(key, a); return true; } a.push(n); rl.set(key, a); if (rl.size > 20000) rl.clear(); return false; };

/** verifyJWT에서 부름: 탈퇴한 회원의 남은 토큰이면 true */
export function isDeletedUser(uid) { return !!uid && deletedHashes.size > 0 && deletedHashes.has(sha(uid)); }

function decodeJwt(token) { try { return JSON.parse(Buffer.from(String(token).split(".")[1], "base64url").toString("utf8")); } catch { return null; } }
function lastAuthAt(payload) {
  const amr = Array.isArray(payload?.amr) ? payload.amr : [];
  const ts = amr.map((a) => Number(a?.timestamp) || 0);
  return ts.length ? Math.max(...ts) * 1000 : 0;
}

export function registerAccountDelete(app, sb, { requireAuth, supabaseUrl, anonKey, adminCheck, log = console } = {}) {
  // 서버 시작 때: 최근 탈퇴(2일) 해시 불러와 토큰 차단 + 끝나지 않은 계정 삭제 재시도
  const loadHashes = async () => {
    try { const since = new Date(Date.now() - 2 * 864e5).toISOString(); const { data } = await sb.from("account_deletions").select("uid_hash").gte("created_at", since).in("status", ["data_done", "done"]); for (const r of data || []) deletedHashes.add(r.uid_hash); } catch (e) { log.warn("[account] load hashes", e?.message); }
  };
  const retryPending = async () => {
    try {
      const { data } = await sb.from("account_deletions").select("id, user_id").eq("status", "data_done").not("user_id", "is", null).limit(20);
      for (const r of data || []) await finishAuthDelete(r.id, r.user_id);
    } catch (e) { log.warn("[account] retry", e?.message); }
  };
  async function finishAuthDelete(rowId, uid) {
    // 프로필 사진 파일 (avatars/{uid}/…)
    try { const { data: files } = await sb.storage.from("avatars").list(uid, { limit: 1000 }); const paths = (files || []).map((f) => `${uid}/${f.name}`); if (paths.length) await sb.storage.from("avatars").remove(paths); } catch (e) { log.warn("[account] avatar remove", e?.message); }
    const { error } = await sb.auth.admin.deleteUser(uid);
    if (error && !/not.?found/i.test(error.message || "")) { await sb.from("account_deletions").update({ error: String(error.message).slice(0, 300) }).eq("id", rowId); return false; }
    await sb.from("account_deletions").update({ status: "done", user_id: null, finished_at: new Date().toISOString(), error: null }).eq("id", rowId);
    return true;
  }
  loadHashes().then(retryPending);
  setInterval(() => { retryPending(); }, 10 * 60 * 1000).unref?.();

  const ipOf = (req) => String(req.headers["cf-connecting-ip"] || String(req.headers["x-forwarded-for"] || "").split(",")[0] || req.socket?.remoteAddress || "").trim();
  const tokenOf = (req) => { const h = req.headers.authorization || ""; return h.startsWith("Bearer ") ? h.slice(7).trim() : ""; };

  // 탈퇴 전 안내용: 내 콘텐츠 수
  async function myCounts(uid) {
    const c = {};
    for (const [k, t, col] of [["contents", "contents", "owner_id"], ["tier", "tier_templates", "creator_id"], ["bingo", "bingos", "creator_id"], ["ptest", "personality_tests", "creator_id"]]) {
      try { const { count } = await sb.from(t).select("id", { count: "exact", head: true }).eq(col, uid); c[k] = count || 0; } catch { c[k] = null; }
    }
    return c;
  }
  async function isAdminUser(req) {
    if (req.user?.isAdmin) return true;
    try { const { data } = await sb.from("profiles").select("role").eq("id", req.user.id).maybeSingle(); if (data?.role && data.role !== "user") return true; } catch {}
    try { if (adminCheck && (await adminCheck(req.user))) return true; } catch {}
    return false;
  }
  async function verifyPassword(email, password, uid) {
    if (!email || !password || !supabaseUrl || !anonKey) return false;
    try {
      const r = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: anonKey, "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      if (!r.ok) return false;
      const j = await r.json();
      return j?.user?.id === uid;
    } catch { return false; }
  }

  // 1단계: 본인 재확인 → 5분짜리 1회용 확인권
  app.post("/account/delete/request", requireAuth, async (req, res) => {
    try {
      const uid = req.user.id, ip = ipOf(req);
      if (limited("u:" + uid, 6, 3600e3) || limited("ip:" + ip, 12, 3600e3)) return res.status(429).json({ ok: false, error: "RATE_LIMITED" });
      if (await isAdminUser(req)) return res.status(403).json({ ok: false, error: "ADMIN_ACCOUNT" });
      const payload = decodeJwt(tokenOf(req)) || {};
      const providers = payload.app_metadata?.providers || (payload.app_metadata?.provider ? [payload.app_metadata.provider] : []);
      const pw = typeof req.body?.password === "string" ? req.body.password : "";
      let ok = false, how = null;
      if (pw) { ok = await verifyPassword(req.user.email || payload.email, pw, uid); how = "password"; if (!ok) return res.status(403).json({ ok: false, error: "BAD_PASSWORD" }); }
      else if (Date.now() - lastAuthAt(payload) <= REAUTH_MS) { ok = true; how = "recent_login"; }
      if (!ok) return res.status(403).json({ ok: false, error: "REAUTH_REQUIRED", providers, hasEmail: providers.includes("email") });
      for (const [k, v] of tickets) if (v.exp < Date.now() || v.uid === uid) tickets.delete(k);
      const ticket = crypto.randomBytes(24).toString("base64url");
      tickets.set(ticket, { uid, exp: Date.now() + TICKET_MS });
      res.json({ ok: true, ticket, expiresIn: TICKET_MS / 1000, how, counts: await myCounts(uid), phrase: DELETE_PHRASE });
    } catch (e) { log.error("[account/request]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
  });

  // 2단계: 확인권 + "탈퇴합니다" → 실제 탈퇴
  app.post("/account/delete/confirm", requireAuth, async (req, res) => {
    const uid = req.user.id;
    try {
      if (limited("c:" + uid, 6, 3600e3)) return res.status(429).json({ ok: false, error: "RATE_LIMITED" });
      if (String(req.body?.phrase || "").trim() !== DELETE_PHRASE) return res.status(400).json({ ok: false, error: "BAD_PHRASE" });
      const t = tickets.get(String(req.body?.ticket || ""));
      if (!t || t.uid !== uid || t.exp < Date.now()) return res.status(403).json({ ok: false, error: "BAD_TICKET" });
      tickets.delete(String(req.body.ticket));
      if (inProgress.has(uid)) return res.status(409).json({ ok: false, error: "IN_PROGRESS" });
      if (await isAdminUser(req)) return res.status(403).json({ ok: false, error: "ADMIN_ACCOUNT" });
      inProgress.add(uid);
      const hash = sha(uid);
      // 이미 데이터 정리까지 끝난 기록이 있으면(서버가 중간에 멈춘 경우) 계정 삭제만 이어서
      const { data: prev } = await sb.from("account_deletions").select("id, status").eq("uid_hash", hash).in("status", ["data_done", "done"]).order("id", { ascending: false }).limit(1);
      let rowId = prev?.[0]?.id, counts = null;
      if (!prev?.[0]) {
        const { data: row, error: le } = await sb.from("account_deletions").insert({ uid_hash: hash, user_id: uid, status: "started" }).select("id").single();
        if (le) throw new Error("LEDGER " + le.message);
        rowId = row.id;
        const { data: c, error } = await sb.rpc("account_delete_data", { p_uid: uid, p_anon: crypto.randomUUID() });
        if (error) {
          await sb.from("account_deletions").update({ status: "failed", user_id: null, error: String(error.message).slice(0, 300), finished_at: new Date().toISOString() }).eq("id", rowId);
          log.error("[account/confirm] data", error.message);
          return res.status(500).json({ ok: false, error: "DELETE_FAILED" });   // 한 트랜잭션이라 아무것도 안 바뀜
        }
        counts = c;
        await sb.from("account_deletions").update({ status: "data_done", counts: c }).eq("id", rowId);
      } else if (prev[0].status === "done") { deletedHashes.add(hash); return res.json({ ok: true, already: true }); }
      deletedHashes.add(hash);                          // 이 순간부터 남은 로그인 토큰 차단
      const done = await finishAuthDelete(rowId, uid);  // 사진 파일 + 로그인 계정 삭제 (실패 시 10분마다 재시도)
      res.json({ ok: true, done, pending: !done, counts });
    } catch (e) { log.error("[account/confirm]", e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
    finally { inProgress.delete(uid); }
  });
}
export const _accTest = { tickets, deletedHashes, sha, lastAuthAt };
