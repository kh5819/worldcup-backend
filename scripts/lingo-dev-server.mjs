// 언어 진단소 시험 서버 (사이트 파일 + 언어·IQ(프로필) 서버 + 가짜 DB). 운영 DB·운영 서버와 무관
// PORT=5198 node scripts/lingo-dev-server.mjs   →  http://localhost:5198/lingo.html
// /__ans?sid=&i= : 시험용 정답 (이 서버에만 있음) · /__front?sid=&kinds=order,spot,type : 원하는 방식을 맨 앞으로
import http from "http"; import fs from "fs"; import path from "path"; import express from "express"; import { Server } from "socket.io";
import { registerIq } from "../src/iq.js";
import { registerLingo, _lingoTest } from "../src/lingo.js";
import { registerLingoBroadcast, _lbcTest } from "../src/lingo-broadcast.js";
import { registerLingoMulti, _lgmTest } from "../src/lingo-multi.js";
import { registerPublicRooms } from "../src/public-rooms.js";
import { registerMind } from "../src/mind.js";   // 종합 능력 프로필(ability:overview) 시험용
import { makeFakeSb } from "./mind-fake-sb.mjs";
const ROOT = path.resolve("../홈페이지 제작"), PORT = Number(process.env.PORT || 5198);
const sb = makeFakeSb({ profiles: [] });
const app = express(), server = http.createServer(app), io = new Server(server, { maxHttpBufferSize: 1e6 });
app.use(express.json());
io.use((s, n) => { const id = s.handshake.auth?.guestId || s.handshake.query?.uid; if (!id) return n(new Error("UNAUTHORIZED")); s.user = { id: String(id), isGuest: String(id).startsWith("guest_"), isAdmin: false }; n(); });
registerIq(io, sb, app, {});
registerLingo(io, sb, app, {});
registerLingoBroadcast(io, sb, app);
registerLingoMulti(io, sb);
registerPublicRooms(app, io);
registerMind(io, sb, app, {});
app.get("/__lgmans", (q, r) => { const id = _lgmTest.CODES.get(String(q.query.code)); const x = id && _lgmTest.ROOMS.get(id); r.json(x?.served ? { kind: x.served.pub.kind, key: x.served.key, phase: x.phase, round: x.round } : null); });
app.get("/__bcans", (q, r) => { const b = _lbcTest.BC.get(String(q.query.id)); r.json(b?.cur ? { kind: b.cur.sv.pub.kind, key: b.cur.sv.key } : null); });
const { SESS, BY_ID } = _lingoTest;
app.get("/__ans", (q, r) => { const s = SESS.get(String(q.query.sid)); const i = Number(q.query.i); const sv = s?.served?.[i]; const qq = s && BY_ID.get(s.plan[i]?.id); r.json(sv ? { kind: sv.pub.kind, key: sv.key, text: qq?.text } : null); });
app.get("/__front", (q, r) => { const s = SESS.get(String(q.query.sid)); if (!s) return r.json({ ok: false }); const want = String(q.query.kinds || "").split(","); const pick = []; for (const k of want) { const j = s.plan.findIndex((x, n) => !pick.includes(n) && BY_ID.get(x.id)?.kind === k); if (j >= 0) pick.push(j); } s.plan = [...pick.map((j) => s.plan[j]), ...s.plan.filter((_, n) => !pick.includes(n))]; r.json({ ok: true, kinds: pick.map((j) => BY_ID.get(s.plan[pick.indexOf(j)]?.id)?.kind) }); });
app.get("/__db", (_q, r) => r.json(Object.fromEntries(Object.entries(sb.DB).map(([k, v]) => [k, v.length]))));
const T = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2", ".ogg": "audio/ogg", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".md": "text/plain; charset=utf-8", ".ico": "image/x-icon", ".svg": "image/svg+xml" };
app.use((req, res) => {
  const u = decodeURIComponent(req.path), p = path.join(ROOT, u === "/" ? "lingo.html" : u);
  if (!p.startsWith(ROOT)) return res.status(403).end();
  if (/lingo-bank/.test(u)) return res.status(404).end();
  fs.readFile(p, (e, d) => { if (e) return res.status(404).end("nf"); if (u.endsWith("/js/config.js")) d = Buffer.from(String(d).replace("https://worldcup-backend-leee.onrender.com", `http://localhost:${PORT}`)); res.set("content-type", T[path.extname(p)] || "application/octet-stream").send(d); });
});
server.listen(PORT, () => console.log(`lingo dev http://localhost:${PORT}/lingo.html`));
