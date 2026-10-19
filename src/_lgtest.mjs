import http from "http";
import { Server } from "socket.io";
import pkg from "socket.io-client"; const Client = pkg.io || pkg;
import { registerLifegame } from "./lifegame.js";
const srv = http.createServer();
const io = new Server(srv, { cors: { origin: "*" } });
io.use((s, n) => { const id = s.handshake.auth.uid; s.user = { id, isGuest: false }; n(); });
const stub = { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { nickname: "x", avatar_url: null } }) }) }) }) };
registerLifegame(io, stub);
await new Promise(r => srv.listen(0, r));
const port = srv.address().port;
const mk = (uid) => Client(`http://localhost:${port}`, { auth: { uid } });
const a = mk("A"), b = mk("B");
await new Promise(r => setTimeout(r, 300));
const em = (s, ev, p) => new Promise(r => s.emit(ev, p, r));
const c = await em(a, "lifegame:createRoom", { turnTimeSec: 5, maxPlayers: 2, gender: "M" });
console.log("create", c.ok, c.inviteCode);
console.log("join", (await em(b, "lifegame:joinRoom", { inviteCode: c.inviteCode, gender: "F" })).ok);
for (const [n, s] of [["A", a], ["B", b]]) {
  s.on("lifegame:turnStart", (d) => {
    if (d.userId === n || d.currentUserId === n || d.playerId === n) {
      const ch = d.event?.choices?.[0]?.id; if (ch) s.emit("lifegame:submitChoice", { choiceId: ch }, () => {});
    }
  });
  s.on("lifegame:miniIntro", d => console.log(n, "intro", d.kind));
  s.on("lifegame:miniWait", d => console.log(n, "wait"));
  s.on("lifegame:miniGo", d => {
    console.log(n, "go", d.kind);
    const t0 = Date.now();
    setTimeout(() => {
      const el = Date.now() - t0;
      const pl = d.kind === "reflex" ? {} : d.kind === "mash" ? { count: 40 } : d.kind === "stop" ? { elapsedMs: 3000 } : d.kind === "tap" ? { elapsedMs: 5000 } : { choiceIdx: d.__ans ?? 0 };
      s.emit("lifegame:miniAct", pl, (r) => console.log(n, "act ack", d.kind, JSON.stringify(r)));
    }, d.kind === "reflex" ? 300 : d.kind === "stop" ? 3000 : d.kind === "tap" ? 5000 : d.kind === "mash" ? 5000 : 500);
  });
  s.on("lifegame:miniResult", d => { console.log(n, "RESULT", d.kind, d.rows.map(r => `${r.name}:${r.display}`).join(" | ")); });
}
// 어떤 이벤트가 오는지 turnStart 형태 확인
a.on("lifegame:turnStart", d => { if (!globalThis.__shown) { globalThis.__shown = 1; console.log("turnStart keys", Object.keys(d)); } });
await em(a, "lifegame:startGame", {});
setTimeout(() => { console.log("timeout end"); process.exit(0); }, 70000);
