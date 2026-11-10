// 방송국 서바이벌 소켓 악용·경계 시험: 조작 값, 관전 나가기, 강퇴, 대기실 재접속, 이상한 닉네임, 계약 남발. PORT=5199 시험 서버(LBS_DEBUG=1) 필요
import io from "socket.io-client"; const URL = process.env.URL || "http://localhost:5199";
const mk = (id) => new Promise((res) => { const s = io(URL, { query: { uid: id }, forceNew: true, transports: ["websocket"] }); s.state = null; s.n = 0; s.on("lbs:state", (v) => { s.state = v; s.n++; }); s.on("lbs:lobby", (v) => (s.lobby = v)); s.on("lbs:closed", (x) => (s.closed = x)); s.on("connect", () => res(s)); });
const call = (s, ev, p) => new Promise((r) => { const to = setTimeout(() => r({ ok: false, error: "TIMEOUT" }), 6000); s.emit(ev, p, (x) => { clearTimeout(to); r(x); }); }); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (n, c, x = "") => { console.log(`${c ? "✅" : "❌"} ${n}${x !== "" ? " — " + x : ""}`); if (!c) process.exitCode = 1; };
const id = Date.now().toString(36);
// 1. 이상한 닉네임: 서버가 다듬은 이름을 돌려줌
const H = await mk(`ab${id}h`); const c = await call(H, "lbs:create", { nick: "  방장<b>   왕  ", max: 6 }); ok("다듬은 닉네임 회신", c.ok && c.nick === "방장b 왕" && c.lobby.players[0].nick === c.nick, c.nick); const code = c.code;
const P = []; for (let i = 0; i < 3; i++) { const s = await mk(`ab${id}p${i}`); const r = await call(s, "lbs:join", { code, nick: "참가" + i }); ok("입장 " + i, r.ok && r.nick === "참가" + i); P.push(s); }
// 2. 대기실에서 끊겼다 다시 들어오면 명단 유지
P[0].disconnect(); await sleep(300); ok("끊기면 오프라인 표시", H.lobby?.players.find((p) => p.nick === "참가0")?.online === false);
P[0].connect(); await new Promise((r) => P[0].once("connect", r)); const rj = await call(P[0], "lbs:join", { code, nick: "참가0" }); await sleep(200); ok("대기실 재접속 복귀", rj.ok && H.lobby.players.find((p) => p.nick === "참가0")?.online === true);
// 3. 관전 나가기
const W = await mk(`ab${id}w`); await call(W, "lbs:spectate", { code }); await sleep(200); ok("관전자 수 1", H.lobby.spectators === 1); await call(W, "lbs:leave", { code }); await sleep(250); ok("관전 나가면 0", H.lobby.spectators === 0);
// 4. 강퇴: 방장만, 강퇴되면 재입장 불가
const k1 = await call(P[1], "lbs:kick", { code, order: 3 }); ok("방장 아니면 강퇴 불가", !k1.ok);
const k2 = await call(H, "lbs:kick", { code, order: 3 }); await sleep(200); ok("강퇴 성공·통지", k2.ok && P[2].closed?.reason === "KICKED"); const k3 = await call(P[2], "lbs:join", { code, nick: "다시" }); ok("강퇴자 재입장 막힘", k3.error === "BANNED");
// 5. 설정 조작 값
await call(H, "lbs:settings", { code, diff: "constructor", speed: "1e9", max: -5 }); ok("이상한 설정 무시", H.lobby.diff === "hard" && H.lobby.speed === 1 && H.lobby.max >= H.lobby.players.length);
for (const s of P.slice(0, 2)) await call(s, "lbs:ready", { code, ready: true });
const st = await call(H, "lbs:start", { code }); ok("시작", st.ok); await sleep(400);
// 6. 게임 중 조작 값: 편성·계약·알리바이·질문 이름에 constructor 등
const g = H.state; const meSeat = g.me.seat;
const bad = [["program", { id: "constructor" }], ["program", { id: "__proto__" }], ["ct_propose", { type: "constructor", to: (meSeat + 1) % 6 }], ["ct_propose", { type: "toString", to: (meSeat + 1) % 6 }], ["agenda", { i: "constructor" }], ["action", { id: "constructor" }], ["statement", { id: 1, mode: "constructor" }], ["zz", {}], ["c_alibi", { loc: "constructor" }]];
let allBad = true; for (const [t, d] of bad) { const r = await call(H, "lbs:act", { code, type: t, d }); for (const s of P.slice(0, 2)) await call(s, "lbs:act", { code, type: t, d }); if (r.ok && t !== "agenda") { allBad = false; console.log("   통과됨:", t, JSON.stringify(d)); } }
ok("조작 값 전부 거절", allBad); await sleep(200); ok("돈이 숫자", Number.isFinite(H.state.m.money));
// 7. 이상한 type·형식
for (const p of [null, 5, "x", [], { type: { a: 1 } }, { code, type: "done", d: "str" }]) await call(H, "lbs:act", p); ok("이상한 형식에도 서버 살아 있음", (await call(H, "lbs:meta", {})).ok);
// 8. 계약 남발: 하루 3번, 거절당한 상대에게 같은 날 다시 못 함
let sent = 0, last = null; for (let i = 0; i < 12; i++) { const r = await call(H, "lbs:act", { code, type: "ct_propose", d: { type: "info", to: (meSeat + 1 + (i % 5)) % 6 } }); if (r.ok) sent++; else last = r.error; } ok("하루 계약 제안 3번까지", sent <= 3, `${sent}건, 마지막 ${last}`);
// 9. 후보 조작
const r9 = await call(H, "lbs:act", { code, type: "ct_propose", d: { type: "support", to: (meSeat + 1) % 6, candidate: 99 } }); ok("없는 후보 거절", !r9.ok, r9.error);
// 10. 남의 방 조작
const O = await mk(`ab${id}o`); const oc = await call(O, "lbs:create", { nick: "다른방", max: 2 }); const r10 = await call(H, "lbs:act", { code: oc.code, type: "done", d: {} }); ok("남의 방 행동 거부", !r10.ok);
// 11. 속도 제한
let limited = 0; await Promise.all(Array.from({ length: 120 }, () => call(O, "lbs:meta", {}).then((r) => { if (r.error === "RATE_LIMITED") limited++; }))); ok("과도한 요청 제한", limited > 0, limited + "건 제한");
// 12. 관전 중 재접속 뒤 계속 받기
const W2 = await mk(`ab${id}w2`); await call(W2, "lbs:spectate", { code }); const n0 = W2.n; W2.disconnect(); W2.connect(); await new Promise((r) => W2.once("connect", r)); await call(W2, "lbs:spectate", { code }); await call(H, "lbs:act", { code, type: "done", d: {} }); await sleep(600); ok("관전 재접속 뒤 상태 수신", W2.n > n0 && !W2.state.me);
for (const s of [H, ...P, W, O, W2]) s.close(); process.exit();
