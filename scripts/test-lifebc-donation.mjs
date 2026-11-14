// 인생 방송국 — 💝 후원 방송 모드 서버 시험 (금액 읽기·중복·전달·재접속 기록·일반 방송 무시)
import http from "http";
import { Server } from "socket.io";
import ioc from "socket.io-client";
import { registerLifeBroadcast, lbcDonation, lbcIsDon } from "../src/lifebc-broadcast.js";

let fail = 0, pass = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const server = http.createServer(), io = new Server(server, { allowEIO3: true });
io.use((s, next) => { s.user = { id: s.handshake.query.gid, isGuest: true }; next(); });
const logs = []; const sb = { from: () => ({ insert: (row) => { logs.push(row); return Promise.resolve({}); } }) };
registerLifeBroadcast(io, sb, null);
await new Promise((r) => server.listen(0, r));
const URL0 = `http://localhost:${server.address().port}`;
const conn = (gid) => new Promise((res) => { const s = ioc(URL0, { query: { gid }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));

const H = await conn("host"), V = await conn("viewer"), N = await conn("normal");
const got = [], gotV = [], gotN = []; H.on("lbc:donation", (d) => got.push(d)); V.on("lbc:donation", (d) => gotV.push(d)); N.on("lbc:donation", (d) => gotN.push(d));
const { id } = await emit(H, "lbc:create", { nick: "방장", title: "후원방", don: true });
const { id: nid } = await emit(N, "lbc:create", { nick: "일반", title: "보통" });
await emit(V, "lbc:join", { id, nick: "시청자" });
ok(lbcIsDon(id) && !lbcIsDon(nid), "후원 모드 표시는 후원방만");
await wait(50);
ok(logs.some((r) => r.channel_id === id && r.content_mode === "donation" && /후원 방송 모드/.test(r.content_title)), "admin 기록: 후원 방송 모드");
ok(logs.some((r) => r.channel_id === nid && r.content_mode === "normal"), "일반 방송 기록은 그대로");

// 치지직: 원 단위 문자열
lbcDonation(id, "chzzk", { payAmount: "1,000", donatorNickname: "철수", donatorChannelId: "c1", donationText: "!고백 A B" });
lbcDonation(id, "chzzk", JSON.stringify({ payAmount: "5000", donatorNickname: "", donatorChannelId: "", donationText: "" })); // 익명
await wait(80);
ok(got.length === 2 && got[0].amount === 1000 && got[0].donor === "철수" && got[0].text === "!고백 A B" && got[0].platform === "chzzk", "치지직 후원 전달");
ok(got[1].amount === 5000 && got[1].donor === "", "익명 후원도 전달 (이름은 화면에서 '익명 후원자')");
ok(gotV.length === 0, "시청자에게는 안 감 (스트리머만)");
// 중복: 같은 내용 3초 안
lbcDonation(id, "chzzk", { payAmount: "1000", donatorNickname: "철수", donatorChannelId: "c1", donationText: "!고백 A B" }); await wait(50);
ok(got.length === 2, "치지직 같은 내용 3초 안 = 중복으로 거름");
lbcDonation(id, "chzzk", { payAmount: "1000", donatorNickname: "영희", donatorChannelId: "c2", donationText: "!고백 A B" }); await wait(50);
ok(got.length === 3, "다른 사람이면 같은 금액·문구도 따로");
// 씨미: 빔 그대로 (원 환산은 화면 설정)
lbcDonation(id, "cime", { payAmountNumber: 300, donatorNickname: "민수", donationText: "hi" }); await wait(50);
ok(got[3]?.beam === 300 && got[3].amount == null && got[3].platform === "cime", "씨미는 빔으로 전달");
// SOOP: 별풍선 × 100원, 연달아도 안 거름
lbcDonation(id, "soop", { balloons: 10, donatorNickname: "풍선", donatorChannelId: "s1" }); lbcDonation(id, "soop", { balloons: 10, donatorNickname: "풍선", donatorChannelId: "s1" }); await wait(50);
ok(got[4]?.amount === 1000 && got[5]?.amount === 1000, "SOOP 별풍선 10개 = 1,000원, 연달아 2번 다 들어옴");
// 이상한 값
const before = got.length;
for (const bad of [{ payAmount: "abc" }, { payAmount: "-5" }, { payAmount: "0" }, null, "{bad json", { payAmount: "999999999999" }]) lbcDonation(id, "chzzk", bad);
lbcDonation(id, "soop", { balloons: 1.5 }); lbcDonation(id, "cime", { payAmountNumber: "x" }); await wait(50);
ok(got.length === before, "잘못된 금액은 버림");
// 닉네임·메시지 정리 (태그 제거·길이 제한)
lbcDonation(id, "chzzk", { payAmount: "2000", donatorNickname: "<b>아주아주아주긴닉네임입니다요</b>", donatorChannelId: "c9", donationText: "<script>x</script>" }); await wait(50);
const L = got[got.length - 1]; ok(!/[<>]/.test(L.donor) && L.donor.length <= 16 && !/[<>]/.test(L.text), "닉네임·메시지에서 < > 제거, 16자 제한");
// 일반 방송은 무시
lbcDonation(nid, "chzzk", { payAmount: "1000", donatorNickname: "x" }); await wait(50);
ok(gotN.length === 0, "일반 스트리머 모드 방송엔 후원 안 감");
lbcDonation("nope", "chzzk", { payAmount: "1000" }); ok(true, "없는 방송이면 조용히 무시");
// 재접속 기록: 방장만
const lg = await emit(H, "lbc:donLog", { id }); ok(lg.ok && lg.rows.length === got.length && lg.rows[0].did === got[0].did, "방장은 최근 후원 기록 받음 (재접속용)");
ok((await emit(V, "lbc:donLog", { id })).error === "NOT_HOST", "시청자는 후원 기록 못 받음");
ok(new Set(got.map((d) => d.did)).size === got.length, "후원마다 고유 번호(did)");
// 끝난 방송
await emit(H, "lbc:end", { id }); const n0 = got.length; lbcDonation(id, "chzzk", { payAmount: "1000", donatorChannelId: "zz" }); await wait(50);
ok(got.length === n0, "끝난 방송엔 안 감");

console.log(`lifebc donation: ${pass} pass, ${fail} fail`);
H.close(); V.close(); N.close(); io.close(); server.close(); process.exit(fail ? 1 : 0);
