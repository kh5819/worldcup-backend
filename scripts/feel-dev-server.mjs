// 감각 진단소 시험 서버 (사이트 파일 + IQ(프로필)·감각 서버 + 가짜 DB). 운영과 무관. PORT=5197 node scripts/feel-dev-server.mjs
import http from "http"; import fs from "fs"; import path from "path"; import express from "express"; import { Server } from "socket.io";
import { registerMind } from "../src/mind.js"; import { registerMindMulti } from "../src/mind-multi.js"; import { registerMindBroadcast } from "../src/mind-broadcast.js";
import { memberProfile, registerIq } from "../src/iq.js"; import { registerFeel } from "../src/feel.js"; import { registerFeelMulti } from "../src/feel-multi.js"; import { registerFeelBroadcast } from "../src/feel-broadcast.js"; import { registerPublicRooms } from "../src/public-rooms.js";
import { registerClinic } from "../src/clinic.js"; import { registerClinicMulti } from "../src/clinic-multi.js"; import { registerIqMulti } from "../src/iq-multi.js"; import { makeFakeSb } from "./mind-fake-sb.mjs"; import { registerSense } from "../src/sense.js"; import { registerSenseMulti } from "../src/sense-multi.js"; import { registerSenseBroadcast } from "../src/sense-broadcast.js";
const ROOT = path.resolve("../홈페이지 제작"), PORT = Number(process.env.PORT || 5197);
const sb = makeFakeSb({ profiles: [] });
const app = express(), server = http.createServer(app), io = new Server(server, { maxHttpBufferSize: 1e6 });
io.use((s, n) => { const id = s.handshake.auth?.guestId || s.handshake.query?.uid; if (!id) return n(new Error("UNAUTHORIZED")); s.user = { id: String(id), isGuest: String(id).startsWith("guest_") && !(process.env.DEV_MEMBER && String(id).startsWith("guest_m")), isAdmin: false }; n(); });
registerIq(io, sb, app, {}); registerFeel(io, sb, app, {}); registerMind(io, sb, app, {}); registerFeelMulti(io, sb); registerFeelBroadcast(io, sb, app, { memberProfile: async () => null }); registerPublicRooms(app, io);
// 시험 전용: 종합 프로필 확인용 기록 심기 (가짜 DB에만) — /__seed?uid=guest_xxx
app.get("/__seed", (q, r) => { const k = `g:${q.query.uid}`, at = new Date().toISOString(); const put = (t, row) => { (sb.DB[t] ||= []).push(row); };
  put("clinic_results", { id: "cl1", owner_key: k, mode: "full", total: 71, phys: 24, diag: { title: "프로 지망생" }, created_at: at });
  put("iq_results", { id: "iq1", owner_key: k, mode: "full", total: 640, iq: 118, areas: {}, diag: { title: "논리 탐정", titles: [{ name: "IQ 탐정" }] }, created_at: at });
  put("mind_results", { id: "mi1", owner_key: k, mode: "full", lv: 4, total: 612, areas: {}, diag: { type: { id: "fox", name: "여우" } }, created_at: at });
  put("sense_results", { id: "se1", owner_key: k, mode: "full", total: 720, tier: "emerald", style: "radar", areas: {}, flagged: false, created_at: at });
  put("know_results", { id: "kn1", owner_key: k, mode: "full", area: null, total: 66, lv: 6, type_id: "x", type: { name: "지식 탐험가" }, titles: [], flagged: false, created_at: at });
  put("feel_results", { id: "fe1", owner_key: k, mode: "full", diff: "hard", total: 905, tier: "SS", style: "ultra", done: 15, flagged: false, created_at: at });
  put("feel_results", { id: "fe0", owner_key: k, mode: "full", diff: "normal", total: 960, tier: "SSS", style: "ultra", done: 15, flagged: false, created_at: at });
  r.json({ ok: true }); });
app.get("/__db", (_q, r) => r.json(Object.fromEntries(Object.entries(sb.DB).map(([k, v]) => [k, v.length]))));
const T = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".ogg": "audio/ogg", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".md": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon", ".svg": "image/svg+xml" };
app.use((req, res) => {
  const u = decodeURIComponent(req.path), p = path.join(ROOT, u === "/" ? "feel.html" : u);
  if (!p.startsWith(ROOT)) return res.status(403).end();
  fs.readFile(p, (e, d) => { if (e) return res.status(404).end("nf"); if (u.endsWith("/js/config.js")) d = Buffer.from(String(d).replace("https://worldcup-backend-leee.onrender.com", `http://localhost:${PORT}`)); res.set("content-type", T[path.extname(p)] || "application/octet-stream").send(d); });
});
server.listen(PORT, () => console.log(`feel dev http://localhost:${PORT}`));
