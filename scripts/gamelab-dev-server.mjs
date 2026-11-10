// 게임 종합 진단소 시험 서버 (사이트 파일 + 오목·난장 카드·진단소 서버 + 가짜 DB). 운영과 무관. PORT=5199 node scripts/gamelab-dev-server.mjs
import http from "http"; import fs from "fs"; import path from "path"; import express from "express"; import { Server } from "socket.io";
import { registerOmok } from "../src/omok.js"; import { registerCardGame } from "../src/cardgame.js"; import { registerGamelab } from "../src/gamelab.js"; import { registerGamelabLive } from "../src/gamelab-live.js"; import { registerMind } from "../src/mind.js"; import { registerIq } from "../src/iq.js"; import { makeFakeSb } from "./mind-fake-sb.mjs";
const ROOT = path.resolve("../홈페이지 제작"), PORT = Number(process.env.PORT || 5199);
const sb = makeFakeSb({ profiles: [] });
const app = express(), server = http.createServer(app), io = new Server(server, { maxHttpBufferSize: 1e6, allowEIO3: true }); app.use(express.json({ limit: "64kb" }));
io.use((s, n) => { const id = s.handshake.auth?.guestId || s.handshake.query?.uid; if (!id) return n(new Error("UNAUTHORIZED")); s.user = { id: String(id), isGuest: true, isAdmin: false }; n(); });
registerOmok(io, sb); registerCardGame(io, sb); registerGamelab(app, sb, {}); registerGamelabLive(io, sb, app, {}); registerIq(io, sb, app, {}); registerMind(io, sb, app, {});
app.get("/__db", (_q, r) => r.json(sb.DB));
const T = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".ogg": "audio/ogg", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".ico": "image/x-icon", ".svg": "image/svg+xml", ".webp": "image/webp" };
app.use((req, res) => { const u = decodeURIComponent(req.path), p = path.join(ROOT, u === "/" ? "gamelab.html" : u); if (!p.startsWith(ROOT)) return res.status(403).end(); fs.readFile(p, (e, d) => { if (e) return res.status(404).end("nf"); if (u.endsWith("/js/config.js")) d = Buffer.from(String(d).replace("https://worldcup-backend-leee.onrender.com", `http://localhost:${PORT}`)); res.set("content-type", T[path.extname(p)] || "application/octet-stream").send(d); }); });
server.listen(PORT, () => console.log(`gamelab dev http://localhost:${PORT}`));
