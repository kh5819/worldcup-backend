// 플듀 미스터리 멀티 서버 검증 (DB 없이 메모리만) — MYS_VOTE_MS=800 node scripts/test-mystery-multi.mjs
import http from "http";
import { Server } from "socket.io";
import ioc from "socket.io-client";
import { registerMysteryMulti, _mysmRooms } from "../src/mystery-multi.js";
import { EP01 } from "../src/mystery-ep01.js";
import { createSession, act } from "../src/mystery-engine.js";

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error("  ✗", m); } else console.log("  ✓", m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const srv = http.createServer();
const io = new Server(srv, { allowEIO3: true });
io.use((s, next) => { const id = s.handshake.query.uid; s.user = { id, isGuest: id.startsWith("guest_") }; next(); });
registerMysteryMulti(io, null);
await new Promise((r) => srv.listen(0, r));
const URL = `http://localhost:${srv.address().port}`;

function client(uid) {
  const s = ioc(URL, { query: { uid }, transports: ["websocket"], forceNew: true, reconnection: false });
  const inbox = { room: null, snap: null, team: [], final: null, ending: null, started: null, pings: [], proposals: [], revote: null };
  s.on("mysm:ping", (x) => inbox.pings.push(x));
  s.on("mysm:proposal", (x) => inbox.proposals.push(x));
  s.on("mysm:revote", (x) => (inbox.revote = x));
  s.on("mysm:room", (r) => (inbox.room = r));
  s.on("mysm:snap", (x) => (inbox.snap = x));
  s.on("mysm:team", (x) => inbox.team.push(...x));
  s.on("mysm:final", (x) => (inbox.final = x));
  s.on("mysm:ending", (x) => (inbox.ending = x));
  s.on("mysm:started", (x) => { inbox.started = x; inbox.snap = x.snapshot; });
  const emit = (ev, p) => new Promise((r) => s.emit(ev, p, r));
  const A = (action) => emit("mysm:act", { action });
  return { s, inbox, emit, A, ready: new Promise((r) => s.on("connect", r)) };
}

// ===== 협동 =====
console.log("\n■ 협동 3인");
const host = client("user_host"), b = client("guest_b"), c = client("guest_c");
await Promise.all([host.ready, b.ready, c.ready]);
const g = await b.emit("mysm:create", { mode: "coop" });
ok(g.error === "GUEST_CANNOT_CREATE", "게스트는 방을 만들 수 없다");
const cr = await host.emit("mysm:create", { mode: "coop", maxPlayers: 3, nickname: "방장" });
ok(cr.ok && /^\d{6}$/.test(cr.room.code), `방 생성 · 초대코드 ${cr.room.code}`);
const code = cr.room.code;
ok((await b.emit("mysm:join", { code, nickname: "비" })).ok, "B 입장");
ok((await c.emit("mysm:join", { code, nickname: "씨" })).ok, "C 입장");
const d = client("guest_d"); await d.ready;
ok((await d.emit("mysm:join", { code })).error === "ROOM_FULL", "정원 초과 입장 거부");
d.s.close();
ok((await b.emit("mysm:start")).error === "NOT_HOST", "방장 아닌 사람은 시작 불가");
ok((await host.emit("mysm:start")).error === "NOT_READY", "준비 안 한 사람이 있으면 시작 불가");
await b.emit("mysm:ready", { ready: true }); await c.emit("mysm:ready", { ready: true });
ok((await host.emit("mysm:start")).ok, "전원 준비 후 시작");
await sleep(150);
ok(host.inbox.started && b.inbox.started && c.inbox.started, "세 명 모두 시작 신호 받음");
ok(b.inbox.started.events.some((e) => e.type === "dialogue"), "인트로 대사 전달");

// B가 증거 → A·C 화면 갱신 + 팀 알림
await b.A({ type: "inspect", hotspot: "sq_clocks" });
await sleep(120);
ok(host.inbox.team.some((t) => t.type === "evidence" && t.by === "비"), "B의 증거 발견이 방장에게 알림");
ok(c.inbox.snap.evidence.some((e) => e.id === "E01"), "C의 수첩에도 공용 증거 반영");
await c.A({ type: "inspect", hotspot: "sq_isabel" });

// 각자 이동: B는 작업실 앞, A는 광장 그대로
await b.A({ type: "move", to: "workshop_out" });
await sleep(100);
ok(host.inbox.snap.scene.id === "square", "방장은 여전히 광장 (이동은 각자)");
const bp = host.inbox.room.players.find((p) => p.name === "비");
ok(bp.scene === "작업실 앞", "방장 화면에 B의 위치 표시");

// 동시 정답: A와 C가 같은 순간 P01 정답 제출 → 한 번만 처리
const need = { "2,1": 14, "2,2": 11, "1,2": 5, "2,3": 10, "2,4": 13, "1,4": 5, "3,4": 5, "3,1": 5 };
const rotMask = (m, k) => { let r = m; for (let i = 0; i < k; i++) r = ((r << 1) | (r >> 3)) & 15; return r; };
const rot = EP01.puzzles.P01.public.tiles.map((row, r) => row.map((t, cc) => { const n = need[`${r},${cc}`]; return n === undefined ? t.r : [0, 1, 2, 3].find((q) => rotMask(t.m, q) === n); }));
await host.A({ type: "inspect", hotspot: "sq_box" }); await c.A({ type: "inspect", hotspot: "sq_box" });
const [ra, rc] = await Promise.all([host.A({ type: "solve", puzzle: "P01", answer: { rot } }), c.A({ type: "solve", puzzle: "P01", answer: { rot } })]);
const solvedCount = [ra, rc].filter((r) => r.correct === true).length;
const already = [ra, rc].filter((r) => r.already).length;
ok(solvedCount === 1 && already === 1, `동시 정답 → 해결 1번 + 이미 해결 1번 (실제 ${solvedCount}/${already})`);
await sleep(100);
const evCount = host.inbox.snap ? null : null; void evCount;
const st = _mysmRooms.values().next().value.session;
ok(st.evidence.filter((e) => e === "E02").length === 1, "보상 증거가 중복 지급되지 않음");

// 재접속: B 끊김 → 자리 유지 → 다시 붙으면 상태 복원
b.s.close();
await sleep(150);
ok(host.inbox.room.players.find((p) => p.name === "비").connected === false, "B 끊김 표시 (자리 유지)");
const b2 = client("guest_b"); await b2.ready;
const rj = await b2.emit("mysm:rejoin");
ok(rj.ok && rj.snapshot.scene.id === "workshop_out" && rj.snapshot.evidence.length >= 2, "B 재접속 → 위치·공용 증거 복원");

// 최종 추리 투표까지 빠르게 진행 (공용 세션 플래그를 직접 맞춰 투표만 검증)
st.flags.add("rescued"); st.flags.add("c3");
const room = _mysmRooms.values().next().value;
room.players.get("user_host").scene = "underground";
ok((await host.A({ type: "final", answers: {} })).error === "USE_VOTE", "협동은 혼자 최종 추리 불가 (투표만)");
await host.A({ type: "inspect", hotspot: "ug_final" });
await sleep(100);
ok(b2.inbox.final && c.inbox.final, "최종 추리 투표가 모두에게 열림");
await host.emit("mysm:vote", { answers: { when: { option: "a", evidence: "E01" }, stop: { option: "a", evidence: "E02" }, lock: { option: "c" }, where: { option: "b" }, culprit: { option: "lucien", evidence: "E01" }, motive: { option: "vault" } } });
await b2.emit("mysm:vote", { answers: { when: { option: "a" }, stop: { option: "a" }, lock: { option: "c" }, where: { option: "b" }, culprit: { option: "lucien" }, motive: { option: "masterpiece" } } });
ok(!c.inbox.ending, "한 명이 아직 투표 안 함 → 엔딩 대기");
await c.emit("mysm:vote", { answers: { when: { option: "a" }, stop: { option: "a" }, lock: { option: "c" }, where: { option: "b" }, culprit: { option: "mayor" }, motive: { option: "vault" } } });
await sleep(150);
ok(["true", "normal"].includes(c.inbox.ending?.ending) && c.inbox.ending.answers.culprit.option === "lucien" && c.inbox.ending.answers.motive.option === "vault", `질문별 다수결 → 범인·목적 정답 (엔딩 ${c.inbox.ending?.ending}, 근거 부족 시 보통)`);
ok(host.inbox.room.status === "ended" && host.inbox.room.teamResult, "방 종료 + 팀 결과");
const contrib = host.inbox.room.players.map((p) => `${p.name}:${JSON.stringify(p.contrib)}`).join(" ");
console.log("   기여도", contrib);

// 방장 이전
host.s.close(); await sleep(50);
console.log("   (방장 이전은 15초 대기 → 타이머를 직접 검증)");
const hp = room.players.get("user_host");
ok(hp.hostTimer, "방장이 끊기면 이전 타이머 시작");
clearTimeout(hp.hostTimer);
b2.s.close(); c.s.close();

// ===== 경쟁 =====
console.log("\n■ 경쟁 2인");
const h2 = client("user_h2"), e2 = client("guest_e2");
await Promise.all([h2.ready, e2.ready]);
const cr2 = await h2.emit("mysm:create", { mode: "race", maxPlayers: 2 });
await e2.emit("mysm:join", { code: cr2.room.code }); await e2.emit("mysm:ready", { ready: true });
await h2.emit("mysm:start"); await sleep(100);
await h2.A({ type: "inspect", hotspot: "sq_clocks" });
await sleep(80);
ok(!e2.inbox.snap.evidence.length, "경쟁은 세션이 따로 (상대 증거가 내게 안 옴)");
const room2 = [..._mysmRooms.values()].find((r) => r.mode === "race");
for (const [uid, ans] of [["user_h2", { when: { option: "a", evidence: "E01" }, stop: { option: "a", evidence: "E02" }, lock: { option: "c" }, where: { option: "b" }, culprit: { option: "lucien", evidence: "E01" }, motive: { option: "vault" } }], ["guest_e2", { when: { option: "a" }, stop: { option: "a" }, lock: { option: "c" }, where: { option: "b" }, culprit: { option: "mayor" }, motive: { option: "vault" } }]]) {
  const p = room2.players.get(uid); p.session.flags.add("rescued"); p.session.flags.add("c3"); p.scene = "underground";
}
await e2.A({ type: "final", answers: { when: { option: "a" }, stop: { option: "a" }, lock: { option: "c" }, where: { option: "b" }, culprit: { option: "mayor" }, motive: { option: "vault" } } });
await sleep(80);
ok(h2.inbox.team.some((t) => t.type === "race_done"), "상대가 끝내면 알림");
ok(h2.inbox.room.status === "playing", "아직 한 명 남음 → 진행 중");
await h2.A({ type: "final", answers: { when: { option: "a", evidence: "E01" }, stop: { option: "a", evidence: "E02" }, lock: { option: "c" }, where: { option: "b" }, culprit: { option: "lucien", evidence: "E01" }, motive: { option: "vault" } } });
await sleep(100);
const rk = h2.inbox.room.ranking;
ok(h2.inbox.room.status === "ended" && rk?.[0]?.id === "user_h2", `순위: 1위 ${rk?.[0]?.name}(${rk?.[0]?.ending}) · 2위 ${rk?.[1]?.name}(${rk?.[1]?.ending})`);
h2.s.close(); e2.s.close();

// ===== 8인 협동 =====
console.log("\n■ 협동 8인 (동시 접속)");
{
  const P = [client("user_h8"), ...Array.from({ length: 7 }, (_, i) => client(`guest_p${i}`))];
  await Promise.all(P.map((p) => p.ready));
  const cr8 = await P[0].emit("mysm:create", { mode: "coop", maxPlayers: 8 });
  const joins = await Promise.all(P.slice(1).map((p, i) => p.emit("mysm:join", { code: cr8.room.code, nickname: `탐정${i + 2}` })));
  ok(joins.every((j) => j.ok), "7명 동시 입장");
  const p9 = client("guest_p9"); await p9.ready;
  ok((await p9.emit("mysm:join", { code: cr8.room.code })).error === "ROOM_FULL", "9번째 입장 거부");
  p9.s.close();
  await Promise.all(P.slice(1).map((p) => p.emit("mysm:ready", { ready: true })));
  const starts = await Promise.all([P[0].emit("mysm:start"), P[0].emit("mysm:start")]);
  ok(starts.filter((x) => x.ok).length === 1, "방장이 시작을 연속 클릭해도 한 번만 시작");
  await sleep(200);
  ok(P.every((p) => p.inbox.started), "8명 모두 시작");
  // 8명이 동시에 같은 시계를 조사 → 증거는 1번만
  await Promise.all(P.map((p) => p.A({ type: "inspect", hotspot: "sq_clocks" })));
  const room8 = [..._mysmRooms.values()].find((r) => r.players.size === 8);
  ok(room8.session.evidence.filter((e) => e === "E01").length === 1, "8명 동시 발견 → 증거 1개");
  // 각자 다른 장소로
  await P[1].A({ type: "inspect", hotspot: "sq_isabel" });
  await Promise.all(P.slice(2, 5).map((p) => p.A({ type: "move", to: "workshop_out" })));
  await sleep(150);
  const where = P[0].inbox.room.players.map((p) => p.scene);
  ok(where.filter((w) => w === "작업실 앞").length === 3 && where.filter((w) => w === "에셀 마을 광장").length === 5, "각자 위치가 따로 관리됨 (광장 5 · 작업실 앞 3)");
  // 2명 이탈 → 투표 인원 재계산
  P[6].s.close(); P[7].s.close(); await sleep(200);
  room8.session.flags.add("rescued"); room8.session.flags.add("c3");
  for (const p of room8.players.values()) p.scene = "underground";
  await P[0].A({ type: "inspect", hotspot: "ug_final" });
  await sleep(100);
  const ans = { when: { option: "a", evidence: "E01" }, stop: { option: "a", evidence: "E02" }, lock: { option: "c" }, where: { option: "b" }, culprit: { option: "lucien", evidence: "E01" }, motive: { option: "vault" } };
  await Promise.all(P.slice(0, 5).map((p) => p.emit("mysm:vote", { answers: ans })));
  await sleep(100);
  ok(!P[0].inbox.ending, "6명 중 5명 투표 → 아직 대기");
  await P[5].emit("mysm:vote", { answers: { when: { option: "a" }, stop: { option: "a" }, lock: { option: "c" }, where: { option: "b" }, culprit: { option: "mayor" }, motive: { option: "vault" } } });
  await sleep(200);
  ok(P[0].inbox.ending?.answers?.culprit?.option === "lucien" && P[3].inbox.ending, "접속 중인 6명 투표 완료 → 엔딩 동기화 (이탈 2명은 제외)");
  P.slice(0, 6).forEach((p) => p.s.close());
}

// ===== 역할 · 정보 분산 · 핑 · 제안 · 투표 규칙 =====
console.log("\n■ 역할 · 협동 퍼즐 · 핑 · 투표 규칙");
{
  const T = [client("user_r0"), client("guest_r1"), client("guest_r2")];
  await Promise.all(T.map((p) => p.ready));
  const cr = await T[0].emit("mysm:create", { mode: "coop", maxPlayers: 8 });
  await T[1].emit("mysm:join", { code: cr.room.code }); await T[2].emit("mysm:join", { code: cr.room.code });
  await T[1].emit("mysm:ready", { ready: true }); await T[2].emit("mysm:ready", { ready: true });
  await T[0].emit("mysm:start"); await sleep(150);
  const roomR = [..._mysmRooms.values()].find((r) => r.players.has("user_r0"));
  const roleCounts = Object.values(roomR.roles).map((x) => x.length).sort();
  ok(JSON.stringify(roleCounts) === "[2,3,3]" && new Set(Object.values(roomR.roles).flat()).size === 8, `3명이면 역할 8개를 3·3·2로 나눔 (${roleCounts})`);
  // 협동 암호: 각자 일부 숫자만, 합치면 전부
  roomR.session.flags.add("p02"); roomR.session.flags.add("met_isabel");
  for (const p of roomR.players.values()) p.scene = "workshop";
  const views = [];
  for (const t of T) { const r = await t.A({ type: "inspect", hotspot: "ws_letter" }); views.push(r.events.find((e) => e.type === "puzzle")?.puzzle); }
  const full = EP01.puzzles.P04.public.cipher;
  const merged = full.map((_, i) => views.map((v) => v.public.cipher[i]).find((x) => x !== null));
  ok(views.every((v) => v.public.cipher.some((x) => x === null)) && JSON.stringify(merged) === JSON.stringify(full), "협동 암호: 각자 일부만 보이고 셋을 합치면 전체");
  ok(views.every((v) => v.splitNote), "나눠 받았다는 안내가 뜸");
  const solo1 = createSession(EP01); solo1.flags.add("p02"); solo1.scene = "workshop";
  const sv = act(EP01, solo1, { type: "inspect", hotspot: "ws_letter" }).events.find((e) => e.type === "puzzle").puzzle;
  ok(!sv.public.cipher.includes(null) && !sv.splitNote, "혼자면 숫자 전부 보임");
  ok(sv.roleHint, "혼자면 모든 역할 능력 (암호 전문가 무료 힌트)");
  // 정답은 누가 내도 전체 기준으로 판정
  const sol = await T[2].A({ type: "solve", puzzle: "P04", answer: { text: "탑 아래에서 기다린다" } });
  ok(sol.correct, "일부만 본 사람도 팀이 모은 답을 내면 정답");
  // 지도: 조사관만 빵집·시청 표시를 본다
  roomR.session.flags.add("got_E12");
  for (const p of roomR.players.values()) p.scene = "inn";
  const mapViews = [];
  for (const t of T) { const r = await t.A({ type: "inspect", hotspot: "in_map" }); mapViews.push({ id: t.s.io?.opts?.query?.uid, g: r.events.find((e) => e.type === "puzzle")?.puzzle.public.grid.join("") }); }
  const withMarks = mapViews.filter((m) => /[BH]/.test(m.g)).length;
  ok(withMarks === 1, `지도 표시는 한 명만 봄 (${withMarks}명)`);
  // 핑 · 속도 제한 · 제안
  const p1 = await T[1].emit("mysm:ping", { kind: "help" });
  const p2 = await T[1].emit("mysm:ping", { kind: "help" });
  await sleep(100);
  ok(p1.ok && p2.error === "RATE_LIMITED" && T[0].inbox.pings?.length, "핑 전달 + 1.5초 안 연속 핑은 막힘");
  ok((await T[1].emit("mysm:ping", { kind: "<script>" })).error === "BAD_PING", "정해진 핑 종류만 허용");
  roomR.session.evidence.push("E01", "E02", "E09", "E10");
  await sleep(1600);
  const pr = await T[1].emit("mysm:propose", { cards: ["E02", "E09", "E10"] });
  await sleep(100);
  ok(pr.ok && T[0].inbox.proposals?.[0]?.names?.length === 3, "추리 제안이 팀에 전달됨");
  ok((await T[2].emit("mysm:propose", { cards: ["E02", "E99", "E10"] })).error === "BAD_CARDS", "없는 증거로는 제안 불가");
  // 이탈 → 역할 재배정
  T[2].s.close(); await sleep(200);
  const rc2 = Object.values(roomR.roles).map((x) => x.length).sort();
  ok(JSON.stringify(rc2) === "[4,4]", `한 명이 나가면 남은 둘이 4·4로 나눠 맡음 (${rc2})`);
  // 동률 → 재투표 → 그래도 동률이면 탐정 역할이 결정
  roomR.session.flags.add("rescued"); roomR.session.flags.add("c3");
  for (const p of roomR.players.values()) p.scene = "underground";
  await T[0].A({ type: "inspect", hotspot: "ug_final" }); await sleep(100);
  const base = { when: { option: "a" }, stop: { option: "a" }, lock: { option: "c" }, where: { option: "b" }, motive: { option: "vault" } };
  await T[0].emit("mysm:vote", { answers: { ...base, culprit: { option: "lucien" } } });
  await T[1].emit("mysm:vote", { answers: { ...base, culprit: { option: "mayor" } } });
  await sleep(150);
  ok(T[0].inbox.revote?.tied?.includes("culprit") && !T[0].inbox.ending, "1차 동률 → 재투표");
  const detId = Object.keys(roomR.roles).find((id) => roomR.roles[id].includes("detective"));
  const detPick = detId === "user_r0" ? "lucien" : "mayor";
  await T[0].emit("mysm:vote", { answers: { ...base, culprit: { option: "lucien" } } });
  await T[1].emit("mysm:vote", { answers: { ...base, culprit: { option: "mayor" } } });
  await sleep(200);
  ok(T[0].inbox.ending?.answers?.culprit?.option === detPick, `재투표도 동률 → 탐정 역할(${detId})의 선택으로 결정`);
  T.slice(0, 2).forEach((t) => t.s.close());
}
{
  // 방장 단독 결정 + 제한 시간 자동 마감
  const H = client("user_hd"), G = client("guest_g1");
  await Promise.all([H.ready, G.ready]);
  const cr = await H.emit("mysm:create", { mode: "coop", decide: "host" });
  await G.emit("mysm:join", { code: cr.room.code }); await G.emit("mysm:ready", { ready: true });
  await H.emit("mysm:start"); await sleep(120);
  const rm = [..._mysmRooms.values()].find((r) => r.players.has("user_hd"));
  rm.session.flags.add("rescued"); rm.session.flags.add("c3"); for (const p of rm.players.values()) p.scene = "underground";
  await H.A({ type: "inspect", hotspot: "ug_final" }); await sleep(80);
  const base = { when: { option: "a" }, stop: { option: "a" }, lock: { option: "c" }, where: { option: "b" }, motive: { option: "vault" } };
  await G.emit("mysm:vote", { answers: { ...base, culprit: { option: "mayor" } } }); await sleep(80);
  ok(!H.inbox.ending, "방장 단독 결정: 다른 사람 표로는 마감 안 됨");
  await H.emit("mysm:vote", { answers: { ...base, culprit: { option: "lucien" } } }); await sleep(150);
  ok(H.inbox.ending?.answers?.culprit?.option === "lucien", "방장 단독 결정: 방장 표로 결론");
  H.s.close(); G.s.close();
}
if (!process.env.MYS_VOTE_MS) console.log("  (투표 제한 시간 테스트는 MYS_VOTE_MS=800 node scripts/test-mystery-multi.mjs 로 실행)");
else {
  const V = client("user_vt"), W = client("guest_w1");
  await Promise.all([V.ready, W.ready]);
  const cr = await V.emit("mysm:create", { mode: "coop" });
  await W.emit("mysm:join", { code: cr.room.code }); await W.emit("mysm:ready", { ready: true });
  await V.emit("mysm:start"); await sleep(120);
  const rm = [..._mysmRooms.values()].find((r) => r.players.has("user_vt"));
  rm.session.flags.add("rescued"); rm.session.flags.add("c3"); for (const p of rm.players.values()) p.scene = "underground";
  await V.A({ type: "inspect", hotspot: "ug_final" }); await sleep(80);
  await V.emit("mysm:vote", { answers: { when: { option: "a" }, stop: { option: "a" }, lock: { option: "c" }, where: { option: "b" }, culprit: { option: "lucien" }, motive: { option: "vault" } } });
  await sleep(Number(process.env.MYS_VOTE_MS) + 300);
  ok(V.inbox.ending, `한 명이 투표하지 않아도 제한 시간(${process.env.MYS_VOTE_MS}ms) 뒤 자동 마감`);
  V.s.close(); W.s.close();
}

console.log(fails ? `\n✗ 실패 ${fails}건` : "\n✓ 전부 통과");
io.close(); srv.close();
process.exit(fails ? 1 : 0);
