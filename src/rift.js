// =========================
// 운명의 균열 (Rift of Fate) — 서버: 2~4인 협동 방 · 스트리머 모드 · 혼자 하기 기록 검증
// - 협동: 서버가 규칙 엔진(rift-core.js, 화면과 같은 파일)으로 모든 행동을 판정. 클라는 행동만 보냄(체력·에너지·비용·보상 조작 불가)
// - 같은 턴 동시 행동: 각자 카드를 쓰고 '턴 종료' → 모두 끝내면 적 차례. 60초(끊긴 사람 15초) 지나면 자동 턴 종료
// - 경로·이벤트는 투표(25초, 다수결 · 같으면 먼저 낸 표), 보상·상점·휴식은 개인(90초 지나면 자동 처리)
// - 재접속: 같은 계정/게스트 ID면 자기 자리로 · 방장 나가면 다음 사람 · 게임 중 새로 들어오면 관전
// - 스트리머 모드: 스트리머 1명(+팀원 최대 3)이 하고 시청자 수백 명이 관전·투표(웹 버튼 또는 채팅 !1~!4, 한 사람 한 표)
//   투표: 축복·저주 / 다음 적 / 다음 이벤트 / 보스 강화 / 보상 카드 추천 · 후원(치지직·씨미 공식, SOOP 별풍선 비공식) 금액별 효과는 스트리머가 설정
//   같은 후원은 고유 ID(없으면 내용+3초 창)로 한 번만 · 후원 없이도 투표만으로 다 됨
// - 시청자에게는 상태를 모아서 1초 4번까지만 보냄(수백 명 대비) · 상태에서 행동 기록(log)은 빼고 보냄
// - 혼자 하기 기록: 시드+행동 기록을 서버가 처음부터 다시 돌려 결과 확인 후 저장 (rift_runs)
// =========================
import DATA from "./rift-data.js";
import * as R from "./rift-core.js";
import { parseAmount, cleanDonor } from "./duowars-stream.js";
import { logGameStreamer } from "./stream-log.js"; // 스트리머 모드 켜면 admin 「📺 스트리머」 기록
R.setData(DATA);

const ROOMS = new Map();
const dailyCache = new Map();
// 한국 시간 날짜 (YYYY-MM-DD), off: 하루 단위 더하기
export const kstDay = (off = 0) => new Date(Date.now() + 9 * 3600000 + off * 86400000).toISOString().slice(0, 10);
const F = process.env.RIFT_FAST ? Number(process.env.RIFT_FAST) : 1;   // 시험 서버 전용: 시간 줄이기 (운영엔 설정 안 함)
const TURN_MS = 60000 * F, OFF_TURN_MS = 15000 * F, VOTE_MS = 25000 * F, PERSONAL_MS = 90000 * F, EVENT_SHOW_MS = 8000 * F, IDLE_DROP_MS = 15 * 60000;
const VIEW_THROTTLE = 250, MAX_VIEWERS = 2000, SOOP_BALLOON_KRW = 100;
const code4 = () => { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };
const clean = (s) => String(s || "").replace(/[<>\n\r\t]/g, "").trim().slice(0, 12);
const ch = (code) => `rift:${code}`, vch = (code) => `rift:${code}:v`;
const rnd = (n) => Math.floor(Math.random() * n), pickN = (a, n) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = rnd(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b.slice(0, n); };
let HOOKS = {};

// ---------- 스트리머 설정 ----------
export const ST_KINDS = ["bless", "curse", "nick", "gift", "boss"];
const defaultStream = () => ({ rules: { bless: 1000, curse: 1100, nick: 2000, gift: 3000, boss: 5000 }, auto: true, follow: false, dur: 30, link: { status: "off", platform: null, nickname: null, donation: false, error: null }, log: [], recent: new Map(), vote: null, rot: 0, lastMap: null, bossVoted: false, pickAt: null, voters: 0, feed: [] });
function streamPub(r) {
  const s = r.st; if (!s) return null; const v = s.vote;
  return { rules: s.rules, auto: s.auto, follow: s.follow, dur: s.dur, link: s.link, log: s.log.slice(-12), viewers: r.viewers.size, feed: s.feed.slice(-8),
    vote: v ? { id: v.id, kind: v.kind, title: v.title, opts: v.opts.map((o) => ({ n: o.n })), counts: v.counts, total: v.counts.reduce((a, b) => a + b, 0), until: v.until, result: v.result ?? null } : null };
}
function roomPub(r, uid) {
  const players = r.players.map((p) => (p ? { name: p.name, char: p.char, ready: !!p.ready, on: !!p.on } : null));
  const me = r.players.findIndex((p) => p && p.uid === uid);
  return { code: r.code, mode: r.mode, phase: r.phase, host: r.host, players, diff: r.diff, me, votes: r.votes, deadline: r.deadline, spectators: r.spect.size + r.viewers.size, stream: streamPub(r) };
}
const pubRun = (run) => { if (!run) return null; const { log, ...rest } = run; return rest; };
function emitRoom(io, r) { for (const [sid, uid] of r.socks) io.to(sid).emit("rift:room", roomPub(r, uid)); viewRoom(io, r); }
function emitState(io, r, ev = []) {
  if (!r.run) return; const run = pubRun(r.run);
  for (const [sid, uid] of r.socks) { const pub = roomPub(r, uid); io.to(sid).emit("rift:state", { code: r.code, run, me: pub.me < 0 ? 0 : pub.me, spectator: pub.me < 0, room: pub, ev }); }
  // 시청자: 모아서 보냄 (연출 사건은 쌓아 두었다가 같이)
  r.vbuf = (r.vbuf || []).concat(ev).slice(-200);
  if (!r.vtimer) r.vtimer = setTimeout(() => { r.vtimer = null; if (!r.viewers.size || !r.run) { r.vbuf = []; return; } io.to(vch(r.code)).emit("rift:state", { code: r.code, run: pubRun(r.run), me: 0, spectator: true, room: roomPub(r, null), ev: r.vbuf }); r.vbuf = []; }, VIEW_THROTTLE);
}
function viewRoom(io, r) { if (!r.viewers.size || r.vrt) return; r.vrt = setTimeout(() => { r.vrt = null; io.to(vch(r.code)).emit("rift:room", roomPub(r, null)); }, VIEW_THROTTLE); }
// 지금 기다리는 것에 맞춰 마감 시각을 다시 정함 (단계가 바뀔 때만)
function schedule(r) {
  const run = r.run; if (!run || run.over) { r.deadline = null; return; }
  const key = `${run.phase}:${run.at}:${run.cb?.turn ?? ""}:${run.room?.chosen ?? ""}:${run.room?.ev ?? ""}`;
  if (key === r.key) return; r.key = key; r.votes = {};
  const now = Date.now(), solo = r.players.length === 1;
  if (run.phase === "combat") { const allOff = run.players.every((p, i) => !p.alive || !r.players[i]?.on); r.deadline = solo && !allOff ? null : now + (allOff ? OFF_TURN_MS : TURN_MS); }   // 스트리머 혼자면 턴 제한 없음
  else if (solo) r.deadline = run.phase === "event" && run.room?.chosen != null ? null : null;
  else if (run.phase === "map" || (run.phase === "event" && run.room?.chosen == null)) r.deadline = now + VOTE_MS;
  else if (run.phase === "event") r.deadline = now + EVENT_SHOW_MS;
  else r.deadline = now + PERSONAL_MS;
}
// 투표 결과 (같은 수면 먼저 낸 표)
function tally(votes) { const cnt = new Map(); for (const v of Object.values(votes)) { const k = JSON.stringify(v); cnt.set(k, (cnt.get(k) || 0) + 1); } let best = null, n = -1; for (const [k, c] of cnt) if (c > n) { best = k; n = c; } return best ? JSON.parse(best) : null; }
function applyTeam(io, r, a) { const res = R.act(r.run, -1, a); r.votes = {}; r.key = null; schedule(r); if (res.ok) { emitState(io, r, res.ev); afterChange(io, r); } else emitRoom(io, r); return res; }   // 실패해도 마감을 다시 잡아 멈추지 않게
// 마감이 지나면 남은 사람 대신 처리
function onDeadline(io, r) {
  const run = r.run; if (!run || run.over) return;
  if (run.phase === "combat") { let ev = []; for (const p of run.players) { const cp = run.cb?.ps[p.i]; if (p.alive && cp && !cp.ready && !cp.out && run.phase === "combat") { const x = R.act(run, p.i, { t: "end" }); ev = ev.concat(x.ev); } } r.key = null; schedule(r); emitState(io, r, ev); afterChange(io, r); return finishIfOver(io, r); }
  if (run.phase === "map") { const nx = R.nextNodes(run), v = tally(r.votes); applyTeam(io, r, { t: "path", node: nx.includes(v) ? v : nx[rnd(nx.length)] }); return finishIfOver(io, r); }
  if (run.phase === "event") {
    if (run.room.chosen == null) { const e = DATA.EVENTS.find((x) => x.id === run.room.ev), v = tally(r.votes); const okV = Number.isInteger(v) && e.opts[v]; const res = applyTeam(io, r, { t: "event", opt: okV ? v : e.opts.length - 1 }); if (!res.ok) applyTeam(io, r, { t: "event", opt: e.opts.length - 1 }); }
    else applyTeam(io, r, { t: "leave" });
    return finishIfOver(io, r);
  }
  let ev = [];
  for (const p of run.players) {
    const s = run.room?.per?.[p.i]; if (!s || s.done) continue;
    const a = run.phase === "reward" ? { t: "reward", pick: -1 } : run.phase === "rest" ? { t: "rest", kind: "heal" } : { t: "leave" };
    const x = R.act(run, p.i, a); ev = ev.concat(x.ev);
  }
  r.key = null; schedule(r); emitState(io, r, ev); afterChange(io, r);
}
async function finishIfOver(io, r) {
  if (!r.run?.over || r.saved) return; r.saved = true;
  if (r.st?.vote) { r.st.vote = null; emitRoom(io, r); }
  if (r.sb) { try { const sm = R.summary(r.run); await r.sb.from("rift_runs").insert({ mode: r.mode === "stream" ? "stream" : "coop", owner_key: r.players.map((p) => p?.uid).filter(Boolean).join(","), nickname: r.players.filter(Boolean).map((p) => p.name).join(", ").slice(0, 60), chars: r.run.players.map((p) => p.char), diff: r.run.diff, win: sm.win, floor: sm.floor, turns: sm.turns, players: r.run.players.length, summary: { ...sm, viewers: r.st ? r.st.voters : 0 }, created_at: new Date().toISOString() }); } catch {} }
}

// =========================================================
// 스트리머 모드: 투표
// =========================================================
const N3 = (ko, ja, en) => [ko, ja, en];
function makeVote(r, kind) {
  const run = r.run, Rg = DATA.REGIONS[run.region];
  if (kind === "fate") { const b = pickN(DATA.BLESS, 2), c = pickN(DATA.CURSES, 2); return { title: N3("시청자 투표: 축복일까 저주일까?", "視聴者投票：祝福か呪いか？", "Viewer vote: blessing or curse?"), opts: [...b.map((x) => ({ n: x.n, kind: "bless", id: x.id })), ...c.map((x) => ({ n: x.n, kind: "curse", id: x.id }))] }; }
  if (kind === "enc") { const pool = pickN(Rg.normal, 3); return { title: N3("시청자 투표: 다음 전투의 적", "視聴者投票：次の戦闘の敵", "Viewer vote: next enemies"), opts: pool.map((ids) => ({ n: [0, 1, 2].map((L) => ids.map((id) => DATA.ENEMIES[id].n[L]).join(" + ")), kind: "enc", ids })) }; }
  if (kind === "event") { const pool = pickN(DATA.EVENTS.filter((e) => !e.stream && (!e.reg || e.reg === run.region) && !run.seenEv.includes(e.id)), 3); if (pool.length < 2) return null; return { title: N3("시청자 투표: 다음 이벤트", "視聴者投票：次のイベント", "Viewer vote: next event"), opts: pool.map((e) => ({ n: e.n, kind: "event", id: e.id })) }; }
  if (kind === "boss") { const b = pickN(DATA.BOSSBUFF, 3); return { title: N3("시청자 투표: 보스를 강하게!", "視聴者投票：ボスを強化！", "Viewer vote: empower the boss!"), opts: b.map((x) => ({ n: x.n, kind: "boss", id: x.id })) }; }
  if (kind === "pick") { const per = run.room?.per?.[0]; if (!per || per.done || !per.cards?.length) return null; return { title: N3("시청자 추천: 어떤 카드를 가져갈까?", "視聴者のおすすめ：どのカードを取る？", "Viewers pick: which card to take?"), opts: per.cards.map((id, k) => { const d = R.cardDef(id); return { n: d.n, kind: "pick", k }; }) }; }
  return null;
}
function openVote(io, r, kind) {
  const v = makeVote(r, kind); if (!v) return false;
  r.st.vote = { id: Date.now().toString(36), kind, title: v.title, opts: v.opts, counts: v.opts.map(() => 0), by: new Map(), until: Date.now() + r.st.dur * 1000 * F, result: null };
  emitRoom(io, r); return true;
}
function castVote(io, r, key, nick, idx) {
  const v = r.st?.vote; if (!v || v.result != null || Date.now() > v.until) return "NO_VOTE";
  if (!Number.isInteger(idx) || idx < 0 || idx >= v.opts.length) return "BAD_OPT";
  if (v.by.has(key)) { const old = v.by.get(key); if (old === idx) return null; v.counts[old]--; }   // 바꿔 찍기 허용(한 사람 한 표)
  else r.st.voters++;
  v.by.set(key, idx); v.counts[idx]++;
  if (nick) { r.st.feed.push({ nick: String(nick).slice(0, 12), i: idx }); if (r.st.feed.length > 30) r.st.feed.shift(); }
  if (!r.vvt) r.vvt = setTimeout(() => { r.vvt = null; emitRoom(io, r); }, 300);
  return null;
}
function closeVote(io, r) {
  const v = r.st.vote; if (!v || v.result != null) return;
  let best = 0; v.counts.forEach((c, i) => { if (c > v.counts[best]) best = i; });
  if (!v.counts.some((c) => c > 0)) best = rnd(v.opts.length);   // 아무도 안 찍으면 무작위
  v.result = best; const o = v.opts[best]; let res = null;
  if (o.kind === "bless" || o.kind === "curse" || o.kind === "boss" || o.kind === "event") res = R.streamApply(r.run, o.kind, { id: o.id });
  else if (o.kind === "enc") res = R.streamApply(r.run, "enc", { ids: o.ids });
  else if (o.kind === "pick" && r.st.follow && r.run.phase === "reward" && !r.run.room?.per?.[0]?.done) { const x = R.act(r.run, 0, { t: "reward", pick: o.k }); if (x.ok) { r.key = null; schedule(r); res = { ok: true, ev: x.ev }; } }
  const ev = [...(res?.ev || []), { k: "voteend", kind: v.kind, n: o.n }];
  emitState(io, r, ev); emitRoom(io, r);
  setTimeout(() => { if (r.st?.vote === v) { r.st.vote = null; emitRoom(io, r); afterChange(io, r); } }, 4000 * F);
}
// 단계가 바뀔 때 자동으로 투표 열기
function afterChange(io, r) {
  if (r.mode !== "stream" || !r.st?.auto || !r.run || r.run.over || r.st.vote) return;
  const run = r.run, s = r.st;
  if (run.phase === "reward" && s.pickAt !== run.at) { s.pickAt = run.at; if (openVote(io, r, "pick")) return; }
  if (run.phase === "map" && s.lastMap !== (run.at || "start")) {
    s.lastMap = run.at || "start";
    const nr = run.at ? run.map.nodes[run.at]?.r ?? 0 : 0; if (nr >= run.map.rows - 3 && s.bossVoted !== run.ri) { s.bossVoted = run.ri; if (openVote(io, r, "boss")) return; }   // 지역마다 보스 앞에서 한 번
    const order = ["fate", "enc", "event"];
    for (let k = 0; k < 3; k++) { const kind = order[(s.rot + k) % 3]; if (openVote(io, r, kind)) { s.rot = (s.rot + k + 1) % 3; return; } }
  }
}
// =========================================================
// 스트리머 모드: 후원
// =========================================================
const BOSS_KEYS = () => DATA.BOSSBUFF.map((b) => b.id);
function receiveDonation(io, r, d) {
  const s = r.st, amount = d.amount, kind = ST_KINDS.find((k) => s.rules[k] === amount) || null;
  const rec = { at: Date.now(), donor: cleanDonor ? cleanDonor(d.donor) : clean(d.donor), amount, kind, status: "no_match", note: "", test: !!d.test };
  if (kind) {
    if (!r.run || r.run.over) rec.status = "not_playing";
    else {
      let res = null;
      if (kind === "bless") { const b = DATA.BLESS[rnd(DATA.BLESS.length)]; res = R.streamApply(r.run, "bless", { id: b.id }); rec.note = b.n[0]; }
      else if (kind === "curse") { const c = DATA.CURSES[rnd(DATA.CURSES.length)]; res = R.streamApply(r.run, "curse", { id: c.id }); rec.note = c.n[0]; }
      else if (kind === "nick") { res = R.streamApply(r.run, "nick", { nick: rec.donor }); rec.note = `${rec.donor} 몬스터 등장`; }
      else if (kind === "gift") { res = R.streamApply(r.run, "gift", { nick: rec.donor }); rec.note = "특별 이벤트"; }
      else if (kind === "boss") { const id = BOSS_KEYS()[rnd(DATA.BOSSBUFF.length)]; res = R.streamApply(r.run, "boss", { id }); rec.note = DATA.BOSSBUFF.find((b) => b.id === id).n[0]; }
      rec.status = res?.ok ? "applied" : "skipped";
      if (res?.ok) { r.key = null; schedule(r); emitState(io, r, [...res.ev, { k: "donation", donor: rec.donor, amount, kind }]); }
    }
  }
  s.log.push(rec); if (s.log.length > 40) s.log.shift();
  io.to(ch(r.code)).emit("rift:don", rec); if (r.viewers.size) io.to(vch(r.code)).emit("rift:don", rec);
  emitRoom(io, r);
  return rec;
}
function onPlatformDonation(io, r, platform, raw) {
  let data = raw; if (typeof data === "string") { try { data = JSON.parse(data); } catch { return; } }
  if (!data || typeof data !== "object" || ROOMS.get(r.code) !== r || !r.st) return;
  let amount = null;
  if (platform === "chzzk") amount = parseAmount(String(data.payAmount ?? "").replace(/[,\s]/g, ""));
  else if (platform === "soop") { const n = Number(data.balloons); amount = Number.isSafeInteger(n) && n > 0 ? parseAmount(n * SOOP_BALLOON_KRW) : null; }
  else if (platform === "cime") { const beam = Number(String(data.payAmountNumber ?? data.payAmount ?? "").replace(/[,\s]/g, "")); amount = Number.isSafeInteger(beam) ? parseAmount(beam) : null; }
  if (amount === null) return;
  // 중복 방지: 고유 ID가 있으면 그것으로(영구), 없으면 내용으로 3초 안 같은 것 무시
  const s = r.st, t = Date.now(), uidKey = data.donationId || data.id || data.eventId || data.msgId || null;
  const key = uidKey ? `id:${platform}:${uidKey}` : `h:${[platform, data.channelId || "", data.donatorChannelId || "anon", amount, String(data.donationText || "").slice(0, 60)].join("|")}`;
  const prev = s.recent.get(key); if (prev != null && (uidKey || t - prev < 3000)) return;
  s.recent.set(key, t); if (s.recent.size > 500) for (const [k, v] of s.recent) if (t - v > 600000) s.recent.delete(k);
  receiveDonation(io, r, { donor: data.donatorNickname || data.nickname || "익명 후원자", amount });
}
function onPlatformChat(io, r, evt) {
  try {
    const text = String(evt?.content ?? evt?.message ?? evt?.msg ?? "").trim(); const m = text.match(/^!\s*([1-4])$/); if (!m) return;
    const who = String(evt?.senderChannelId ?? evt?.userId ?? evt?.profile?.nickname ?? ""); if (!who) return;
    castVote(io, r, "c:" + who, evt?.profile?.nickname || evt?.nickname || null, +m[1] - 1);
  } catch {}
}

export function registerRift(io, supabaseAdmin, app, hooks = {}) {
  HOOKS = hooks || {};
  setInterval(() => {
    const now = Date.now();
    for (const r of ROOMS.values()) {
      if (r.deadline && now > r.deadline && r.phase === "run") { r.deadline = null; try { onDeadline(io, r); } catch (e) { console.error("[rift] deadline", e); } }
      if (r.st?.vote && r.st.vote.result == null && now > r.st.vote.until) { try { closeVote(io, r); } catch (e) { console.error("[rift] vote", e); } }
      const anyOn = r.players.some((p) => p?.on) || r.spect.size || r.viewers.size; if (anyOn) r.lastOn = now; else if (now - r.lastOn > IDLE_DROP_MS) dropRoom(r);
    }
  }, F < 1 ? 50 : 1000).unref?.();
  const dropRoom = (r) => { ROOMS.delete(r.code); if (r.mode === "stream") { try { HOOKS.unlinkChat?.("dw_rf_" + r.code); } catch {} } };

  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const uid = String(me.id);
    let win = Date.now(), cnt = 0;
    const limited = () => { const n = Date.now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > 120; };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => { const reply = typeof cb === "function" ? cb : () => {}; if (limited()) return reply({ ok: false, error: "RATE_LIMITED" }); try { await fn(p || {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); } });
    const myRoom = (code) => { const r = ROOMS.get(String(code || "").toUpperCase()); return r && r.socks.has(socket.id) ? r : null; };
    const seat = (r) => r.players.findIndex((p) => p && p.uid === uid);
    const hostRoom = (code) => { const r = myRoom(code); return r && seat(r) === r.host ? r : null; };

    on("rift:create", (p, reply) => {
      // 한 사람이 방을 끝없이 만들지 못하게: 혼자 있는 내 대기실은 새 방을 만들 때 지움 · 전체 방 수 제한
      for (const o of [...ROOMS.values()]) if (o.phase === "lobby" && o.players.filter(Boolean).length <= 1 && o.players[0]?.uid === uid) dropRoom(o);
      if (ROOMS.size >= 3000) return reply({ ok: false, error: "BUSY" });
      let code; do code = code4(); while (ROOMS.has(code));
      const stream = !!p.stream;
      const r = { code, mode: stream ? "stream" : "coop", phase: "lobby", host: 0, players: [{ uid, name: clean(p.name) || "모험가", char: "knight", ready: false, on: true }], diff: "normal", run: null, votes: {}, deadline: null, key: null, socks: new Map(), spect: new Set(), viewers: new Map(), lastOn: Date.now(), sb: supabaseAdmin, saved: false, st: stream ? defaultStream() : null };
      ROOMS.set(code, r); r.socks.set(socket.id, uid); socket.join(ch(code));
      if (stream) logGameStreamer("rift", { hostUserId: uid, code, players: new Map([[uid, { name: r.players[0].name }]]) });   // admin 「📺 스트리머」 (channel_id = room:rift:코드)
      reply({ ok: true, room: roomPub(r, uid), me: 0, name: r.players[0].name }); emitRoom(io, r);
    });
    on("rift:join", (p, reply) => {
      const r = ROOMS.get(String(p.code || "").toUpperCase()); if (!r) return reply({ ok: false, error: "NO_ROOM" });
      let i = seat(r);
      if (i < 0 && r.phase === "lobby") { i = r.players.findIndex((x) => !x); if (i < 0 && r.players.length < 4) i = r.players.length; if (i < 0 || i >= 4) return reply({ ok: false, error: "FULL" }); r.players[i] = { uid, name: clean(p.name) || "모험가", char: "chrono", ready: false, on: true }; }
      if (i >= 0) { r.players[i].on = true; if (p.name) r.players[i].name = clean(p.name) || r.players[i].name; } else r.spect.add(uid);
      r.socks.set(socket.id, uid); socket.join(ch(r.code));
      reply({ ok: true, room: roomPub(r, uid), me: i, name: i >= 0 ? r.players[i].name : clean(p.name), run: pubRun(r.run), spectator: i < 0 });
      emitRoom(io, r); if (r.run) { r.key = null; schedule(r); emitState(io, r); }
    });
    // 시청자 입장 (스트리머 모드 · 관전 전용 통로)
    on("rift:watch", (p, reply) => {
      const r = ROOMS.get(String(p.code || "").toUpperCase()); if (!r) return reply({ ok: false, error: "NO_ROOM" });
      if (r.viewers.size >= MAX_VIEWERS) return reply({ ok: false, error: "FULL" });
      r.viewers.set(socket.id, { uid, nick: clean(p.nick) }); socket.join(vch(r.code));
      reply({ ok: true, room: roomPub(r, null), run: pubRun(r.run) }); viewRoom(io, r);
    });
    on("rift:vote", (p, reply) => {
      const r = ROOMS.get(String(p.code || "").toUpperCase()); if (!r || r.mode !== "stream") return reply({ ok: false, error: "NO_ROOM" });
      if (!r.viewers.has(socket.id) && !r.socks.has(socket.id)) return reply({ ok: false, error: "NOT_IN_ROOM" });
      const nick = r.viewers.get(socket.id)?.nick || null; if (p.nick && r.viewers.has(socket.id)) r.viewers.get(socket.id).nick = clean(p.nick);
      const e = castVote(io, r, "u:" + uid, clean(p.nick) || nick, p.i | 0); reply(e ? { ok: false, error: e } : { ok: true });
    });
    // 스트리머 설정 · 테스트 후원 · 수동 투표
    on("rift:stream", (p, reply) => {
      const r = hostRoom(p.code); if (!r || r.mode !== "stream") return reply({ ok: false, error: "NOT_HOST" }); const s = r.st;
      if (p.rules && typeof p.rules === "object") { const next = { ...s.rules }; for (const k of ST_KINDS) if (p.rules[k] !== undefined) { const v = parseAmount(Number(p.rules[k])); if (v === null) return reply({ ok: false, error: "BAD_AMOUNT" }); next[k] = v; } if (new Set(Object.values(next)).size !== ST_KINDS.length) return reply({ ok: false, error: "SAME_AMOUNT" }); s.rules = next; }
      if (p.auto !== undefined) s.auto = !!p.auto; if (p.follow !== undefined) s.follow = !!p.follow; if (p.dur) s.dur = Math.max(10, Math.min(90, p.dur | 0));
      reply({ ok: true }); emitRoom(io, r); afterChange(io, r);
    });
    on("rift:streamTest", (p, reply) => { const r = hostRoom(p.code); if (!r || r.mode !== "stream") return reply({ ok: false, error: "NOT_HOST" }); if (!ST_KINDS.includes(p.kind)) return reply({ ok: false }); reply({ ok: true, rec: receiveDonation(io, r, { donor: clean(p.nick) || "테스트 후원자", amount: r.st.rules[p.kind], test: true }) }); });
    on("rift:voteNow", (p, reply) => { const r = hostRoom(p.code); if (!r || r.mode !== "stream" || !r.run || r.run.over) return reply({ ok: false, error: "NOT_HOST" }); if (r.st.vote) return reply({ ok: false, error: "VOTING" }); reply({ ok: openVote(io, r, ["fate", "enc", "event", "boss", "pick"].includes(p.kind) ? p.kind : "fate") }); });
    on("rift:streamLink", async (p, reply) => {
      const r = hostRoom(p.code); if (!r || r.mode !== "stream") return reply({ ok: false, error: "NOT_HOST" }); if (!HOOKS.linkChat) return reply({ ok: false, error: "NO_LINKER" });
      const platform = ["chzzk", "cime", "soop"].includes(p.platform) ? p.platform : null; if (!platform) return reply({ ok: false, error: "BAD_PLATFORM" });
      if (platform === "soop" ? !p.url : !p.accessToken) return reply({ ok: false, error: "NO_TOKEN" });
      const key = "dw_rf_" + r.code; r.st.link = { status: "connecting", platform, nickname: null, donation: false, error: null }; emitRoom(io, r);
      try {
        const res = await HOOKS.linkChat({ platform, key, accessToken: platform === "soop" ? null : String(p.accessToken), soopUrl: platform === "soop" ? String(p.url).slice(0, 200) : null, channelId: p.channelId ? String(p.channelId) : null, nickname: p.nickname ? String(p.nickname).slice(0, 30) : null, hostUserId: me.isGuest ? null : uid, roomCode: r.code, contentMode: "rift",
          onDonation: (d) => onPlatformDonation(io, r, platform, d), onChat: (evt) => onPlatformChat(io, r, evt),
          onClose: () => { if (ROOMS.get(r.code) !== r) return; r.st.link = { ...r.st.link, status: "error", donation: false, error: "연결이 끊겼어요 (방송 종료 등) — 다시 연결해 주세요" }; emitRoom(io, r); } });
        if (ROOMS.get(r.code) !== r) { try { HOOKS.unlinkChat?.(key); } catch {} return reply({ ok: false, error: "ROOM_CLOSED" }); }
        r.st.link = { status: res.ok ? "connected" : "error", platform, nickname: String(res.nickname || p.nickname || "").slice(0, 30) || null, donation: !!res.donationSubscribed, error: res.ok ? (res.donationSubscribed ? null : res.donationError || "후원 구독 실패") : String(res.error || "연결 실패").slice(0, 120) };
      } catch (e) { r.st.link = { status: "error", platform, nickname: null, donation: false, error: String(e.message || e).slice(0, 120) }; }
      emitRoom(io, r); reply({ ok: r.st.link.status === "connected", link: r.st.link });
    });
    on("rift:streamUnlink", (p, reply) => { const r = hostRoom(p.code); if (!r || r.mode !== "stream") return reply({ ok: false, error: "NOT_HOST" }); try { HOOKS.unlinkChat?.("dw_rf_" + r.code); } catch {} r.st.link = { status: "off", platform: null, nickname: null, donation: false, error: null }; emitRoom(io, r); reply({ ok: true }); });

    on("rift:char", (p, reply) => { const r = myRoom(p.code), i = r ? seat(r) : -1; if (!r || i < 0 || r.phase !== "lobby") return reply({ ok: false, error: "NOT_IN_ROOM" }); if (!(typeof p.char === "string" && Object.hasOwn(DATA.CHARS, p.char))) return reply({ ok: false, error: "BAD_CHAR" }); r.players[i].char = p.char; r.players[i].ready = false; reply({ ok: true }); emitRoom(io, r); });
    on("rift:diff", (p, reply) => { const r = hostRoom(p.code); if (!r || r.phase !== "lobby") return reply({ ok: false, error: "NOT_HOST" }); if (!(typeof p.diff === "string" && Object.hasOwn(DATA.DIFF, p.diff))) return reply({ ok: false }); r.diff = p.diff; r.players.forEach((x) => x && (x.ready = false)); reply({ ok: true }); emitRoom(io, r); });
    on("rift:ready", (p, reply) => { const r = myRoom(p.code), i = r ? seat(r) : -1; if (!r || i < 0 || r.phase !== "lobby") return reply({ ok: false, error: "NOT_IN_ROOM" }); r.players[i].ready = !!p.ready; reply({ ok: true }); emitRoom(io, r); });
    on("rift:start", (p, reply) => {
      const r = hostRoom(p.code); if (!r) return reply({ ok: false, error: "NOT_HOST" }); if (r.phase !== "lobby") return reply({ ok: false, error: "STARTED" });
      const ps = r.players.filter(Boolean); if (ps.length < (r.mode === "stream" ? 1 : 2)) return reply({ ok: false, error: "NEED_2" }); if (!ps.every((x, k) => x.ready || (r.mode === "stream" && x.uid === uid))) return reply({ ok: false, error: "NOT_READY" });
      r.players = ps; r.host = Math.max(0, r.players.findIndex((x) => x.uid === uid));
      r.run = R.newRun({ seed: (Math.random() * 0xffffffff) >>> 0, chars: ps.map((x) => x.char), names: ps.map((x) => x.name), diff: r.diff, mode: "coop" });
      if (r.mode === "stream") { r.run.stream = true; Object.assign(r.st, { vote: null, rot: 0, lastMap: null, bossVoted: -1, pickAt: null, voters: 0, feed: [] }); }
      r.phase = "run"; r.saved = false; r.key = null; schedule(r);
      reply({ ok: true }); emitRoom(io, r); emitState(io, r); afterChange(io, r);
    });
    on("rift:again", (p, reply) => {   // 판이 끝난 뒤 같은 방으로 대기실
      const r = hostRoom(p.code); if (!r || !r.run?.over) return reply({ ok: false, error: "NOT_HOST" });
      r.phase = "lobby"; r.run = null; r.deadline = null; r.key = null; r.players.forEach((x) => x && (x.ready = false)); if (r.st) r.st.vote = null;
      reply({ ok: true }); emitRoom(io, r);
    });
    on("rift:act", (p, reply) => {
      const r = myRoom(p.code); if (!r || !r.run) return reply({ ok: false, error: "NOT_IN_ROOM" });
      const i = seat(r); if (i < 0) return reply({ ok: false, error: "SPECTATOR" });
      const a = p.a && typeof p.a === "object" ? p.a : null; if (!a) return reply({ ok: false, error: "BAD_ACTION" });
      const run = r.run;
      // 공동 결정: 투표 (혼자면 바로)
      if ((a.t === "path" && run.phase === "map") || (a.t === "event" && run.phase === "event" && run.room?.chosen == null)) {
        if (a.t === "path" && !R.nextNodes(run).includes(a.node)) return reply({ ok: false, error: "BAD_NODE" });
        if (a.t === "event") { const e = DATA.EVENTS.find((x) => x.id === run.room.ev), o = e?.opts[a.opt | 0]; if (!o) return reply({ ok: false, error: "BAD_OPT" }); if (o.need?.gold && run.players.some((x) => x.gold < o.need.gold)) return reply({ ok: false, error: "NEED" }); }
        r.votes[i] = a.t === "path" ? a.node : a.opt | 0;
        const voters = r.players.map((x, k) => (x.on ? k : -1)).filter((k) => k >= 0);
        if (voters.every((k) => r.votes[k] != null)) { const v = tally(r.votes); applyTeam(io, r, a.t === "path" ? { t: "path", node: v } : { t: "event", opt: v }); finishIfOver(io, r); }
        else emitRoom(io, r);
        return reply({ ok: true, voted: true });
      }
      if (a.t === "leave" && run.phase === "event") { r.votes[i] = "go"; const voters = r.players.map((x, k) => (x.on ? k : -1)).filter((k) => k >= 0); if (voters.every((k) => r.votes[k] === "go")) applyTeam(io, r, { t: "leave" }); else emitRoom(io, r); return reply({ ok: true }); }
      const res = R.act(run, i, a);
      if (!res.ok) return reply({ ok: false, error: res.err });
      schedule(r); emitState(io, r, res.ev); afterChange(io, r); finishIfOver(io, r);
      reply({ ok: true });
    });
    on("rift:leave", (p, reply) => {
      const code = String(p.code || "").toUpperCase(), rv = ROOMS.get(code);
      if (rv && rv.viewers.has(socket.id)) { rv.viewers.delete(socket.id); socket.leave(vch(code)); viewRoom(io, rv); }
      const r = myRoom(p.code); if (!r) return reply({ ok: true });
      r.socks.delete(socket.id); socket.leave(ch(r.code)); r.spect.delete(uid);
      const i = seat(r);
      if (i >= 0) { if (r.phase === "lobby") { r.players[i] = null; while (r.players.length && !r.players[r.players.length - 1]) r.players.pop(); } else r.players[i].on = false; }
      if (i === r.host) { const nh = r.players.findIndex((x) => x && x.on); if (nh >= 0) r.host = nh; }
      if (!r.players.some((x) => x)) dropRoom(r); else { emitRoom(io, r); if (r.run) { r.key = null; schedule(r); emitState(io, r); } }
      reply({ ok: true });
    });
    socket.on("disconnect", () => {
      for (const r of ROOMS.values()) {
        if (r.viewers.delete(socket.id)) viewRoom(io, r);
        if (!r.socks.has(socket.id)) continue; r.socks.delete(socket.id);
        if ([...r.socks.values()].includes(uid)) continue;   // 같은 사람이 다른 탭으로 연결돼 있음
        r.spect.delete(uid); const i = seat(r);
        if (i >= 0) { r.players[i].on = false; if (r.phase === "lobby") r.players[i].ready = false; if (i === r.host) { const nh = r.players.findIndex((x) => x && x.on); if (nh >= 0) r.host = nh; } }
        emitRoom(io, r); if (r.run && r.run.phase === "combat") { r.key = null; schedule(r); }
      }
    });
    // ---------- 혼자 하기 기록 제출: 서버가 다시 돌려 확인 ----------
    on("rift:submit", async (p, reply) => {
      const log = Array.isArray(p.log) ? p.log : []; if (log.length > 20000) return reply({ ok: false, error: "TOO_LONG" });
      // 일일 도전: 오늘·어제(한국 시간) 날짜만 받음 · 날짜가 시드·캐릭터·규칙을 정하니 다시 돌리면 같은 판
      const daily = typeof p.daily === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.daily) ? p.daily : null;
      if (daily && ![kstDay(0), kstDay(-1)].includes(daily)) return reply({ ok: false, error: "OLD_DAY" });
      const chars = daily ? [R.dailyInfo(daily).char] : Array.isArray(p.chars) ? p.chars.slice(0, 1) : []; if (!chars.length || !(typeof chars[0] === "string" && Object.hasOwn(DATA.CHARS, chars[0]))) return reply({ ok: false, error: "BAD" });
      const rp = R.replay(daily ? { daily } : { seed: Number(p.seed) >>> 0, chars, diff: typeof p.diff === "string" && Object.hasOwn(DATA.DIFF, p.diff) ? p.diff : "normal", mode: "solo" }, log);
      if (!rp.ok || !rp.run.over) return reply({ ok: false, error: "INVALID" });
      const sm = R.summary(rp.run);
      if (supabaseAdmin) { try { await supabaseAdmin.from("rift_runs").insert({ mode: daily ? "daily" : "solo", owner_key: me.isGuest ? `g:${uid}` : `u:${uid}`, nickname: clean(p.name) || null, chars, diff: rp.run.diff, win: sm.win, floor: sm.floor, turns: sm.turns, players: 1, play_ms: Math.max(0, Math.min(36e6, Number(p.playMs) || 0)), summary: sm, created_at: new Date().toISOString() }); } catch {} }
      if (daily) dailyCache.delete(daily);
      reply({ ok: true, summary: { win: sm.win, floor: sm.floor, turns: sm.turns, score: sm.score ?? null, daily } });
    });
  });

  if (!app) return;
  // 일일 도전 순위: 그날 기록 중 사람마다 최고 점수 · 상위 50
  app.get("/rift/daily", async (req, res) => {
    try {
      const day = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.day || "")) ? String(req.query.day) : kstDay(0);
      const c = dailyCache.get(day); if (c && Date.now() - c.at < 30000) return res.json(c.body);
      if (!supabaseAdmin) return res.json({ ok: true, day, rows: [], total: 0 });
      const { data, error } = await supabaseAdmin.from("rift_runs").select("owner_key, nickname, chars, floor, turns, win, summary->score, created_at").eq("mode", "daily").eq("summary->>daily", day).limit(3000);
      if (error) return res.json({ ok: true, day, rows: [], total: 0 });
      const best = new Map(); for (const x of data || []) { const k = x.owner_key || x.nickname; const o = best.get(k); if (!o || (x.score ?? 0) > (o.score ?? 0)) best.set(k, x); }
      const rows = [...best.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.turns - b.turns).slice(0, 50).map((x) => ({ nickname: x.nickname, char: x.chars?.[0], floor: x.floor, turns: x.turns, win: x.win, score: x.score ?? 0, at: x.created_at }));
      const body = { ok: true, day, rows, total: best.size }; dailyCache.set(day, { at: Date.now(), body }); if (dailyCache.size > 10) dailyCache.delete(dailyCache.keys().next().value);
      res.json(body);
    } catch { res.json({ ok: true, rows: [], total: 0 }); }
  });
  // 기록 판: 클리어만, 난이도 높은 순 → 턴 적은 순
  let cache = { at: 0, body: null };
  // 명예의 전당: 클리어 · 최고 도달 · 최고 한 방 · 덱 배틀 우승 (모두 서버가 확인한 기록만 · 사람마다 가장 좋은 하나)
  let fame = { at: 0, body: null };
  app.get("/rift/fame", async (_req, res) => {
    try {
      if (fame.body && Date.now() - fame.at < 60000) return res.json(fame.body);
      if (!supabaseAdmin) return res.json({ ok: true, clears: [], floors: [], hits: [], battle: [] });
      const cols = "mode, owner_key, nickname, chars, diff, win, floor, turns, players, created_at, hit:summary->players->0->st->maxHit, dmg:summary->players->0->st->dmg, regions:summary->regions";
      const [a, c] = await Promise.all([
        supabaseAdmin.from("rift_runs").select(cols).in("mode", ["solo", "coop", "stream"]).order("created_at", { ascending: false }).limit(3000),
        supabaseAdmin.from("rift_runs").select("players, created_at, summary").eq("mode", "battle").order("created_at", { ascending: false }).limit(200),
      ]);
      const rows = a.data || [], W = { night: 3, hard: 2, normal: 1 };
      const pub = (x, extra = {}) => ({ name: x.nickname || null, chars: x.chars || [], mode: x.mode, diff: x.diff, win: !!x.win, floor: x.floor, turns: x.turns, players: x.players, regions: x.regions ?? null, at: x.created_at, ...extra });
      const best = (list, key, cmp, n = 100) => { const seen = new Set(), out = []; for (const x of [...list].sort(cmp)) { const k = key(x); if (seen.has(k)) continue; seen.add(k); out.push(x); if (out.length >= n) break; } return out; };
      const who = (x) => `${x.owner_key || x.nickname}:${x.mode}`;
      const clears = best(rows.filter((x) => x.win), (x) => `${who(x)}:${(x.chars || []).join(",")}`, (p, q) => (W[q.diff] || 0) - (W[p.diff] || 0) || p.turns - q.turns).map((x) => pub(x));
      const floors = best(rows, who, (p, q) => q.floor - p.floor || (W[q.diff] || 0) - (W[p.diff] || 0) || p.turns - q.turns).map((x) => pub(x));
      const hits = best(rows.filter((x) => x.mode === "solo" && Number(x.hit) > 0), who, (p, q) => Number(q.hit) - Number(p.hit)).map((x) => pub(x, { hit: Number(x.hit) || 0, dmg: Number(x.dmg) || 0 }));
      const battle = (c.data || []).map((x) => { const st = x.summary?.standings || [], top = st.find((s) => s.rank === 1); return top && !top.ai ? { name: top.name, char: top.char, pts: top.pts, players: x.players, humans: x.summary?.humans || 0, at: x.created_at } : null; }).filter(Boolean).slice(0, 50);
      fame = { at: Date.now(), body: { ok: true, clears, floors, hits, battle } }; res.json(fame.body);
    } catch { res.json({ ok: true, clears: [], floors: [], hits: [], battle: [] }); }
  });
  app.get("/rift/ranking", async (_req, res) => {
    try {
      if (cache.body && Date.now() - cache.at < 60000) return res.json(cache.body);
      if (!supabaseAdmin) return res.json({ ok: true, rows: [] });
      const { data, error } = await supabaseAdmin.from("rift_runs").select("mode, owner_key, nickname, chars, diff, floor, turns, players, created_at").eq("win", true).in("mode", ["solo", "coop", "stream"]).order("created_at", { ascending: false }).limit(500);
      if (error) return res.json({ ok: true, rows: [] });
      const W = { night: 3, hard: 2, normal: 1 }, seen = new Set(); const rows = (data || []).sort((a, b) => (W[b.diff] || 0) - (W[a.diff] || 0) || a.turns - b.turns).filter((x) => { const k = `${x.owner_key || x.nickname}:${x.mode}:${(x.chars || []).join(",")}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 50).map(({ owner_key, ...x }) => x);   // 같은 사람·같은 캐릭터는 가장 좋은 기록 하나만 (같은 기록 여러 번 제출 막기)
      cache = { at: Date.now(), body: { ok: true, rows } }; res.json(cache.body);
    } catch { res.json({ ok: true, rows: [] }); }
  });
}
export const _riftTest = { ROOMS, schedule, onDeadline, tally, onPlatformDonation, onPlatformChat };
