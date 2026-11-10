// 플듀 마피아 v2 서버 시험 — node scripts/test-mafia.mjs
import http from "http";
import express from "express";
import { Server } from "socket.io";
import ioc from "socket.io-client";
import { registerMafia, _setTimeScale, mfChatCommand, _sim } from "../src/mafia.js";
import { buildRoles, validateRoles, ROLES, ROLE_IDS, INCIDENT_IDS, MINIGAMES } from "../src/mafia-data.js";
import { makeCase, checkSolve, forgeClue, NPC } from "../src/mafia-cases.js";

let fail = 0, pass = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ROLE_RE = new RegExp(`"role":"(${ROLE_IDS.join("|")})"`);
const leak = (pub) => pub.status !== "ended" && pub.players.some((p) => p.role && p.alive);

// ── 1. 데이터 ──
ok(ROLE_IDS.length >= 15, `직업 ${ROLE_IDS.length}종`); ok(INCIDENT_IDS.length >= 20, `특별 사건 ${INCIDENT_IDS.length}종`); ok(Object.keys(MINIGAMES).length >= 8, `미니게임 ${Object.keys(MINIGAMES).length}종`);
for (let n = 5; n <= 30; n++) { let r; try { r = buildRoles(n); } catch { r = null; } ok(r && r.length === n && validateRoles(r).ok, `${n}명 구성 검증`); }
ok(!buildRoles(15, new Set(["survivor", "reporter"])).some((x) => x === "survivor" || x === "reporter"), "직업 끄기");

// ── 2. 미니게임 8종 ──
for (const mg of Object.keys(MINIGAMES)) {
  let bad = 0;
  for (let i = 0; i < 800; i++) {
    const n = 4 + (i % 2), sus = Array.from({ length: n }, (_, k) => ({ id: "u" + k, nick: "n" + k })); if (i % 3 === 0) sus[n - 1] = { ...NPC };
    const cul = sus[i % n].id, c = makeCase(mg, sus, cul);
    if (!checkSolve(c, c.answer) || checkSolve(c, c.solveKind === "order" ? [...c.answer].reverse() : c.solveKind === "pair" ? ["x", "y"] : "zzz")) bad++;
    if (c.truthMemo === cul || !c.reward?.verified) bad++;
    const fc = c.clues.find((x) => !x.public); if (fc && !forgeClue(fc, c).forged) bad++;
  }
  ok(bad === 0, `미니게임 ${MINIGAMES[mg]} 800회 (오류 ${bad})`);
}

// ── 3. 밤 능력 상호작용 ──
const fakeIo = { to: () => ({ emit() {} }), in: () => ({ socketsLeave() {} }), sockets: { sockets: new Map() } };
_setTimeScale(1000);
function mkRoom(roles) {
  const room = _sim.createRoom({ id: "h0", isGuest: true }, "h", { hostMode: "mc", max: 30 });
  roles.forEach((r, i) => { const p = _sim.newPlayer("u" + i, "p" + i, {}); p.role = r; room.players.set(p.uid, p); room.order.push(p.uid); });
  _sim.seatList(room); room.status = "playing"; room.settings.incidents = false; _sim.startNight(fakeIo, room); return room;
}
const res = (room, u) => room.players.get(u).results.at(-1);
{ const r = mkRoom(["mafia", "disguiser", "investigator", "analyst", "citizen", "citizen", "medic"]);
  r.night.acts.set("u1", { a: "disguise", t: "u0" }); r.night.acts.set("u2", { a: "check", t: "u0" }); r.night.acts.set("u3", { a: "analyze", t: "u0" }); r.night.kills.set("u0", "u4"); _sim.resolveNight(fakeIo, r);
  ok(res(r, "u2").result === "town", "위장 → 수사관 결과 반전"); ok(res(r, "u3").result === "trace", "분석가가 위장 흔적 발견"); ok(!r.players.get("u4").alive, "보호 없는 습격 성공"); }
{ const r = mkRoom(["mafia", "mafia", "bodyguard", "medic", "citizen", "citizen", "citizen", "investigator"]);
  r.night.kills.set("u0", "u4"); r.night.kills.set("u1", "u4"); r.night.acts.set("u2", { a: "guard", t: "u4" }); _sim.resolveNight(fakeIo, r);
  ok(r.players.get("u4").alive && !r.players.get("u2").alive, "경호원이 대신 쓰러짐");
  const r2 = mkRoom(["mafia", "medic", "citizen", "citizen", "citizen", "investigator"]);
  r2.night.kills.set("u0", "u2"); r2.night.acts.set("u1", { a: "protect", t: "u2" }); _sim.resolveNight(fakeIo, r2);
  ok(r2.players.get("u2").alive && res(r2, "u1").result === "saved", "의무관 보호 성공"); }
{ const r = mkRoom(["mafia", "investigator", "watcher", "citizen", "citizen", "medic"]);
  r.nightFlags.blackout = true; r.night.acts.set("u1", { a: "check", t: "u0" }); r.night.acts.set("u2", { a: "watch", t: "u3" }); r.night.kills.set("u0", "u3"); _sim.resolveNight(fakeIo, r);
  ok(res(r, "u1").result === "blackout" && res(r, "u2").visitors === "blackout", "정전이면 정보 없음");
  const m = mkRoom(["mafia", "investigator", "citizen", "citizen", "citizen", "medic"]);
  m.nightFlags.missing = "u3"; m.night.kills.set("u0", "u3"); _sim.resolveNight(fakeIo, m); ok(m.players.get("u3").alive, "실종자는 습격 대상 안 됨");
  const m2 = mkRoom(["mafia", "investigator", "citizen", "citizen", "citizen", "medic"]);
  m2.nightFlags.missing = "u1"; m2.night.acts.set("u1", { a: "check", t: "u0" }); _sim.resolveNight(fakeIo, m2); ok(!m2.players.get("u1").results.length, "실종자는 행동 못 함"); }
{ const r = mkRoom(["mafia", "watcher", "reporter", "detective", "informant", "citizen", "medic", "citizen", "citizen"]);
  r.night.kills.set("u0", "u5"); r.night.acts.set("u1", { a: "watch", t: "u5" }); r.night.acts.set("u2", { a: "follow", t: "u0" }); r.night.acts.set("u3", { a: "compare", t: "u0", t2: "u4" }); r.night.acts.set("u4", { a: "spy", t: "u6" }); _sim.resolveNight(fakeIo, r);
  ok(res(r, "u1").visitors.includes("u0"), "감시자: 습격자 방문 확인"); ok(res(r, "u2").visited === "u5", "기자: 미행 대상의 방문지");
  ok(res(r, "u3").result === "same", "탐정: 같은 진영 비교"); ok(res(r, "u4").result === "medic", "정보원: 정확한 직업"); }
{ const r = mkRoom(["mafia", "traitor", "citizen", "citizen", "citizen", "medic", "investigator"]);
  r.night.kills.set("u0", "u2"); _sim.resolveNight(fakeIo, r);
  ok(r.players.get("u1").converted && _sim.privateState(r, "u0").teammates.some((t) => t.uid === "u1"), "배신자 전향 + 조작단이 새 동료를 앎"); }
{ const r = mkRoom(["mafia", "survivor", "citizen", "citizen", "citizen", "medic"]);
  r.night.kills.set("u0", "u1"); r.night.acts.set("u1", { a: "vest", t: "u1" }); _sim.resolveNight(fakeIo, r);
  ok(r.players.get("u1").alive && r.players.get("u1").uses.survivor === 1, "생존자 방탄조끼"); }
{ // 특별 사건: 실제 상태와 연결
  const r = mkRoom(["mafia", "mafia", "investigator", "medic", "citizen", "citizen", "citizen", "citizen"]); r.phase.day = 3;
  const inc = _sim.applyIncident(r, "leak"); ok(/2명/.test(inc.text), "내부 정보 유출 = 실제 조작단 수");
  const tip = _sim.applyIncident(r, "anon_tip"); ok(!["u0", "u1"].includes(tip.target), "익명 제보 대상은 실제로 조작단 아님");
  const sm = _sim.applyIncident(r, "secret_meeting"); const names = sm.text.match(/(p\d) 님과 (p\d) 님/); ok(names && [names[1], names[2]].filter((n) => ["p0", "p1"].includes(n)).length === 1, "비밀 회의 = 정확히 한 명 조작단");
  _sim.applyIncident(r, "threat"); ok(r.nightFlags.noProtect && !["u0", "u1"].includes(r.nightFlags.noProtect), "협박장 대상 설정");
}
_setTimeScale(1);

// ── 4. 소켓 통합 ──
_setTimeScale(0.03);
const app = express(), server = http.createServer(app), io = new Server(server, { allowEIO3: true });
io.use((s, next) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_") }; next(); });
registerMafia(io);
await new Promise((r) => server.listen(0, r));
const URL = `http://localhost:${server.address().port}`;
const conn = (id) => new Promise((res) => { const s = ioc(URL, { query: { uid: id }, transports: ["websocket"], forceNew: true, reconnection: false }); s.chats = []; s.fx = []; s.on("mf:pub", (d) => (s.pub = d)); s.on("mf:me", (d) => (s.me = d)); s.on("mf:chat", (m) => s.chats.push(m)); s.on("mf:fx", (f) => s.fx.push(f)); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
const until = async (fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await wait(15); } return false; };

const H = await conn("guest_host");
ok((await emit(H, "mf:create", {})).error === "NEED_NICK", "닉네임 필수"); await wait(850);
ok((await emit(H, "mf:create", { nick: "운영자" })).error === "BAD_NICK", "사칭 닉네임 막기"); await wait(850);
const cr = await emit(H, "mf:create", { nick: "방장", max: 10, streamer: true }); ok(cr.ok && cr.obsKey, "방 만들기 (게스트)");
const CODE = cr.code, ps = [H];
for (let i = 1; i <= 5; i++) { const s = await conn("guest_p" + i); ok((await emit(s, "mf:join", { code: CODE.toLowerCase(), nick: "참가" + i })).ok, "참가 " + i); ps.push(s); }
ok((await emit(await conn("guest_d"), "mf:join", { code: CODE, nick: "참가1" })).error === "NICK_TAKEN", "같은 닉네임 막기");
const spec = await conn("guest_spec"); ok((await emit(spec, "mf:join", { code: CODE, nick: "구경", spectate: true })).spectator, "관전 입장");
const obs = await conn("guest_obs"); const obsStates = []; obs.on("mf:obs", (d) => obsStates.push(d));
ok((await emit(obs, "mf:obs", { code: CODE, key: "x" })).error === "BAD_KEY", "OBS 키 확인"); ok((await emit(obs, "mf:obs", { code: CODE, key: cr.obsKey })).ok, "OBS 연결");
await emit(H, "mf:bots", { n: 2 });
ok((await emit(H, "mf:start", {})).error === "NOT_READY", "준비 안 된 사람 있으면 시작 안 됨");
for (const s of ps.slice(1)) await emit(s, "mf:ready", { ready: true });
ok((await emit(H, "mf:start", {})).ok, "모두 준비 → 카운트다운");
ok(await until(() => H.pub.status === "playing"), "게임 시작");
await wait(80);
ok(ps.every((s) => s.me?.role), "각자 직업 받음");
ok(!leak(H.pub) && !leak(spec.pub) && obsStates.every((o) => !leak(o)), "공개·관전·OBS에 직업 없음");
ok(!ROLE_RE.test(JSON.stringify(obsStates) + JSON.stringify(spec.pub)), "OBS·관전 데이터에 직업 문자열 0");
ok(!JSON.stringify(obsStates).includes(cr.obsKey) && !JSON.stringify(spec.me || {}).includes(cr.obsKey), "OBS 키는 방장만");
const r0 = ps[2].me.role; ps[2].disconnect(); await wait(60); const re = await conn("guest_p2"); const rj = await emit(re, "mf:join", { code: CODE }); await wait(60);
ok(rj.rejoin && re.me?.role === r0, "재접속하면 같은 직업 유지"); ps[2] = re;
ok(await until(() => H.pub.phase.name === "night"), "밤 시작");
const maf = ps.find((s) => ROLES[s.me.role].team === "mafia"), civ = ps.find((s) => ROLES[s.me.role].team !== "mafia" && s.me.role !== "traitor");
if (maf) { const b1 = spec.chats.length, b2 = civ.chats.length; ok((await emit(maf, "mf:chat", { ch: "mafia", text: "비밀" })).ch === "mafia", "조작단 밤 채팅"); await wait(50); ok(spec.chats.length === b1 && civ.chats.length === b2, "조작단 채팅 비밀 유지"); }
ok((await emit(civ, "mf:chat", { text: "밤" })).error === "NIGHT_SILENT", "밤엔 시민 채팅 불가");
ok((await emit(spec, "mf:chat", { text: "관전" })).error === "SPECTATOR", "관전자 채팅 불가");
ok((await emit(civ, "mf:act", { target: civ.me.uid, seq: 0 })).ok === false, "이전 단계(seq) 요청 거절");
ok(await until(() => ["vote", "nominate"].includes(H.pub.phase.name), 15000), "투표 시간");
if (H.pub.phase.name === "vote" && _sim.rooms.get(CODE)?.phase.name === "vote") {
  const voter = ps.find((s) => s.me.alive && !s.me.silenced), target = H.pub.players.find((p) => p.alive && p.uid !== voter.me.uid);
  for (let i = 0; i < 3; i++) await emit(voter, "mf:vote", { target: target.uid });
  await wait(30); ok((H.pub.vote.counts[target.uid] || 0) <= H.pub.players.filter((p) => p.alive && p.bot).length + 1, "중복 투표해도 1표");
  const room = _sim.rooms.get(CODE), seat = room.order.map((u) => room.players.get(u)).find((q) => q.alive).seat;
  ok(mfChatCommand(CODE, "c1", "시청자1", "!" + seat)?.kind === "jury", "채팅 배심원 !번호"); ok(mfChatCommand(CODE, "c1", "시청자1", "!" + seat)?.dup, "같은 시청자 같은 표 = 중복");
  ok(mfChatCommand(CODE, "c2", "시청자2", "!예측 " + seat)?.kind === "predict", "채팅 !예측"); ok(mfChatCommand(CODE, "c3", "시청자3", "!승리 시민")?.kind === "team", "채팅 !승리");
  ok(mfChatCommand(CODE, "c4", "시청자4", "그냥 채팅") === null, "일반 채팅 무시");
  const votesBefore = room.votes.size; ok(room.view.jury.size === 1 && room.view.predict.size === 1 && room.view.team.size === 1 && room.votes.size === votesBefore && ![...room.votes.keys()].some((k) => k.startsWith("c")), "시청자 집계는 참가자 투표와 따로");
}
ok(await until(() => H.pub.status === "ended", 60000), "게임이 승리 조건으로 끝남");
ok(["town", "mafia", "none"].includes(H.pub.winner?.team) && H.pub.players.every((p) => p.role), "승리팀 판정(또는 시간 초과 무승부)·전체 직업 공개 " + H.pub.winner?.team);
ok(H.pub.winner.mvp && Array.isArray(H.pub.log), "MVP·주요 사건 정리");
ok(obsStates.some((o) => o.status === "ended" && o.winner), "OBS 최종 결과");
const q1 = await conn("guest_q1"); await emit(q1, "mf:join", { code: CODE, nick: "대기", spectate: true });
ok((await emit(q1, "mf:queue", { code: CODE, nick: "대기" })).ok, "대기열 등록");
ok((await emit(H, "mf:start", { fillQueue: true, force: true })).ok, "다시 하기 (대기열 채움)");
ok(await until(() => q1.me?.role, 4000), "대기열 시청자가 참가자로");

const M = await conn("guest_mc"); await wait(850); const mc = await emit(M, "mf:create", { nick: "진행자", hostMode: "mc", max: 6 }); ok(mc.ok, "사회자 모드");
const mp = []; for (let i = 0; i < 5; i++) { const s = await conn("guest_mp" + i); await emit(s, "mf:join", { code: mc.code, nick: "m" + i }); await emit(s, "mf:ready", { ready: true }); mp.push(s); }
ok((await emit(M, "mf:start", {})).ok, "사회자가 시작"); ok(await until(() => M.pub.status === "playing"), "시작됨");
await wait(60); ok(!M.me.role && M.me.mc && !ROLE_RE.test(JSON.stringify(M.me)), "사회자는 직업·비밀 없음");
ok((await emit(M, "mf:host", { cmd: "pause" })).ok && M.pub.phase.paused, "일시정지"); ok((await emit(M, "mf:host", { cmd: "resume" })).ok, "재개");
M.disconnect(); await wait(80); ok(mp[0].pub.status === "playing", "스트리머 연결이 끊겨도 게임 계속");

const B = await conn("guest_big"); await wait(850); await emit(B, "mf:create", { nick: "큰방", max: 30 }); await emit(B, "mf:bots", { n: 29 });
const t0 = Date.now(); ok((await emit(B, "mf:start", {})).ok, "30명 시작");
ok(await until(() => B.pub.status === "ended", 120000), "30명 게임 끝까지");
console.log(`  30명: ${B.pub.winner?.days}일, 계획 시간 약 ${Math.round((B.pub.winner?.simSec || 0) / 60)}분, 승리 ${B.pub.winner?.team}`);
console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
