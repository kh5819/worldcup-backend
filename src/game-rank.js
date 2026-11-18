// =========================
// 증강 2048 · 증강 벽돌깨기 랭킹 (2026-11-18) — 회원 + 게스트(브라우저 게스트 번호) 모두
// · 표(sql/game_rank_20261118.sql): ttfe_scores / brick_scores — 판 종류(board)마다 사람당 최고 기록 1줄
// · 멀티: 게임 서버가 확정한 점수를 그대로 기록 (recordMulti)
// · 혼자: 시작할 때 서버가 서명한 시드(runToken)를 줌 → 끝나면 화면이 조작 기록을 보냄 → 서버가 같은 엔진으로 다시 돌려 점수 계산
//   (화면이 보낸 점수는 쓰지 않음. 실제 시간보다 빠른 기록·제한 시간 넘긴 기록은 거절)
// · board: <mode>_<kind>  mode = classic|augment, kind = endless | t180 | t300 (2048) / endless | t300 (벽돌깨기)
// =========================
import crypto from "crypto";
import { Game2048 } from "./ttfe-core.js";
import { BrickGame, TPS } from "./brk-core.js";

const TOP = 50;
const GUEST_RE = /^guest_[a-z0-9]{6,30}$/;
const KINDS = { ttfe: { 0: "endless", 180: "t180", 300: "t300" }, brick: { 0: "endless", 300: "t300" } };
const TABLE = { ttfe: "ttfe_scores", brick: "brick_scores" };
const COLS = { ttfe: "nickname, user_id, guest_id, score, max_tile, moves, augs, source, plays, updated_at", brick: "nickname, user_id, guest_id, score, stage, boss_kills, max_combo, augs, source, plays, updated_at" };
let SA = null, SECRET = null;
export const boardOf = (game, mode, time) => { const k = KINDS[game]?.[Number(time) || 0]; return k ? `${mode === "classic" ? "classic" : "augment"}_${k}` : null; };
const validBoard = (game, b) => typeof b === "string" && Object.values(KINDS[game] || {}).some(k => b === "classic_" + k || b === "augment_" + k);
const cleanName = (s) => String(s || "").replace(/[\u0000-\u001f<>​-‏‪-‮﻿]/g, "").trim().slice(0, 14);

// ---------- 서명한 시작 표 (서버가 다시 켜져도 유효, 위조 불가) ----------
function sign(obj) { const body = Buffer.from(JSON.stringify(obj)).toString("base64url"); const mac = crypto.createHmac("sha256", SECRET).update(body).digest("base64url"); return body + "." + mac; }
function verify(tok) {
  const [body, mac] = String(tok || "").split("."); if (!body || !mac) return null;
  const want = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (want.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(mac))) return null;
  try { return JSON.parse(Buffer.from(body, "base64url").toString()); } catch { return null; }
}
const ipHits = new Map();
function tooMany(req, n = 30) { const ip = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim(), t = Date.now(), h = (ipHits.get(ip) || []).filter(x => t - x < 60000); h.push(t); ipHits.set(ip, h); if (ipHits.size > 5000) ipHits.clear(); return h.length > n; }

// ---------- 저장 (사람당 판 종류마다 최고 1줄, 판 수는 늘 +1) ----------
async function saveBest(game, board, entries) {
  if (!SA || !entries.length) return [];
  const T = TABLE[game]; const keys = entries.map(e => e.key);
  const { data, error } = await SA.from(T).select("*").eq("board", board).in("player_key", keys);
  if (error) { if (!/does not exist|schema cache/i.test(error.message || "")) console.error(`[rank] ${T} read`, error.message); return []; }
  const old = new Map((data || []).map(d => [d.player_key, d])); const rows = [], out = [];
  for (const e of entries) {
    const o = old.get(e.key), better = !o || e.score > o.score;
    const best = better ? e.best : Object.fromEntries(Object.keys(e.best).map(k => [k, o[k]]));
    rows.push({ board, player_key: e.key, user_id: e.userId || null, guest_id: e.guestId || null, nickname: e.nickname || o?.nickname || (e.guestId ? "게스트" + e.guestId.slice(-3) : "익명"), plays: (o?.plays || 0) + 1, updated_at: better ? new Date().toISOString() : o.updated_at, ...best, score: better ? e.score : o.score });
    out.push({ key: e.key, isNewBest: better && e.score > 0, best: better ? e.score : o.score });
  }
  const { error: e2 } = await SA.from(T).upsert(rows, { onConflict: "board,player_key" });
  if (e2) { console.error(`[rank] ${T} write`, e2.message); return []; }
  return out;
}
async function rankOf(game, board, score) { const { count } = await SA.from(TABLE[game]).select("player_key", { count: "exact", head: true }).eq("board", board).gt("score", score); return (count || 0) + 1; }

/** 멀티 결과 기록 (게임 서버가 확정한 값). entries: [{ id, isGuest, name, score, ...extra }] */
export async function recordMulti(game, mode, time, players) {
  try {
    const board = boardOf(game, mode, time); if (!board || !SA) return;
    const entries = players.filter(p => p.score > 0 && (p.isGuest ? GUEST_RE.test(p.id) : /^[0-9a-f-]{36}$/i.test(p.id))).map(p => ({ key: p.id, userId: p.isGuest ? null : p.id, guestId: p.isGuest ? p.id : null, nickname: cleanName(p.name), score: Math.round(p.score), best: { ...extraOf(game, p), augs: (p.augs || []).slice(0, 8), source: "multi" } }));
    await saveBest(game, board, entries);
  } catch (e) { console.error("[rank] multi", e); }
}
const extraOf = (game, p) => game === "ttfe" ? { max_tile: p.max | 0, moves: p.moves | 0 } : { stage: p.stage | 0, boss_kills: p.boss | 0, max_combo: p.combo | 0 };

// ---------- 다시 돌리기 ----------
function replay2048(run, ops) {
  if (!Array.isArray(ops) || ops.length > 60000) return { error: "BAD_LOG" };
  const g = new Game2048({ seed: run.seed, mode: run.mode, timed: run.time > 0 });
  for (const op of ops) { if (!Array.isArray(op)) return { error: "BAD_LOG" }; const r = g.apply(op.slice(0, 4)); if (!r.ok) return { error: "BAD_OP" }; }
  return { g, n: ops.length };
}
// 벽돌깨기: xs는 [x, 몇 틱] 묶음, ev는 [틱, 종류, ...]. 4000틱마다 쉬어 가며 (다른 게임 방해 안 함)
async function replayBrick(run, log) {
  const xs = Array.isArray(log?.xs) ? log.xs : null, evs = Array.isArray(log?.ev) ? log.ev : [];
  if (!xs || xs.length > 250000 || evs.length > 20000) return { error: "BAD_LOG" };
  const g = new BrickGame({ seed: run.seed, mode: run.mode, timed: run.time > 0 });
  const byTick = new Map(); for (const e of evs) { if (!Array.isArray(e) || !Number.isInteger(e[0]) || !["L", "U", "P", "R"].includes(e[1])) return { error: "BAD_LOG" }; const ev = e[1] === "U" ? ["U", String(e[2] ?? "").slice(0, 20), Number(e[3]), Number(e[4])] : e[1] === "P" ? ["P", String(e[2] ?? "").slice(0, 20)] : [e[1]]; if (!byTick.has(e[0])) byTick.set(e[0], []); byTick.get(e[0]).push(ev); }
  let tick = 0, work = 0; const MAXT = 60 * 60 * TPS;
  for (const pair of xs) {
    if (!Array.isArray(pair)) return { error: "BAD_LOG" }; const x = Number(pair[0]), c = Math.floor(Number(pair[1]));
    if (!(c >= 1 && c <= MAXT) || !Number.isFinite(x)) return { error: "BAD_LOG" };
    for (let i = 0; i < c; i++) { g.step({ x, ev: byTick.get(tick) || [] }); g.fxq.length = 0; tick++; if (tick > MAXT) return { error: "TOO_LONG" }; if (++work >= 4000) { work = 0; await new Promise(r => setImmediate(r)); } }
  }
  return { g, n: tick };
}

export function registerGameRank(app, supabaseAdmin, { getOptionalUser }) {
  SA = supabaseAdmin;
  SECRET = crypto.createHash("sha256").update("duo-game-rank:" + (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RANK_SECRET || "dev")).digest();
  const who = async (req, body) => {
    const user = await getOptionalUser(req).catch(() => null);
    if (user?.id) { const { data } = await SA.from("profiles").select("nickname").eq("id", user.id).maybeSingle(); return { key: user.id, userId: user.id, guestId: null, nickname: cleanName(data?.nickname) || "플레이어" }; }
    const gid = String(body?.guestId || ""); if (!GUEST_RE.test(gid)) return null;
    return { key: gid, userId: null, guestId: gid, nickname: cleanName(body?.nickname) || null }; // 이름을 안 보내면 저장된 이름 유지
  };
  for (const game of ["ttfe", "brick"]) {
    const P = game === "ttfe" ? "/ttfe" : "/brick";
    // 혼자 하기 시작: 시드 발급
    app.post(`${P}/solo/start`, (req, res) => {
      if (tooMany(req, 40)) return res.status(429).json({ ok: false, error: "TOO_FAST" });
      const mode = req.body?.mode === "classic" ? "classic" : "augment", time = Number(req.body?.time) || 0;
      if (!(String(time) in KINDS[game])) return res.status(400).json({ ok: false, error: "BAD_TIME" });
      const run = { g: game, seed: crypto.randomInt(1, 2 ** 31), mode, time, at: Date.now() };
      res.json({ ok: true, seed: run.seed, token: sign(run), board: boardOf(game, mode, time) });
    });
    // 혼자 하기 끝: 조작 기록 → 다시 돌려 점수 확정
    app.post(`${P}/solo/submit`, async (req, res) => {
      try {
        if (tooMany(req, 20)) return res.status(429).json({ ok: false, error: "TOO_FAST" });
        const run = verify(req.body?.token); if (!run || run.g !== game) return res.status(400).json({ ok: false, error: "BAD_TOKEN" });
        const elapsed = Date.now() - run.at; if (elapsed > 3 * 3600e3) return res.status(400).json({ ok: false, error: "EXPIRED" });
        const me = await who(req, req.body); if (!me) return res.status(401).json({ ok: false, error: "NO_PLAYER" });
        let r;
        if (game === "ttfe") {
          r = replay2048(run, req.body?.log); if (r.error) return res.status(400).json({ ok: false, error: r.error });
          if (r.n > elapsed / 1000 * 25 + 60) return res.status(400).json({ ok: false, error: "TOO_FAST_PLAY" });          // 사람 속도 넘음
          if (run.time > 0 && elapsed > (run.time + (r.g.timeBonus || 0) + 20) * 1000) return res.status(400).json({ ok: false, error: "OVER_TIME" }); // 타임어택은 시작부터 (제한 시간 + 시간 확장 + 20초) 안에 끝나야 함
        } else {
          r = await replayBrick(run, req.body?.log); if (r.error) return res.status(400).json({ ok: false, error: r.error });
          if (r.n > elapsed / (1000 / TPS) + 240) return res.status(400).json({ ok: false, error: "TOO_FAST_PLAY" });     // 실제 시간보다 빨리 돌림
          if (run.time > 0 && (r.g.playT || 0) > run.time * TPS + 30) return res.status(400).json({ ok: false, error: "OVER_TIME" }); // 제한 시간 넘게 플레이
        }
        const g = r.g, board = boardOf(game, run.mode, run.time);
        const p = game === "ttfe" ? { score: g.score, max: g.maxTile, moves: g.moves } : { score: g.score, stage: g.stage, boss: g.kills.boss, combo: g.maxCombo };
        if (p.score <= 0) return res.json({ ok: true, score: 0, board });
        const [o] = await saveBest(game, board, [{ ...me, score: p.score, best: { ...extraOf(game, p), augs: g.augs.map(a => a.id).slice(0, 8), source: "solo" } }]);
        const best = o?.best ?? p.score;
        res.json({ ok: true, board, score: p.score, best, isNewBest: !!o?.isNewBest, rank: o ? await rankOf(game, board, best) : null });
      } catch (e) { console.error(`[rank] ${game} submit`, e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
    });
    // 순위표 (20초 캐시)
    const cache = new Map();
    app.get(`${P}/ranking`, async (req, res) => {
      try {
        const board = String(req.query.board || ""); if (!validBoard(game, board)) return res.status(400).json({ ok: false, error: "BAD_BOARD" });
        const c = cache.get(board); if (c && Date.now() - c.at < 20_000) return res.json(c.body);
        const { data, error } = await SA.from(TABLE[game]).select(COLS[game]).eq("board", board).order("score", { ascending: false }).order("updated_at", { ascending: true }).limit(TOP);
        if (error) return res.json({ ok: true, rows: [], notReady: true });
        const rows = data || []; const ids = rows.map(r => r.user_id).filter(Boolean);
        if (ids.length) { const { data: pr } = await SA.from("profiles").select("id, nickname, avatar_url").in("id", ids); const m = new Map((pr || []).map(x => [x.id, x])); for (const r of rows) { const q = m.get(r.user_id); if (q?.nickname) r.nickname = q.nickname; if (q?.avatar_url) r.avatar_url = q.avatar_url; } }
        for (const r of rows) { r.is_guest = !r.user_id; delete r.user_id; delete r.guest_id; }
        const body = { ok: true, board, rows }; cache.set(board, { at: Date.now(), body }); res.json(body);
      } catch (e) { console.error(`[rank] ${game} list`, e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
    });
    app.get(`${P}/ranking/me`, async (req, res) => {
      try {
        const board = String(req.query.board || ""); if (!validBoard(game, board)) return res.status(400).json({ ok: false, error: "BAD_BOARD" });
        const me = await who(req, { guestId: req.query.guestId }); if (!me) return res.json({ ok: true, row: null });
        const { data } = await SA.from(TABLE[game]).select(COLS[game]).eq("board", board).eq("player_key", me.key).maybeSingle();
        if (!data) return res.json({ ok: true, row: null });
        data.rank = await rankOf(game, board, data.score); data.is_guest = !data.user_id; delete data.user_id; delete data.guest_id;
        res.json({ ok: true, row: data });
      } catch (e) { console.error(`[rank] ${game} me`, e); res.status(500).json({ ok: false, error: "INTERNAL" }); }
    });
  }
}
export const _rankTest = { sign, verify, replay2048, replayBrick, boardOf };
