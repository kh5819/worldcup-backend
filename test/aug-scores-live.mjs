// 증강 랭킹 실DB 시험 (운영자 본인 계정 '몰라'로 쓰고, 끝나면 그 기록만 지움)
// node test/aug-scores-live.mjs
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { registerAugScores } from "../src/aug-scores.js";
const sa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const UID = "b4a79762-4d23-402b-9860-cd28203c064d", GID = "guest_zztest" + Date.now().toString(36);
const routes = {}; const app = { post: (p, f) => (routes["POST " + p] = f), get: (p, f) => (routes["GET " + p] = f) };
let who = UID; registerAugScores(app, sa, { getOptionalUser: async () => (who ? { id: who } : null) });
const call = (k, body) => new Promise((ok) => { const res = { code: 200, status(c) { this.code = c; return this; }, json(j) { ok({ code: this.code, ...j }); } }; routes[k]({ body, query: {}, headers: {}, ip: "9.9.9." + Math.random() }, res); });
let pass = 0, fail = 0; const check = (c, m) => { c ? pass++ : fail++; console.log((c ? "  ✓ " : "  ✗ ") + m); };
try {
  for (const g of ["apple", "blockblast"]) {
    const T = g === "apple" ? "apple_aug_scores" : "blockblast_aug_scores"; await sa.from(T).delete().eq("user_id", UID); await sa.from(T).delete().eq("guest_id", GID);
    const base = g === "apple" ? { applesCleared: 120, maxCombo: 6 } : { linesCleared: 40, blocksPlaced: 150 };
    who = null; let r = await call(`POST /${g}/aug/score`, { score: 500, durationSec: 120, ...base }); check(r.code === 401, `${g} 게스트 번호도 없으면 거절`);
    r = await call(`POST /${g}/aug/score`, { score: 500, durationSec: 120, guestId: "hack<script>", ...base }); check(r.code === 401, `${g} 이상한 게스트 번호 거절`);
    r = await call(`POST /${g}/aug/score`, { score: 640, durationSec: 120, guestId: GID, ...base }); check(r.ok && r.isNewBest && r.globalRank >= 1, `${g} 비로그인 게스트 기록 → ${r.globalRank}위`);
    r = await call(`POST /${g}/aug/score`, { score: 300, durationSec: 120, guestId: GID, ...base }); check(r.ok && r.bestScore === 640, `${g} 게스트도 최고점 유지`);
    r = await call(`GET /${g}/aug/leaderboard/global`); const gr = r.rows?.find((x) => x.is_guest && x.score === 640); check(gr && /^게스트·/.test(gr.nickname) && !("guest_id" in gr), `${g} 랭킹에 게스트로 보임(번호는 안 보냄): ${gr?.nickname}`);
    who = UID;
    r = await call(`POST /${g}/aug/score`, { score: 900, durationSec: 120, augs: ["a", "b"], ...base }); check(r.ok && r.isNewBest && r.bestScore === 900 && r.globalRank >= 1, `${g} 첫 기록 900 → ${r.globalRank}위`);
    r = await call(`POST /${g}/aug/score`, { score: 700, durationSec: 120, ...base }); check(r.ok && !r.isNewBest && r.bestScore === 900, `${g} 낮은 점수는 최고점 유지`);
    r = await call(`POST /${g}/aug/score`, { score: 99999999, durationSec: 120, ...base }); check(r.ok && r.flagged && r.bestScore === 900, `${g} 말도 안 되는 점수는 표시만 하고 기존 기록 안 덮음`);
    r = await call(`POST /${g}/aug/score`, { score: 1200, durationSec: 120, ...base }); check(r.ok && r.isNewBest && r.bestScore === 1200, `${g} 더 높은 점수로 갱신`);
    r = await call(`GET /${g}/aug/leaderboard/global`); const mine = r.rows?.find((x) => x.user_id === UID); check(r.ok && mine && mine.score === 1200 && mine.augs?.length === 0, `${g} 증강 랭킹에 보임 (${r.rows?.length}명)`);
    r = await call(`GET /${g}/aug/leaderboard/me`); check(r.ok && r.row?.score === 1200 && r.row.global_rank >= 1, `${g} 내 증강 기록`);
    const { data: normal } = await sa.from(g === "apple" ? "apple_scores" : "blockblast_scores").select("score").eq("user_id", UID).maybeSingle(); check(!normal || normal.score !== 1200, `${g} 일반 랭킹은 그대로`);
    await sa.from(T).delete().eq("user_id", UID); await sa.from(T).delete().eq("guest_id", GID);
  }
} finally { for (const T of ["apple_aug_scores", "blockblast_aug_scores"]) { await sa.from(T).delete().eq("user_id", UID); await sa.from(T).delete().eq("guest_id", GID); } }
console.log(`통과 ${pass} / 실패 ${fail}`); process.exit(fail ? 1 : 0);
