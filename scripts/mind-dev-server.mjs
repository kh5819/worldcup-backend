// 심리전 시험 서버 (사이트 파일 + 심리전 서버 + 가짜 DB). 운영 DB·운영 서버와 무관. PORT=5190 node scripts/mind-dev-server.mjs
import http from "http"; import fs from "fs"; import path from "path"; import express from "express"; import { Server } from "socket.io";
import { registerMind } from "../src/mind.js"; import { registerMindMulti } from "../src/mind-multi.js"; import { registerMindBroadcast } from "../src/mind-broadcast.js";
import { memberProfile, registerIq } from "../src/iq.js";
import { registerClinic } from "../src/clinic.js"; import { registerClinicMulti } from "../src/clinic-multi.js"; import { registerIqMulti } from "../src/iq-multi.js"; import { makeFakeSb } from "./mind-fake-sb.mjs";
const ROOT = path.resolve("../홈페이지 제작"), PORT = Number(process.env.PORT || 5190);
const sb = makeFakeSb({ profiles: [] });
const app = express(), server = http.createServer(app), io = new Server(server, { maxHttpBufferSize: 1e6 });
io.use((s, n) => { const id = s.handshake.auth?.guestId || s.handshake.query?.uid; if (!id) return n(new Error("UNAUTHORIZED")); s.user = { id: String(id), isGuest: String(id).startsWith("guest_") && !(process.env.DEV_MEMBER && String(id).startsWith("guest_m")), isAdmin: false }; n(); });
registerIq(io, sb, app, {}); if (process.env.DEV_ALL) { registerClinic(io, sb, app, {}); registerClinicMulti(io, sb); registerIqMulti(io, sb); } registerMind(io, sb, app, {}); registerMindMulti(io, sb); registerMindBroadcast(io, sb, app, { memberProfile });
app.get("/__db", (_q, r) => r.json(Object.fromEntries(Object.entries(sb.DB).map(([k, v]) => [k, v.length]))));
const T = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".ogg": "audio/ogg", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".md": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon", ".svg": "image/svg+xml" };
app.use((req, res) => {
  const u = decodeURIComponent(req.path), p = path.join(ROOT, u === "/" ? "mind.html" : u);
  if (!p.startsWith(ROOT)) return res.status(403).end();
  fs.readFile(p, (e, d) => { if (e) return res.status(404).end("nf"); if (u.endsWith("/js/config.js")) d = Buffer.from(String(d).replace("https://worldcup-backend-leee.onrender.com", `http://localhost:${PORT}`)); res.set("content-type", T[path.extname(p)] || "application/octet-stream").send(d); });
});
server.listen(PORT, () => console.log(`mind dev http://localhost:${PORT}`));
