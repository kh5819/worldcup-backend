import http from "http"; import fs from "fs"; import path from "path";
import { Server } from "socket.io";
import { registerGachatd } from "./gachatd.js";
const ROOT = "D:/worldcup-project/홈페이지 제작";
const mime = { ".html":"text/html;charset=utf-8", ".js":"text/javascript;charset=utf-8", ".css":"text/css;charset=utf-8", ".png":"image/png", ".svg":"image/svg+xml", ".ico":"image/x-icon", ".mp3":"audio/mpeg", ".webp":"image/webp" };
export async function start() {
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split("?")[0]);
    if (p.startsWith("/socket.io")) return;
    const f = path.join(ROOT, p);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    let body = fs.readFileSync(f);
    if (p.endsWith("/js/config.20260212_5.js")) {
      body = body.toString("utf8").replace('"https://worldcup-backend-leee.onrender.com"', '"http://127.0.0.1:' + srv.address().port + '"');
    } else if (p.endsWith("/js/auth.20260212_5.js")) {
      body = body.toString("utf8") + '\naccessToken = "e2e-test-token";\n';
    }
    r.writeHead(200, { "content-type": mime[path.extname(f)] || "application/octet-stream" }); r.end(body);
  });
  const io = new Server(srv, { cors: { origin: "*" } });
  io.use((s, n) => {
    const g = s.handshake.auth?.guestId || ("u_" + Math.random().toString(36).slice(2, 8));
    s.user = { id: g, isGuest: false };
    n();
  });
  registerGachatd(io, { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) }) });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  return { port: srv.address().port, close() { try { io.close(); } catch {} try { srv.close(); } catch {} } };
}
