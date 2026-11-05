// 인생 방송국 시즌 결과 서버 시험 — 시청자 출연자 각자 자기 결과만 받는지 (8명), 재접속, 위장 방지
process.env.LBC_RL = "100000";
import http from "http";
import { Server } from "socket.io";
import ioc from "socket.io-client";
import { registerLifeBroadcast } from "../src/lifebc-broadcast.js";

let fail = 0, pass = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const server = http.createServer(), io = new Server(server, { allowEIO3: true });
io.use((s, next) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_") }; next(); });
registerLifeBroadcast(io, null, null);
await new Promise((r) => server.listen(0, r));
const URL0 = `http://localhost:${server.address().port}`;
const conn = (id) => new Promise((res) => { const s = ioc(URL0, { query: { uid: id }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));

const H = await conn("guest_host_season"); const bc = (await emit(H, "lbc:create", { nick: "스트리머", intensity: "high" })).id; ok(!!bc, "방송 시작");
const V = []; for (let i = 0; i < 8; i++) { const s = await conn("guest_vw_" + i); await emit(s, "lbc:join", { id: bc, nick: "시청자" + i }); V.push(s); }
// 7명 신청 → 스트리머가 모두 수락 (8번째는 그냥 시청)
for (let i = 0; i < 7; i++) ok((await emit(V[i], "lbc:apply", { id: bc, nick: "캐릭" + i, look: { base: i % 6, hair: i, shirt: i, pants: 1, skin: 1 }, preset: "joker", goal: "star" })).ok, "출연 신청 " + i);
const apps = (await emit(H, "lbc:apps", { id: bc })).rows; ok(apps.length === 7, "신청 7건");
const appOf = {}; for (const a of apps) { const r = await emit(H, "lbc:accept", { id: bc, appId: a.id }); ok(r.ok && !("key" in r.app), "수락 (신청자 내부 키는 안 내보냄)"); appOf[r.app.nick] = r.app.id; }
// 시즌 결과: 각 캐릭터 카드 + 존재하지 않는 신청서 하나
const cards = Object.entries(appOf).map(([nick, appId]) => ({ appId, card: { name: { ko: nick, ja: nick, en: nick }, rank: +nick.slice(-1) + 1, story: { ko: nick + "의 이야기" } } }));
cards.push({ appId: "fake-app", card: { name: { ko: "가짜" } } });
ok((await emit(V[0], "lbc:season", { id: bc, pub: {}, cards })).error === "NOT_HOST", "시청자는 결과를 못 올림");
const up = await emit(H, "lbc:season", { id: bc, pub: { grade: "A", day: 30 }, cards }); ok(up.ok && up.linked === 7, `결과 올리기: 7명 연결 (가짜 신청서는 무시) — ${up.linked}`);
// 8명 각자 확인
for (let i = 0; i < 7; i++) { const r = await emit(V[i], "lbc:myResult", { id: bc }); ok(r.ok && r.card?.name?.ko === "캐릭" + i && r.cast, `시청자${i}: 자기 캐릭터 결과만 (${r.card?.name?.ko})`); }
const r7 = await emit(V[7], "lbc:myResult", { id: bc }); ok(r7.ok && r7.card === null && !r7.cast && r7.pub?.grade === "A", "출연 안 한 시청자: 공개 요약만");
const rh = await emit(H, "lbc:myResult", { id: bc }); ok(rh.ok && rh.card === null, "스트리머 쪽 소켓도 남의 카드는 안 받음 (스트리머는 화면에서 전체를 봄)");
// 재접속(같은 계정) → 같은 결과
V[3].disconnect(); const V3 = await conn("guest_vw_3"); const r3 = await emit(V3, "lbc:myResult", { id: bc }); ok(r3.ok && r3.card?.name?.ko === "캐릭3", "재접속해도 내 결과 그대로");
// 다른 계정이 남의 결과를 요구할 방법 없음 (요청에 누구 것인지 넣어도 무시)
const spoof = await emit(V[7], "lbc:myResult", { id: bc, appId: appOf["캐릭1"], key: "g:guest_vw_1" }); ok(spoof.card === null, "남의 신청서·키를 넣어도 본인 것만");
// 방송이 끝나도 결과는 볼 수 있음
await emit(H, "lbc:end", { id: bc }); const r0 = await emit(V[0], "lbc:myResult", { id: bc }); ok(r0.ok && r0.card?.name?.ko === "캐릭0", "방송 종료 후에도 결과 확인");
const big = await emit(H, "lbc:season", { id: bc, pub: { x: "y".repeat(310000) }, cards: [] }); ok(big.error === "TOO_BIG" || big.error === "NOT_HOST", "너무 큰 결과 거절");
for (const s of [H, V3, ...V]) s.disconnect();
console.log(`통과 ${pass} · 실패 ${fail}`); server.close(); setTimeout(() => process.exit(fail ? 1 : 0), 200);
