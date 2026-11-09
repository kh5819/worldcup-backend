// 게임 종합 진단소 서버 점검 (가짜 DB, 운영과 무관). node scripts/gamelab-server-check.mjs
import express from "express"; import http from "http";
import { registerGamelab, suspicious } from "../src/gamelab.js"; import * as C from "../src/gamelab-core.js"; import { makeFakeSb } from "./mind-fake-sb.mjs";
const UID = "00000000-0000-4000-8000-000000000001";
const sb = makeFakeSb({ profiles: [{ id: UID, nickname: "프로필닉" }] });
const app = express(); app.use(express.json());
registerGamelab(app, sb, { getOptionalUser: async (q) => (q.headers.authorization === "Bearer ok" ? { id: UID } : null) });
const srv = http.createServer(app); await new Promise((r) => srv.listen(0, r)); const B = `http://localhost:${srv.address().port}`;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log("실패", n, x ?? ""); } };
const post = (p, body, h = {}) => fetch(B + p, { method: "POST", headers: { "Content-Type": "application/json", ...h }, body: JSON.stringify(body) }).then(async (r) => ({ s: r.status, j: await r.json() }));
const G = "guest_check0001", raw = { dodge: { ok: true, t: 45, hp: .7, moved: .8, inputs: 9 }, apple: { ok: true, value: 52, t: 40, inputs: 9 }, br: { ok: true, value: 10, t: 80, inputs: 9 }, bb: { ok: true, value: 8, t: 60, inputs: 9 }, merge: { ok: true, value: 12000, t: 50, inputs: 9 } };
const base = { mode: "quick", diff: "hard", nick: "입력닉", plan: C.QUICK, raws: raw };
let r = await post("/gamelab/result", base, { "x-iq-guest": G }); ok("게스트 저장", r.j.ok && r.j.tier !== "N", r.j); const gid = r.j.id;
ok("게스트 닉네임", sb.DB.gamelab_results.find((x) => x.id === gid).nickname === "입력닉");
r = await post("/gamelab/result", { ...base, raws: { dodge: raw.dodge, apple: raw.apple } }, { "x-iq-guest": G }); ok("빠른 2개 = 등급 보류", r.j.ok && r.j.tier === "N", r.j);
r = await post("/gamelab/result", { ...base, raws: { dodge: raw.dodge, apple: raw.apple, br: raw.br } }, { "x-iq-guest": G }); ok("빠른 3개 = 등급", r.j.tier !== "N", r.j);
r = await post("/gamelab/result", { mode: "full", diff: "hard", plan: C.FULL, raws: { raising: { win: true, eff: 1, inputs: 9 } } }, { "x-iq-guest": G }); ok("전체 1개 = 등급 보류", r.j.tier === "N" && r.j.total === 1000, r.j);
r = await post("/gamelab/result", base, { Authorization: "Bearer ok" }); ok("회원 저장", r.j.ok, r.j); const row = sb.DB.gamelab_results.find((x) => x.id === r.j.id); ok("회원은 프로필 닉네임", row.nickname === "프로필닉", row.nickname); ok("회원 owner", row.owner_key === `u:${UID}`);
r = await post("/gamelab/merge", {}, { "x-iq-guest": G }); ok("비회원 옮기기 거부", r.s === 401);
r = await post("/gamelab/merge", {}, { Authorization: "Bearer ok", "x-iq-guest": "bad id" }); ok("잘못된 게스트 거부", r.s === 400);
const before = sb.DB.gamelab_results.filter((x) => x.owner_key === `g:${G}`).length; r = await post("/gamelab/merge", {}, { Authorization: "Bearer ok", "x-iq-guest": G }); ok("게스트 기록 옮기기", r.j.ok && r.j.moved === before && before === 4, r.j); ok("남은 게스트 기록 0", sb.DB.gamelab_results.filter((x) => x.owner_key === `g:${G}`).length === 0); ok("옮긴 뒤 닉네임", sb.DB.gamelab_results.find((x) => x.id === gid).nickname === "프로필닉");
r = await post("/gamelab/merge", {}, { Authorization: "Bearer ok", "x-iq-guest": G }); ok("두 번째 옮기기 0개", r.j.moved === 0);
// 채점 경계
const S = C.scoreMission; ok("조작 0 = 0점", S("apple", "normal", { ok: true, value: 99, t: 5, inputs: 0 }).score === 0); ok("포기 상한", S("apple", "normal", { ok: true, value: 99, t: 5, inputs: 3, quit: true }).score === 20); ok("피해 가만히 상한", S("dodge", "normal", { ok: true, t: 30, hp: 1, moved: 0.1, inputs: 3 }).score === 40); ok("이상한 raw 안전", S("apple", "normal", 5).score === 0 && S("omok", "normal", { win: "x", eff: "NaN", inputs: 1 }).score >= 60);
ok("너무 빠른 기록 표시", suspicious("apple", "normal", { ok: true, value: 99, t: 1 }) === "TOO_QUICK"); ok("타수 불가능 표시", suspicious("golf", "normal", { done: 3, strokes: 2 }) === "BAD_STROKES");
for (const d of C.DIFFS) for (const m of C.MISSIONS) { ok(`표 ${m.id} ${d}`, !!C.cfgOf(m.id, d)); }
console.log(`통과 ${pass} · 실패 ${fail}`); srv.close(); process.exit(fail ? 1 : 0);
