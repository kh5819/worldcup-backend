// 진단소 DB 경로 시험 (메모리 가짜 Supabase — 실제 DB 안 씀): node scripts/test-clinic-db.mjs
// 회원 프로필 연동 · 게스트 접수 저장 · 비공개 차단 · 성별/나이 숨김 · 랭킹(게스트 포함) · 게스트→회원 병합 · XSS/나이 검증
process.env.CLINIC_FAST = "1";
import http from "http";
import express from "express";
import { Server } from "socket.io";
import ioc from "socket.io-client";
import { registerClinic } from "../src/clinic.js";
import { registerClinicMulti } from "../src/clinic-multi.js";
import * as C from "../src/clinic-core.js";

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log("  ✗", msg); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 가짜 Supabase (쓰는 기능만) ----------
const DB = { profiles: [{ id: "u_marin", nickname: "마린", avatar_url: "https://example.com/m.png" }, { id: "u_lemur", nickname: "레무르", avatar_url: null }], clinic_results: [], clinic_best: [], clinic_profiles: [], clinic_groups: [] };
function project(row, cols) {
  if (!cols || cols.trim() === "*") return { ...row };
  const o = {};
  for (let c of cols.split(",")) {
    c = c.trim();
    let m, alias = null;
    if ((m = c.match(/^(\w+):(.+)$/))) { alias = m[1]; c = m[2]; }
    if (alias) { const [x, y] = c.split(/->>?/); o[alias] = y ? row[x]?.[y] ?? null : row[x]; continue; }
    if ((m = c.match(/^(\w+)->>(\w+)$/))) o[m[2]] = row[m[1]]?.[m[2]] == null ? null : String(row[m[1]][m[2]]);
    else if ((m = c.match(/^(\w+)->(\w+)$/))) o[m[2]] = row[m[1]]?.[m[2]] ?? null;
    else o[c] = row[c];
  }
  return o;
}
class Q {
  constructor(t) { this.t = t; this.f = []; this.op = "select"; this.cols = "*"; this.lim = null; this.ord = []; this.one = null; this.opts = {}; this.retSel = null; }
  select(cols = "*", opts = {}) { if (this.op === "select") { this.cols = cols; this.opts = opts; } else this.retSel = cols; return this; }
  insert(rows) { this.op = "insert"; this.rows = Array.isArray(rows) ? rows : [rows]; return this; }
  update(v) { this.op = "update"; this.val = v; return this; }
  upsert(row, o = {}) { this.op = "upsert"; this.rows = Array.isArray(row) ? row : [row]; this.conf = (o.onConflict || "id").split(","); return this; }
  delete() { this.op = "delete"; return this; }
  eq(c, v) { this.f.push((r) => r[c] === v); return this; }
  neq(c, v) { this.f.push((r) => r[c] !== v); return this; }
  gte(c, v) { this.f.push((r) => r[c] >= v); return this; }
  lt(c, v) { this.f.push((r) => r[c] < v); return this; }
  not(c, op, v) { if (op === "is" && v === null) this.f.push((r) => r[c] != null); return this; }
  order(c, o = {}) { this.ord.push([c, o.ascending !== false]); return this; }
  limit(n) { this.lim = n; return this; }
  maybeSingle() { this.one = "maybe"; return this; }
  single() { this.one = "single"; return this; }
  run() {
    const T = DB[this.t] || (DB[this.t] = []);
    const match = (r) => this.f.every((fn) => fn(r));
    if (this.op === "insert") { for (const r of this.rows) { if (T.some((x) => x.id && x.id === r.id)) return { error: { code: "23505" } }; T.push({ ...r }); } return { error: null }; }
    if (this.op === "upsert") { for (const r of this.rows) { const ex = T.find((x) => this.conf.every((k) => x[k] === r[k])); if (ex) Object.assign(ex, r); else T.push({ ...r }); } return { error: null }; }
    if (this.op === "update") { const hit = T.filter(match); hit.forEach((r) => Object.assign(r, this.val)); return { error: null, data: this.retSel ? hit.map((r) => project(r, this.retSel)) : null }; }
    if (this.op === "delete") { const keep = T.filter((r) => !match(r)); DB[this.t] = keep; return { error: null }; }
    let rows = T.filter(match);
    const val = (r, c) => { const [x, y] = c.split(/->>?/); return y ? r[x]?.[y] : r[c]; };
    for (const [c, asc] of [...this.ord].reverse()) rows.sort((a, b) => { const A = val(a, c), B = val(b, c); return (A < B ? -1 : A > B ? 1 : 0) * (asc ? 1 : -1); });
    if (this.opts.head) return { error: null, count: rows.length, data: null };
    if (this.lim != null) rows = rows.slice(0, this.lim);
    const data = rows.map((r) => project(r, this.cols));
    if (this.one) return { error: this.one === "single" && !data.length ? { code: "PGRST116" } : null, data: data[0] || null };
    return { error: null, data, count: this.opts.count ? rows.length : undefined };
  }
  then(res, rej) { try { res(this.run()); } catch (e) { rej(e); } }
}
const sb = { from: (t) => new Q(t) };

// ---------- 서버 ----------
const app = express();
const server = http.createServer(app);
const io = new Server(server, { allowEIO3: true });
io.use((s, next) => { const id = String(s.handshake.query.uid); s.user = { id, isGuest: id.startsWith("guest_") }; next(); });
const getOptionalUser = async (req) => { const a = req.headers.authorization || ""; return a.startsWith("Bearer u_") ? { id: a.slice(7) } : null; };
registerClinic(io, sb, app, { getOptionalUser });
registerClinicMulti(io, sb);
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const URL = `http://localhost:${port}`;
const conn = (id) => new Promise((res) => { const s = ioc(URL, { query: { uid: id }, transports: ["websocket"], forceNew: true, reconnection: false }); s.on("connect", () => res(s)); });
const emit = (s, ev, p) => new Promise((res) => s.emit(ev, p, res));
const get = async (path, headers = {}) => { const r = await fetch(URL + path, { headers }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };

// 검사 하나를 끝까지 (빠른검사 5종, 반응속도만 기록)
async function fullRun(s, profile, prefs, { isPublic = true, mode = "quick", rt = 230 } = {}) {
  const b = await emit(s, "clinic:begin", { mode, device: "pc" });
  for (let i = 0; i < b.plan.length; i++) {
    await emit(s, "clinic:testStart", { sid: b.sid, idx: i });
    await emit(s, "clinic:submit", { sid: b.sid, idx: i, log: b.plan[i].id === "reaction" ? { tr: [rt, rt + 12, rt + 25, rt + 7, rt + 18] } : {} });
  }
  return emit(s, "clinic:finish", { sid: b.sid, profile, prefs, isPublic });
}
const prof = (nick, g = "f", age = 30) => ({ nick, gender: g, age, avatar: { skin: 1, hc: 1, hs: 2, shirt: 3, pants: 1, hat: 0 } });

// 1) 회원: 프로필 닉네임 강제·사진 연동, 접수 정보 저장/재사용
{
  const m = await conn("u_marin");
  const me0 = await emit(m, "clinic:me", {});
  ok(me0.ok && me0.member?.nickname === "마린" && me0.member.avatar_url && !me0.saved, "회원 프로필 못 읽음");
  const sv = await emit(m, "clinic:profile:save", { profile: prof("사칭닉"), prefs: { showAge: false } });
  ok(sv.ok && sv.saved && sv.nick === "마린", "회원 닉네임이 프로필로 고정 안 됨");
  const me1 = await emit(m, "clinic:me", {});
  ok(me1.saved?.gender === "f" && me1.saved.age === 30 && me1.saved.nickname === "마린" && me1.saved.prefs.showAge === false, "회원 접수 정보 재사용 안 됨");
  ok(DB.profiles.find((p) => p.id === "u_marin").nickname === "마린" && Object.keys(DB.profiles[0]).length === 3, "회원 profiles 테이블이 바뀜");
  const f = await fullRun(m, prof("사칭닉"), { showGender: true, showAge: false });
  ok(f.ok && f.result.nick === "마린" && f.result.age === 30, "발급 닉네임이 프로필이 아님(또는 본인 보기에서 나이 숨김)");
  const row = DB.clinic_results.find((r) => r.id === f.id);
  ok(row && row.user_id === "u_marin" && row.avatar_url && row.show_age === false && row.diag.i18n?.ja?.title, "결과 저장값 이상");
  // 다른 사람이 보면 나이·나이 차이·나이 문장 숨김
  const other = await get(`/clinic/result/${f.id}`);
  ok(other.ok && other.result.age == null && other.result.diff == null && other.result.diag.diff == null && other.result.gender === "f", "나이 숨김이 공유 링크에서 안 지켜짐");
  ok(other.result.diag.opinion.length === row.diag.opinion.length - 1, "나이 문장이 공유 링크에 남음");
  const owner = await get(`/clinic/result/${f.id}`, { authorization: "Bearer u_marin" });
  ok(owner.result.age === 30 && owner.result.mine, "본인 보기에서 정보가 숨겨짐");
  // 비공개 → 다른 사람 403, 본인 200
  ok((await emit(m, "clinic:setPublic", { id: f.id, isPublic: false })).ok, "비공개 전환 실패");
  ok((await get(`/clinic/result/${f.id}`)).status === 403, "비공개 결과가 남에게 보임");
  ok((await get(`/clinic/result/${f.id}`, { authorization: "Bearer u_lemur" })).status === 403, "비공개 결과가 다른 회원에게 보임");
  ok((await get(`/clinic/result/${f.id}`, { authorization: "Bearer u_marin" })).status === 200, "본인이 비공개 결과를 못 봄");
  // 남의 결과 설정 바꾸기 차단
  const l = await conn("u_lemur");
  await emit(l, "clinic:setPublic", { id: f.id, isPublic: true });
  ok(DB.clinic_results.find((r) => r.id === f.id).is_public === false, "남의 결과 공개 설정 변경 가능");
  await emit(l, "clinic:setPrivacy", { id: f.id, showAge: true, showGender: true });
  ok(DB.clinic_results.find((r) => r.id === f.id).show_age === false, "남의 결과 개인정보 설정 변경 가능");
  await emit(m, "clinic:setPublic", { id: f.id, isPublic: true });
  m.close(); l.close();
}

// 2) 게스트: 접수 저장 → 결과 → 랭킹(게스트 표시) → 회원 전환 병합
{
  const G = "guest_abc12345xyz";
  const g = await conn(G);
  const me = await emit(g, "clinic:me", {});
  ok(me.ok && me.isGuest && !me.member, "게스트 판별 이상");
  ok((await emit(g, "clinic:profile:save", { profile: prof("게스트짱", "m", 22) })).saved, "게스트 접수 저장 실패");
  ok(DB.clinic_profiles.some((p) => p.owner_key === `g:${G}` && p.user_id === null), "게스트 접수가 식별자에 연결 안 됨");
  const f1 = await fullRun(g, prof("게스트짱", "m", 22), {}, { rt: 200 });
  const f2 = await fullRun(g, prof("게스트짱", "m", 22), {}, { rt: 330 });
  ok(f1.ok && f2.ok && f2.prev && f2.prev.total === f1.result.total, "이전 검사 대비 정보 없음");
  // 연습 최고 기록
  const pb = await emit(g, "clinic:begin", { mode: "practice", test: "reaction", device: "pc" });
  await emit(g, "clinic:testStart", { sid: pb.sid, idx: 0 });
  const ps = await emit(g, "clinic:submit", { sid: pb.sid, idx: 0, log: { tr: [210, 220, 230, 215, 225] }, nick: "게스트짱" });
  ok(ps.best?.isNewBest, "게스트 최고 기록 저장 안 됨");
  // 랭킹 (빠른검사는 종합 랭킹 대상 아님 → 검사별 랭킹으로 확인)
  const rk = await get(`/clinic/ranking?board=test&test=reaction&device=pc&period=all`);
  ok(rk.ok && !rk.rows.some((r) => r.nick === "게스트짱"), "연습·빠른검사가 검사별 랭킹에 뜸");
  // 회원 전환: 레무르로 로그인한 같은 브라우저
  const L = await conn("u_lemur");
  const meL = await emit(L, "clinic:me", { guestId: G });
  ok(meL.guestRecords === 2, "가져올 게스트 기록 수 이상: " + meL.guestRecords);
  ok(!(await emit(g, "clinic:mergeGuest", { guestId: G })).ok, "게스트가 병합 실행 가능");
  ok(!(await emit(L, "clinic:mergeGuest", { guestId: "guest_<script>" })).ok, "잘못된 게스트 ID 통과");
  const mg = await emit(L, "clinic:mergeGuest", { guestId: G });
  ok(mg.ok && mg.moved === 2, "병합 실패");
  ok(DB.clinic_results.filter((r) => r.owner_key === "u:u_lemur").length === 2 && !DB.clinic_results.some((r) => r.owner_key === `g:${G}`), "병합 후 소유자 이상");
  ok(DB.clinic_results.filter((r) => r.owner_key === "u:u_lemur").every((r) => r.nickname === "레무르" && r.user_id === "u_lemur"), "병합 기록 닉네임/계정 연결 이상");
  ok(DB.clinic_best.some((b) => b.owner_key === "u:u_lemur" && b.test_id === "reaction") && !DB.clinic_best.some((b) => b.owner_key === `g:${G}`), "최고 기록 병합 이상");
  ok(DB.clinic_profiles.some((p) => p.owner_key === "u:u_lemur" && p.age === 22) && !DB.clinic_profiles.some((p) => p.owner_key === `g:${G}`), "접수 정보 병합 이상");
  const mg2 = await emit(L, "clinic:mergeGuest", { guestId: G });
  ok(mg2.ok && mg2.moved === 0 && DB.clinic_results.filter((r) => r.owner_key === "u:u_lemur").length === 2, "두 번 병합 시 중복");
  // 기록 조회
  const h = await emit(L, "clinic:history", {});
  ok(h.ok && h.rows.length === 2 && h.best.length >= 1, "회원 기록 조회 이상");
  g.close(); L.close();
}

// 3) 종합 랭킹: 정밀검사 결과로 — 사람당 1개, 의심 기록 제외, 나이 비공개는 회춘·연령대 랭킹 제외
{
  const a = await conn("guest_rankaaaaaa"), b = await conn("u_marin"), c = await conn("guest_rankccccccc");
  const fa = await fullRun(a, prof("에이", "m", 25), {}, { mode: "full", rt: 200 });
  await fullRun(a, prof("에이", "m", 25), {}, { mode: "full", rt: 400 });
  const fb = await fullRun(b, prof("x"), { showAge: false }, { mode: "full", rt: 210 });
  const fc = await fullRun(c, prof("씨", "f", 41), {}, { mode: "full", rt: 260 });
  ok(fa.ok && fb.ok && fc.ok, "정밀검사 발급 실패");
  const all = await get(`/clinic/ranking?board=total&device=pc&period=all`);
  const nicks = all.rows.map((r) => r.nick);
  ok(all.ok && nicks.filter((n) => n === "에이").length === 1, "같은 사람이 종합 랭킹에 여러 번");
  ok(nicks.includes("마린") && all.rows.find((r) => r.nick === "마린").avatarUrl && all.rows.find((r) => r.nick === "마린").ageGroup == null, "회원 사진/나이 비공개 처리 이상");
  ok(all.rows.find((r) => r.nick === "에이").isGuest && all.rows.find((r) => r.nick === "에이").ageGroup === "20대", "게스트 표시/연령대 이상");
  ok(all.rows.every((r, i, A) => i === 0 || A[i - 1].total >= r.total), "종합 랭킹 정렬 이상");
  ok(all.rows.every((r) => r.i18n?.en?.title), "랭킹 진단명 다국어 없음");
  const young = await get(`/clinic/ranking?board=young&device=pc&period=all`);
  ok(!young.rows.some((r) => r.nick === "마린"), "나이 비공개인데 회춘 랭킹에 나옴");
  const age40 = await get(`/clinic/ranking?board=total&device=pc&period=all&age=40`);
  ok(age40.rows.length === 1 && age40.rows[0].nick === "씨", "연령대 랭킹 이상");
  // 의심 기록(시간 조작)은 랭킹 제외
  const d = await conn("guest_cheaterzzz");
  const bb = await emit(d, "clinic:begin", { mode: "full", device: "pc" });
  for (let i = 0; i < bb.plan.length; i++) { await emit(d, "clinic:testStart", { sid: bb.sid, idx: i }); await emit(d, "clinic:submit", { sid: bb.sid, idx: i, log: bb.plan[i].id === "tap" ? { t: Array.from({ length: 140 }, (_, k) => k * 70) } : {} }); }
  const fd = await emit(d, "clinic:finish", { sid: bb.sid, profile: prof("치터"), isPublic: true });
  ok(fd.ok && fd.result.flagged, "조작 기록이 의심 표시 안 됨");
  const withCheat = await get(`/clinic/ranking?board=total&device=mobile&period=all`);   // 다른 조건(캐시 피함)
  const cheatTap = DB.clinic_results.find((r) => r.id === fd.id).scores.tap;
  ok(cheatTap <= 40, "의심 검사가 40점으로 처리 안 됨");
  ok((await get(`/clinic/ranking?board=total&device=pc&period=week`)).rows.filter((r) => r.nick === "치터").length === 1, "의심 기록이 랭킹에 안 나옴(또는 중복)");
  [a, b, c, d].forEach((x) => x.close());
}

// 3-2) 랭킹 = 정밀검사만 (하면 자동 등록), 빠른검사·연습은 제외, 비공개 제외
{
  const q = await conn("guest_quickonly1"), hid = await conn("guest_hiddenone1");
  const fq = await fullRun(q, prof("빠른이", "f", 28), {}, { rt: 190 });
  const ff = await fullRun(q, prof("빠른이", "f", 28), {}, { rt: 190, mode: "full" });
  const fh = await fullRun(hid, prof("숨김이", "m", 28), {}, { rt: 185, isPublic: false, mode: "full" });
  await sleep(100);
  const fb = await get(`/clinic/ranking?board=total&device=pc&period=week&mode=quick`);   // 30초 캐시 피하려고 다른 조건
  ok(fq.ok && ff.ok && fb.rows.filter((r) => r.nick === "빠른이").length === 1, "정밀검사 결과가 종합 랭킹에 1번 안 뜸(또는 빠른검사가 섞임)");
  ok(!fb.rows.some((r) => r.nick === "숨김이"), "비공개 결과가 랭킹에 뜸");
  const tb = await get(`/clinic/ranking?board=test&test=reaction&device=pc&period=week`);
  ok(tb.rows.some((r) => r.nick === "빠른이") && tb.rows.find((r) => r.nick === "빠른이").score === ff.result.scores.reaction, "정밀검사 기록이 검사별 랭킹에 안 뜸");
  ok(!tb.rows.some((r) => r.nick === "숨김이"), "비공개 검사 기록이 검사별 랭킹에 뜸");
  ok(!tb.rows.some((r) => r.nick === "게스트짱"), "연습·빠른검사 기록이 검사별 랭킹에 뜸");
  ok(tb.rows.every((r, i, A) => i === 0 || A[i - 1].score >= r.score) && new Set(tb.rows.map((r) => r.nick)).size === tb.rows.length, "검사별 랭킹 정렬/중복 이상");
  q.close(); hid.close();
}

// 4) 입력 검증: XSS 닉네임·나이 경계
{
  const s = await conn("guest_validate01");
  for (const [age, want] of [[6, false], [7, true], [99, true], [100, false], ["abc", false], [25.4, true], [-1, false], [null, false]]) {
    const r = await emit(s, "clinic:profile:save", { profile: { nick: "a", gender: "m", age, avatar: {} } });
    ok(!!r.ok === want, `나이 ${age} 검증 이상`);
  }
  const x = await emit(s, "clinic:profile:save", { profile: { nick: "<img src=x onerror=alert(1)>", gender: "f", age: 20, avatar: { skin: 99, hat: -5 } } });
  const saved = DB.clinic_profiles.find((p) => p.owner_key === "g:guest_validate01");
  ok(x.ok && !/[<>]/.test(saved.nickname) && saved.avatar.skin === 0 && saved.avatar.hat === 0, "닉네임 태그/캐릭터 범위 검증 이상");
  ok(!(await emit(s, "clinic:profile:save", { profile: { nick: "a", gender: "x", age: 20 } })).ok, "잘못된 성별 통과");
  s.close();
}

// 5) 멀티 + 회원/게스트 혼합: 회원 닉네임·사진, 성별·나이 비공개 기본, 공개 선택, 단체 결과 저장
{
  const host = await conn("u_marin"), g1 = await conn("guest_mixaaaaaa"), m2 = await conn("u_lemur");
  const c = await emit(host, "clm:create", { mode: "quick", profile: prof("가짜", "f", 30), prefs: {} });
  ok(c.ok && c.room.players[0].nick === "마린" && c.room.players[0].avatarUrl, "멀티 회원 닉네임/사진 연동 안 됨");
  await emit(g1, "clm:join", { code: c.room.code, profile: prof("손님", "m", 19), prefs: { shareMulti: true } });
  const j = await emit(m2, "clm:join", { code: c.room.code, profile: prof("가짜2", "m", 50), prefs: {} });
  const pl = (id) => j.room.players.find((p) => p.id === id);
  ok(pl("u_lemur").nick === "레무르" && pl("u_marin").gender == null && pl("guest_mixaaaaaa").gender === "m" && pl("guest_mixaaaaaa").age === 19, "멀티 공개 설정 이상");
  let last = null; host.on("clm:room", (r) => { last = r; });
  await emit(g1, "clm:ready", { ready: true }); await emit(m2, "clm:ready", { ready: true });
  ok((await emit(host, "clm:start", {})).ok, "멀티 시작 실패");
  for (let round = 0; round < 5; round++) {
    for (let w = 0; w < 300 && !(last?.phase === "play" && last.round === round); w++) await sleep(20);
    // 동점: 세 사람 모두 같은 기록
    await Promise.all([host, g1, m2].map((s) => emit(s, "clm:submit", { round, log: last.tests[round] === "reaction" ? { tr: [250, 250, 260, 255, 251] } : {} })));
    for (let w = 0; w < 300 && last?.phase === "play"; w++) await sleep(20);
    if (round === 0) ok(last.roundResult.rows.every((x) => x.rank === 1), "동점인데 순위가 다름");
  }
  for (let w = 0; w < 300 && last?.phase !== "final"; w++) await sleep(20);
  ok(last.final && last.final.report.ranking.every((x) => x.rank === 1), "최종 동점 처리 이상");
  await sleep(100);
  ok(DB.clinic_groups.some((gr) => gr.id === last.final.groupId) && DB.clinic_results.filter((r) => r.group_id === last.final.groupId).length === 3, "단체 결과 저장 안 됨");
  const rows = DB.clinic_results.filter((r) => r.group_id === last.final.groupId);
  ok(rows.find((r) => r.user_id === "u_marin").nickname === "마린" && rows.find((r) => r.owner_key === "g:guest_mixaaaaaa").user_id === null, "단체 결과 계정 연결 이상");
  const grp = await get(`/clinic/group/${last.final.groupId}`);
  ok(grp.ok && grp.group.players.find((p) => p.id === "u_marin").age == null && grp.group.players.find((p) => p.id === "guest_mixaaaaaa").age === 19, "단체 결과 링크 개인정보 이상");
  [host, g1, m2].forEach((s) => s.close());
}

// 6) 초대 코드 무작위 대입 차단
{
  const s = await conn("guest_bruteforce");
  let blocked = false;
  for (let i = 0; i < 12; i++) { const r = await emit(s, "clm:join", { code: String(100000 + i) }); if (r.error === "RATE_LIMITED") { blocked = true; break; } }
  ok(blocked, "초대 코드 대입이 막히지 않음");
  s.close();
}

io.close(); server.close();
console.log(`\n진단소 DB 경로 시험: 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
