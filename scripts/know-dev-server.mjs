// 상식 진단소 시험 서버 (사이트 파일 + 상식·IQ(프로필) 서버 + 가짜 DB). 운영 DB·운영 서버와 무관
// PORT=5196 node scripts/know-dev-server.mjs   →  http://localhost:5196/know.html
// /__ans?sid=&i= : 시험용 정답 (이 서버에만 있음)
import http from "http"; import fs from "fs"; import path from "path"; import express from "express"; import { Server } from "socket.io";
import { registerIq } from "../src/iq.js";
import { registerKnow, _knowTest } from "../src/know.js";
import { registerKnowMulti } from "../src/know-multi.js";
import { registerKnowBroadcast, _kbcTest } from "../src/know-broadcast.js";
import { makeFakeSb } from "./mind-fake-sb.mjs";
import { registerSense } from "../src/sense.js";
import { registerSenseMulti } from "../src/sense-multi.js";
import { registerSenseBroadcast } from "../src/sense-broadcast.js";
const ROOT = path.resolve("../홈페이지 제작"), PORT = Number(process.env.PORT || 5196);
const sb = makeFakeSb({ profiles: [] });
const app = express(), server = http.createServer(app), io = new Server(server, { maxHttpBufferSize: 1e6 });
app.use(express.json());
io.use((s, n) => { const id = s.handshake.auth?.guestId || s.handshake.query?.uid; if (!id) return n(new Error("UNAUTHORIZED")); s.user = { id: String(id), isGuest: String(id).startsWith("guest_"), isAdmin: false }; n(); });
registerIq(io, sb, app, {});
// 관리자 화면 시험용: Bearer devadmin 이면 관리자 (이 시험 서버에만)
const requireAdmin = (req, res, next) => (req.headers.authorization === "Bearer devadmin" ? ((req.user = { email: "dev@local" }), next()) : res.status(403).json({ ok: false, error: "FORBIDDEN" }));
registerKnow(io, sb, app, { requireAdmin });
registerKnowMulti(io, sb);
// 게임 센스 진단소도 같은 시험 서버에서 (번역 화면 시험용)
registerSense(io, sb, app, {});
registerSenseMulti(io, sb);
registerSenseBroadcast(io, sb, app, {});
registerKnowBroadcast(io, sb, app);
app.get("/__bcans", (q, r) => { const b = _kbcTest.BC.get(String(q.query.id)); r.json(b?.cur ? { kind: b.cur.sv.pub.kind, key: b.cur.sv.key } : null); });
app.get("/__ans", (q, r) => { const s = _knowTest.SESS.get(String(q.query.sid)); const sv = s?.served?.[Number(q.query.i)]; r.json(sv ? { kind: sv.pub.kind, key: sv.key } : null); });
app.get("/__db", (_q, r) => r.json(Object.fromEntries(Object.entries(sb.DB).map(([k, v]) => [k, v.length]))));
const T = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".ogg": "audio/ogg", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".md": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon", ".svg": "image/svg+xml" };
app.use((req, res) => {
  const u = decodeURIComponent(req.path), p = path.join(ROOT, u === "/" ? "know.html" : u);
  if (!p.startsWith(ROOT)) return res.status(403).end();
  if (/know-bank/.test(u)) return res.status(404).end();
  fs.readFile(p, (e, d) => { if (e) return res.status(404).end("nf"); if (u.endsWith("/js/config.js")) d = Buffer.from(String(d).replace("https://worldcup-backend-leee.onrender.com", `http://localhost:${PORT}`)); res.set("content-type", T[path.extname(p)] || "application/octet-stream").send(d); });
});
server.listen(PORT, () => console.log(`know dev http://localhost:${PORT}/know.html`));
