// 차고차고 로컬 개발 서버 — 운영 DB·서비스에 연결하지 않는다.
//   · 프론트(홈페이지 제작/)를 정적으로 서빙하되, config.js 의 BACKEND_URL 만 로컬 주소로 바꿔 내보낸다(파일은 안 건드림)
//   · socket.io 에는 registerChago 만 등록. 게스트 id 도 방 만들기 가능(개발 편의)
//   node scripts/chago-dev-server.mjs [포트=5177]   →  http://localhost:5177/chago.html
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Server } from "socket.io";
import { registerChago } from "../src/chago.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, "..", "..", "홈페이지 제작");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".ico": "image/x-icon", ".svg": "image/svg+xml", ".json": "application/json", ".webp": "image/webp" };

export async function startDevServer(port = 0) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    let p = decodeURIComponent(url.pathname);
    if (p === "/") p = "/chago.html";
    const file = path.normalize(path.join(ROOT, p));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("not found"); }
    let body = fs.readFileSync(file);
    if (path.basename(file) === "config.js") {
      const origin = `http://localhost:${server.address().port}`;
      body = Buffer.from(body.toString("utf8").replace(/export const BACKEND_URL_RAW = "[^"]*"/, `export const BACKEND_URL_RAW = "${origin}"`));
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(body);
  });
  const io = new Server(server, { cors: { origin: true, credentials: true } });
  io.use((socket, next) => {
    const g = socket.handshake.auth?.guestId;
    if (!g) return next(new Error("UNAUTHORIZED"));
    socket.user = { id: g, isGuest: false, isAdmin: false };   // 개발 서버: 누구나 방 만들기 가능
    next();
  });
  registerChago(io, { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }) }) });
  await new Promise((r) => server.listen(port, r));
  return { server, io, port: server.address().port, close: () => new Promise((r) => { io.close(); server.close(r); }) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { port } = await startDevServer(Number(process.argv[2]) || 5177);
  console.log(`차고차고 개발 서버: http://localhost:${port}/chago.html  (Ctrl+C 로 종료)`);
}
