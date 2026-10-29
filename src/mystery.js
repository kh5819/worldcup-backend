// =========================
// 플듀 미스터리: 8인의 수수께끼 (서버) — v0.2 솔로 + 진행 저장
// 'mys:*' 이벤트 prefix. 사건 진행·정답 판정은 mystery-engine.js가 전부 서버에서.
// 솔로 세션: 사용자(로그인/게스트) 1명당 사건별 1개.
//   메모리가 1차, DB(mystery_progress)가 백업 — 서버 재시작 후에도 이어서 조사 가능.
//   DB 실패는 게임 진행을 막지 않는다 (로그만 남김).
// =========================

import { CASES, listCases, defaultCaseId } from "./mystery-cases.js";
import { createSession, act, snapshot, startEvents, publicCaseInfo, serializeSession, restoreSession, buildResult } from "./mystery-engine.js";
const soloSessions = new Map(); // `${userId}:${caseId}` → session
const saveTimers = new Map();
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const SAVE_DEBOUNCE_MS = 1500;
const RATE_WINDOW_MS = 5_000;
const RATE_MAX = 40;

let db = null;

function sessionKey(userId, caseId) { return `${userId}:${caseId}`; }

function rateLimited(socket) {
  const now = Date.now();
  const b = socket.data.mysRate || (socket.data.mysRate = []);
  while (b.length && now - b[0] > RATE_WINDOW_MS) b.shift();
  b.push(now);
  return b.length > RATE_MAX;
}

// ---------- DB ----------
async function loadSession(userId, caseId) {
  if (!db) return null;
  try {
    const { data, error } = await db.from("mystery_progress").select("state").eq("user_key", userId).eq("case_id", caseId).maybeSingle();
    if (error) throw error;
    return data?.state ? restoreSession(data.state) : null;
  } catch (err) {
    console.error("[mystery] load 실패", err?.message || err);
    return null;
  }
}

async function writeSession(userId, caseId, st) {
  if (!db) return;
  try {
    const { error } = await db.from("mystery_progress").upsert({
      user_key: userId, case_id: caseId, state: serializeSession(st), ended: !!st.ending, updated_at: new Date().toISOString(),
    }, { onConflict: "user_key,case_id" });
    if (error) throw error;
  } catch (err) {
    console.error("[mystery] save 실패", err?.message || err);
  }
}

function scheduleSave(userId, caseId, st, immediate = false) {
  const key = sessionKey(userId, caseId);
  clearTimeout(saveTimers.get(key));
  if (immediate) { saveTimers.delete(key); return writeSession(userId, caseId, st); }
  saveTimers.set(key, setTimeout(() => { saveTimers.delete(key); writeSession(userId, caseId, st); }, SAVE_DEBOUNCE_MS));
}

async function recordResult(userId, caseId, c, st) {
  if (!db) return;
  try {
    const r = buildResult(c, st);
    const row = {
      user_key: userId, case_id: caseId, ending: r.ending, accuracy: r.accuracy, elapsed_sec: r.elapsedSec,
      hints_used: r.hintsUsed, solved_main: r.solvedMain, solved_hidden: r.solvedHidden, titles: r.titles,
    };
    // detail(구간·퍼즐별 시간)은 sql/mystery_results_detail.sql 적용 후에만 저장된다 — 열이 없으면 빼고 다시 넣는다
    let { error } = await db.from("mystery_results").insert({ ...row, detail: { chapters: r.chapters, puzzles: r.puzzles } });
    if (error && /detail/.test(error.message || "")) ({ error } = await db.from("mystery_results").insert(row));
    if (error) throw error;
  } catch (err) {
    console.error("[mystery] result 기록 실패", err?.message || err);
  }
}

// 메모리 정리 (DB에는 남아 있으므로 다음 접속 때 다시 불러온다)
setInterval(() => {
  const cut = Date.now() - SESSION_TTL_MS;
  for (const [k, s] of soloSessions) if (s.lastActive < cut && !saveTimers.has(k)) soloSessions.delete(k);
}, 10 * 60 * 1000).unref?.();

export function registerMystery(io, supabaseAdmin) {
  db = supabaseAdmin || null;

  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;

    // 사건 목록 (선택 화면)
    socket.on("mys:cases", (payload, cb) => { if (rateLimited(socket)) return cb?.({ ok: false, error: "RATE_LIMITED" }); cb?.({ ok: true, cases: listCases() }); });

    socket.on("mys:solo:start", async (payload, cb) => {
      try {
        if (rateLimited(socket)) return cb?.({ ok: false, error: "RATE_LIMITED" });
        const caseId = CASES[payload?.caseId] ? payload.caseId : defaultCaseId();
        const c = CASES[caseId];
        const key = sessionKey(me.id, caseId);
        let st = soloSessions.get(key);
        if (!st && !payload?.fresh) {
          st = await loadSession(me.id, caseId);
          if (st) soloSessions.set(key, st);
        }
        let events = [];
        const resumed = !!st && !payload?.fresh;
        if (!st || payload?.fresh) {
          st = createSession(c);
          soloSessions.set(key, st);
          events = startEvents(c, st);
          scheduleSave(me.id, caseId, st);
        }
        st.lastActive = Date.now();
        cb?.({ ok: true, resumed, case: publicCaseInfo(c), snapshot: snapshot(c, st), events });
      } catch (err) {
        console.error("[mys:solo:start]", err);
        cb?.({ ok: false, error: "INTERNAL_ERROR" });
      }
    });

    // 이어하기 버튼을 보여 줄지 (서버 기준 저장 여부)
    socket.on("mys:solo:status", async (payload, cb) => {
      try {
        if (rateLimited(socket)) return cb?.({ ok: false, error: "RATE_LIMITED" });
        const caseId = CASES[payload?.caseId] ? payload.caseId : defaultCaseId();
        let st = soloSessions.get(sessionKey(me.id, caseId));
        if (!st) st = await loadSession(me.id, caseId);
        cb?.({ ok: true, hasSave: !!st && !st.ending, ended: !!st?.ending });
      } catch (err) {
        console.error("[mys:solo:status]", err);
        cb?.({ ok: false, error: "INTERNAL_ERROR" });
      }
    });

    // 내 사건 기록 (솔로·멀티 공통 mystery_results)
    socket.on("mys:records", async (payload, cb) => {
      try {
        if (rateLimited(socket)) return cb?.({ ok: false, error: "RATE_LIMITED" });
        if (!db) return cb?.({ ok: true, records: [] });
        const caseId = CASES[payload?.caseId] ? payload.caseId : defaultCaseId();
        const { data, error } = await db.from("mystery_results")
          .select("ending, accuracy, elapsed_sec, hints_used, solved_main, solved_hidden, titles, created_at")
          .eq("user_key", me.id).eq("case_id", caseId).order("created_at", { ascending: false }).limit(30);
        if (error) throw error;
        cb?.({ ok: true, records: data || [] });
      } catch (err) {
        console.error("[mys:records]", err?.message || err);
        cb?.({ ok: false, error: "INTERNAL_ERROR" });
      }
    });

    socket.on("mys:solo:act", async (payload, cb) => {
      try {
        if (rateLimited(socket)) return cb?.({ ok: false, error: "RATE_LIMITED" });
        const caseId = CASES[payload?.caseId] ? payload.caseId : defaultCaseId();
        const c = CASES[caseId];
        const key = sessionKey(me.id, caseId);
        let st = soloSessions.get(key);
        if (!st) {
          st = await loadSession(me.id, caseId);
          if (st) soloSessions.set(key, st);
        }
        if (!st) return cb?.({ ok: false, error: "NO_SESSION" });
        const wasEnded = !!st.ending;
        const r = act(c, st, payload?.action);
        if (r.ok) {
          const justEnded = !wasEnded && !!st.ending;
          scheduleSave(me.id, caseId, st, justEnded);
          if (justEnded) recordResult(me.id, caseId, c, st);
        }
        cb?.({ ...r, snapshot: snapshot(c, st) });
      } catch (err) {
        console.error("[mys:solo:act]", err);
        cb?.({ ok: false, error: "INTERNAL_ERROR" });
      }
    });
  });
}
