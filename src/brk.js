// =========================
// DUO 증강 벽돌깨기 — 방·소켓 (2026-11-18)  이벤트 prefix 'brk:*'
// · 1~50인, 각자 자기 경기장(같은 스테이지 배치)으로 같은 제한 시간 점수 경쟁, 일반 / 증강 모드, 게스트 가능
// · 서버 권위: 화면이 보낸 입력(틱마다 패들 목표 x + 발사·증강 사용·고르기)을 같은 엔진(brk-core.js, 고정 1/60초)으로 다시 돌림
//   → 공·패들·벽돌 체력·점수·생명·스테이지는 서버 계산이 정답. 해시가 다르면 서버 상태(snap)로 다시 맞춤
//   → 실제 시간보다 빨리 돌린 입력은 거절 (가속 방지)
// · 증강 고르기는 각자 따로(내 경기장만 멈춤, 15초 지나면 첫 카드). 시작 증강은 준비 시간에 같이
// · 죽은 사람(생명 0)·시간 끝난 사람에게는 증강 카드가 뜨지 않음
// · 관전(아무 경기장이나 크게), 재접속(같은 아이디면 그대로), 스트리머 후원(방장이 켠 방만, admin 기록 contentMode "brick")
// =========================
import { createFlight } from "./create-flight.js";
import { logGameStreamer } from "./stream-log.js"; // 스트리머 모드 켜면 admin 기록 (11-22)
import { typedNick } from "./nick-pref.js"; // 직접 적은 이름 우선 (2026-11-21)
import { addPublicList } from "./public-rooms.js";
import { BrickGame, AUGS, RARITY, KIND_LABEL, SYNERGY, MAX_AUGS, CAPSULE, BOSS_NAME, TPS, seedFor } from "./brk-core.js";
import { parseAmount, cleanDonor } from "./duowars-stream.js";
import { recordMulti } from "./game-rank.js";

const rooms = new Map(), invites = new Map(), userRoom = new Map();
export const BK = {
  maxPlayers: 50, times: [0, 180, 300, 480, 600], noLimitCap: 20 * 60_000,
  prepAug: 15_000, prepClassic: 3_000, pickMs: 15_000, grace: 1500, slackTicks: 75, maxBatch: 150,
  lobbyDc: 15_000, emptyTtl: 60_000, endedTtl: 10 * 60_000, maxSpect: 60,
  tickSmall: 125, tickBig: 250, bigAt: 13, topViews: 8, rowEvery: 500, snapGap: 300,
};
const SOOP_BALLOON_KRW = 100;
export const STREAM_KINDS = ["multi", "life", "goldrush", "laser", "shrink"];
const STREAM_LABEL = { multi: "🔵 공 +3", life: "❤️ 생명 +1", goldrush: "💰 점수 ×2 10초", laser: "🔫 레이저 폭격 3초", shrink: "🤏 패들 작아짐 5초" };
const STREAM_TARGETS = ["streamer", "random", "leader", "last"];
let HOOKS = {};

const chan = (id) => `brk:${id}`;
const now = () => Date.now();
const MAX_NICK = 12;
const cleanNick = (s, d) => String(s || "").replace(/[\u0000-\u001f​-‏‪-‮⁠-⁯﻿]/g, "").trim().slice(0, MAX_NICK) || d;
function genCode() { for (let i = 0; i < 50; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!invites.has(c)) return c; } return String(Math.floor(Math.random() * 1e7)).padStart(7, "0"); }
const STATUS = { null: 0, dead: 1, time: 2, left: 3 };
const defaultStream = () => ({ on: false, rules: { multi: 1000, life: 5000, goldrush: 3000, laser: 2000, shrink: 1500 }, targets: { multi: "streamer", life: "streamer", goldrush: "streamer", laser: "streamer", shrink: "leader" }, link: { status: "off", platform: null, nickname: null, donation: false, error: null }, log: [], recent: new Map() });

const humans = (r) => [...r.players.values()].filter(p => !p.left);
const connectedCount = (r) => humans(r).filter(p => p.connected).length + [...r.spect.values()].filter(s => s.connected).length;
const deadlineOf = (r) => r.status !== "playing" ? Infinity : (r.endsAt || r.hardEnd || Infinity);
const isBig = (r) => r.order.length >= BK.bigAt;

function pubRoom(r, viewer) {
  const host = viewer === r.hostUserId, st = r.stream;
  const spectator = !r.players.has(viewer) || !!r.players.get(viewer)?.left;
  return {
    id: r.id, code: r.inviteCode, hostId: r.hostUserId, status: r.status, me: viewer, spectator,
    opts: { mode: r.mode, maxPlayers: r.maxPlayers, time: r.time, fair: r.fair, isPublic: !!r.isPublic },
    seats: r.order.map(u => { const p = r.players.get(u); return { id: p.id, idx: p.idx, name: p.name, avatar: p.avatar, isGuest: p.isGuest, connected: p.connected, left: !!p.left }; }),
    spectators: r.spect.size, prepEnd: r.prepEnd || 0, startsAt: r.startsAt || 0, endsAt: r.endsAt || 0, hardEnd: r.hardEnd || 0,
    result: r.status === "ended" ? r.result : null,
    stream: st.on ? { on: true, rules: st.rules, targets: st.targets, labels: STREAM_LABEL, link: host ? st.link : { status: st.link.status, platform: st.link.platform }, log: st.log.slice(-10) } : { on: false },
    serverNow: now(),
  };
}
function emitRoom(io, r) {
  for (const p of r.players.values()) if (!p.left && p.sockId) io.to(p.sockId).emit("brk:room", pubRoom(r, p.id));
  for (const s of r.spect.values()) if (s.sockId) io.to(s.sockId).emit("brk:room", pubRoom(r, s.id));
}
function sendSnap(io, r, p, why = "") {
  if (!p.sockId || !p.game) return;
  const t = now(); if (why === "hash" && t - (p.lastSnap || 0) < BK.snapGap) { p.snapLater = true; return; }
  p.lastSnap = t; p.snapLater = false;
  io.to(p.sockId).emit("brk:snap", { epoch: p.epoch, st: p.game.save(), done: p.done, pickUntil: p.pickUntil || 0, why, serverNow: t });
}
const row = (p) => [p.idx, p.game?.score || 0, p.game?.stage || 0, p.game?.lives || 0, p.done ? STATUS[p.done] : (p.game?.offer ? 4 : 0), p.game?.augs.length || 0, p.connected ? 1 : 0, p.game?.kills.boss || 0];
function rankOf(r) {
  return r.order.map(u => r.players.get(u)).filter(Boolean).sort((a, b) => (b.game?.score || 0) - (a.game?.score || 0) || (b.game?.stage || 0) - (a.game?.stage || 0) || (b.game?.lives || 0) - (a.game?.lives || 0) || a.idx - b.idx);
}
function feed(io, r, ev) { io.to(chan(r.id)).emit("brk:feed", { ...ev, t: now() }); }
// 경기장 보기: 벽돌 목록은 바뀔 때만 (k 빠지면 이전 것 그대로)
function viewOf(p) {
  const v = p.game.view(); const ks = JSON.stringify(v.k);
  if (ks === p.lastK) delete v.k; else p.lastK = ks;
  v.i = p.idx; return v;
}
function flush(io, r) {
  if (r.status !== "playing" && r.status !== "prep") return;
  const t = now();
  if (t - (r.lastRows || 0) >= BK.rowEvery) {
    r.lastRows = t; const rows = [...r.players.values()].filter(p => p.game).map(row);
    io.to(chan(r.id)).emit("brk:tick", { r: rows, t });
    const rk = rankOf(r), lead = rk[0];
    if (lead && (lead.game?.score || 0) > 0 && r.leadIdx !== lead.idx) { const tn = Date.now(); if (r.leadIdx != null && tn - (r.leadAt || 0) > 8000) { feed(io, r, { k: "lead", i: lead.idx, prev: r.leadIdx, score: lead.game.score }); r.leadAt = tn; } r.leadIdx = lead.idx; } // 역전 알림은 8초에 한 번까지 (점수가 비슷하면 계속 뒤집혀서)
  }
  const all = [...r.players.values()].filter(p => p.game && p.dirty);
  if (!all.length) return;
  if (!isBig(r)) { const vs = all.map(p => { p.dirty = false; return viewOf(p); }); io.to(chan(r.id)).emit("brk:views", vs); return; }
  // 큰 방: 상위 8명만 모두에게, 나머지는 크게 보는 사람에게만
  const top = new Set(rankOf(r).slice(0, BK.topViews).map(p => p.idx));
  const pub = all.filter(p => top.has(p.idx)).map(p => { p.dirty = false; return viewOf(p); });
  if (pub.length) io.to(chan(r.id)).emit("brk:views", pub);
  const byIdx = new Map(all.filter(p => !top.has(p.idx)).map(p => [p.idx, p]));
  for (const w of [...r.players.values(), ...r.spect.values()]) {
    if (!w.sockId || w.focus == null) continue; const q = byIdx.get(w.focus); if (!q) continue;
    const v = q.game.view(); v.i = q.idx; io.to(w.sockId).emit("brk:views", [v]); q.dirty = false;
  }
}

// ---------------- 진행 ----------------
function startGame(io, r) {
  for (const u of [...r.order]) { const p = r.players.get(u); if (!p || p.left || !p.connected) removeSeat(r, u); }
  if (!r.order.length) return;
  r.seed = (Math.random() * 2 ** 32) >>> 0; r.result = null; r.leadIdx = null;
  r.order.forEach((u, i) => {
    const p = r.players.get(u); p.idx = i;
    p.game = new BrickGame({ seed: seedFor(r.seed, i, r.fair), mode: r.mode, timed: r.time > 0 });
    p.epoch = (p.epoch || 0) + 1; p.done = null; p.pickUntil = 0; p.dirty = true; p.focus = null; p.lastK = null; p.baseTick = 0; p.hashBad = 0;
  });
  r.status = "prep"; r.prepEnd = now() + (r.mode === "augment" ? BK.prepAug : BK.prepClassic);
  r.startsAt = 0; r.endsAt = 0; r.hardEnd = 0;
  if (r.endTimer) { clearTimeout(r.endTimer); r.endTimer = null; }
  io.to(chan(r.id)).emit("brk:start", { mode: r.mode });
  for (const p of r.players.values()) sendSnap(io, r, p, "start");
  emitRoom(io, r);
}
function beginPlay(io, r) {
  for (const p of r.players.values()) if (p.game?.offer && !p.done) { p.game.step({ ev: [["P", p.game.offer[0]]] }); p.epoch++; }
  r.status = "playing"; r.startsAt = now();
  r.endsAt = r.time > 0 ? r.startsAt + r.time * 1000 : 0; r.hardEnd = r.time > 0 ? 0 : r.startsAt + BK.noLimitCap;
  for (const p of r.players.values()) { p.baseTick = p.game.t; p.lastIn = now(); if (p.left) markDone(io, r, p, "left"); else sendSnap(io, r, p, "go"); }
  io.to(chan(r.id)).emit("brk:go", { startsAt: r.startsAt, endsAt: r.endsAt, hardEnd: r.hardEnd });
  emitRoom(io, r);
}
function autoPick(io, r, p) {
  const g = p.game; if (!g?.offer) return;
  g.step({ ev: [["P", g.offer[0]]] }); p.epoch++; p.pickUntil = 0; p.dirty = true;
  afterChange(io, r, p); sendSnap(io, r, p, "autopick");
}
function markDone(io, r, p, why) {
  if (p.done) return;
  p.done = why; p.dirty = true; if (p.game) p.game.offer = null; p.pickUntil = 0;
  if (why === "dead") feed(io, r, { k: "dead", i: p.idx, score: p.game?.score || 0, stage: p.game?.stage || 0 });
  if (why !== "left") sendSnap(io, r, p, "done");
  checkEnd(io, r);
}
function checkEnd(io, r) { if (r.status === "playing" && [...r.players.values()].every(p => p.done)) finish(io, r, "ALL_DONE"); }
function finish(io, r, reason) {
  if (r.status === "ended") return;
  for (const p of r.players.values()) if (!p.done) { p.done = "time"; if (p.game) p.game.offer = null; }
  for (const p of r.players.values()) p.dirty = true; r.lastRows = 0; flush(io, r);
  r.status = "ended"; r.endedAt = now();
  r.result = { reason, rows: rankOf(r).map((p, i) => ({ place: i + 1, idx: p.idx, id: p.id, name: p.name, avatar: p.avatar, score: p.game?.score || 0, stage: p.game?.stage || 0, lives: p.game?.lives || 0, boss: p.game?.kills.boss || 0, combo: p.game?.maxCombo || 0, augs: p.game?.augs.map(a => a.id) || [], done: p.done })) };
  io.to(chan(r.id)).emit("brk:end", r.result); emitRoom(io, r);
  recordMulti("brick", r.mode, r.time, [...r.players.values()].filter(p => p.game).map(p => ({ id: p.id, isGuest: p.isGuest, name: p.name, score: p.game.score, stage: p.game.stage, boss: p.game.kills.boss, combo: p.game.maxCombo, augs: p.game.augs.map(a => a.id) }))); // 랭킹 (회원+게스트)
  if (r.endTimer) clearTimeout(r.endTimer);
  r.endTimer = setTimeout(() => { if (rooms.get(r.id) === r && r.status === "ended") delRoom(io, r, "ENDED_TTL"); }, BK.endedTtl);
}
// 게임 안 사건 → 알림 (엔진 fxq에서 골라냄)
function afterChange(io, r, p) {
  const g = p.game; p.dirty = true;
  if (g.offer && !p.pickUntil && r.status === "playing") p.pickUntil = now() + BK.pickMs;
  if (!g.offer) p.pickUntil = 0;
  for (const f of g.fxq.splice(0)) {
    if (f.k === "use" && ["legendary", "epic"].includes(AUGS.find(a => a.id === f.id)?.rarity)) feed(io, r, { k: "use", i: p.idx, id: f.id });
    else if (f.k === "got" && AUGS.find(a => a.id === f.id)?.rarity === "legendary") feed(io, r, { k: "got", i: p.idx, id: f.id });
    else if (f.k === "bossdown") feed(io, r, { k: "bossdown", i: p.idx, kind: f.kind, pts: f.pts });
    else if (f.k === "boss") feed(io, r, { k: "boss", i: p.idx, kind: f.kind, stage: g.stage });
    else if (f.k === "miracle") feed(io, r, { k: "miracle", i: p.idx });
    else if (f.k === "clear" && f.n >= 3) feed(io, r, { k: "clear", i: p.idx, n: f.n });
  }
  if (!g.alive && !p.done) markDone(io, r, p, "dead");
}

let ticker = null;
function ensureTicker(io) {
  if (ticker) return;
  ticker = setInterval(() => {
    const t = now();
    for (const r of rooms.values()) {
      try {
        if (r.status === "prep") { const all = [...r.players.values()].every(p => p.left || !p.game?.offer); if (t >= r.prepEnd || (all && r.mode === "augment" && t >= r.prepEnd - BK.prepAug + 1500)) beginPlay(io, r); }
        if (r.status === "playing") {
          if (t > deadlineOf(r)) { finish(io, r, "TIME"); continue; }
          for (const p of r.players.values()) {
            if (p.done) continue;
            // 연결이 1분 넘게 끊겼거나 1분 30초 넘게 입력이 없으면(탭 숨김 등) 지금 점수로 끝 — 끝까지 모드에서 방이 한 사람을 계속 기다리지 않게
            if ((!p.connected && p.dcAt && t - p.dcAt > 60_000) || (p.lastIn && t - p.lastIn > 90_000)) { markDone(io, r, p, p.connected ? "time" : "left"); continue; }
            if (p.game.offer && p.pickUntil && t > p.pickUntil) autoPick(io, r, p);
            if (p.snapLater && t - p.lastSnap >= BK.snapGap) sendSnap(io, r, p, "hash");
          }
        }
        if ((r.status === "playing" || r.status === "prep") && t - (r.lastFlush || 0) >= (isBig(r) ? BK.tickBig : BK.tickSmall)) { r.lastFlush = t; flush(io, r); }
      } catch (e) { console.error("[brk] tick", e); }
    }
  }, 50);
  ticker.unref?.();
}

function delRoom(io, r, reason) {
  if (r.emptyTimer) clearTimeout(r.emptyTimer); if (r.endTimer) clearTimeout(r.endTimer);
  rooms.delete(r.id); invites.delete(r.inviteCode); r.status = "deleted";
  for (const u of [...r.order, ...r.spect.keys()]) if (userRoom.get(u) === r.id) userRoom.delete(u);
  try { HOOKS.unlinkChat?.("dw_bk_" + r.inviteCode); } catch {}
  io.to(chan(r.id)).emit("brk:closed", { reason }); io.in(chan(r.id)).socketsLeave(chan(r.id));
}
function checkEmpty(io, r) {
  if (connectedCount(r) > 0) { if (r.emptyTimer) { clearTimeout(r.emptyTimer); r.emptyTimer = null; } return; }
  if (r.emptyTimer) return;
  r.emptyTimer = setTimeout(() => { r.emptyTimer = null; if (rooms.get(r.id) === r && connectedCount(r) === 0) delRoom(io, r, "EMPTY"); }, BK.emptyTtl);
}
function removeSeat(r, u) { r.players.delete(u); const i = r.order.indexOf(u); if (i >= 0) r.order.splice(i, 1); if (userRoom.get(u) === r.id && !r.spect.has(u)) userRoom.delete(u); }
function pickNewHost(r) { const h = humans(r).find(p => p.connected) || humans(r)[0]; if (h) r.hostUserId = h.id; else { const s = [...r.spect.values()][0]; if (s) r.hostUserId = s.id; } }
function leave(io, r, uid) {
  const s = r.spect.get(uid);
  if (s) { r.spect.delete(uid); if (userRoom.get(uid) === r.id) userRoom.delete(uid); if (s.sockId) io.sockets.sockets.get(s.sockId)?.leave(chan(r.id)); if (!humans(r).length && !r.spect.size) return delRoom(io, r, "EMPTY"); if (r.hostUserId === uid) pickNewHost(r); checkEmpty(io, r); emitRoom(io, r); return; }
  const p = r.players.get(uid); if (!p) return;
  if (r.status === "playing" || r.status === "prep") { p.left = true; p.connected = false; if (userRoom.get(uid) === r.id) userRoom.delete(uid); if (r.status === "playing") markDone(io, r, p, "left"); else if (p.game) p.game.offer = null; }
  else removeSeat(r, uid);
  if (p.sockId) io.sockets.sockets.get(p.sockId)?.leave(chan(r.id));
  io.to(chan(r.id)).emit("brk:notice", { k: "left", name: p.name });
  if (!humans(r).length && !r.spect.size) return delRoom(io, r, "EMPTY");
  if (r.hostUserId === uid) pickNewHost(r);
  checkEnd(io, r); emitRoom(io, r); checkEmpty(io, r);
}
async function profileOf(supa, me, nick) {
  let name = nick, avatar = null;
  if (!me.isGuest) { try { const { data } = await supa.from("profiles").select("nickname, avatar_url").eq("id", me.id).single(); if (data?.nickname && !typedNick(nick)) name = data.nickname; if (data?.avatar_url) avatar = data.avatar_url; } catch {} }
  let n = cleanNick(name, "");
  if (!n || n === "게스트") { let h = 0; for (const ch of String(me.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; n = (me.isGuest ? "게스트" : "플레이어") + String(h % 1000).padStart(3, "0"); }
  return { name: n, avatar };
}
function attach(io, socket, r, rec) {
  if (rec.sockId && rec.sockId !== socket.id) { const old = io.sockets.sockets.get(rec.sockId); if (old) { old.emit("brk:replaced", {}); old.leave(chan(r.id)); } }
  rec.sockId = socket.id; rec.connected = true; rec.dcAt = 0; socket.join(chan(r.id)); userRoom.set(rec.id, r.id); checkEmpty(io, r);
}
const newSeat = (id, name, o = {}) => ({ id, name, avatar: o.avatar || null, isGuest: !!o.isGuest, connected: true, left: false, sockId: o.sockId || null, dcAt: 0, idx: 0, game: null, epoch: 0, done: null, focus: null });

// ---------------- 스트리머 ----------------
function pickTarget(r, how) {
  const al = [...r.players.values()].filter(p => !p.done && p.game?.alive); if (!al.length) return null;
  if (how === "streamer") { const h = r.players.get(r.hostUserId); return h && !h.done ? h : null; }
  const rk = rankOf(r).filter(p => al.includes(p)); if (how === "leader") return rk[0]; if (how === "last") return rk[rk.length - 1];
  return al[Math.floor(Math.random() * al.length)];
}
function receiveDonation(io, r, { platform, donor, amount, test }) {
  const st = r.stream, kind = STREAM_KINDS.find(k => st.rules[k] === amount) || null;
  const rec = { at: now(), platform, donor: cleanDonor(donor), amount, kind, test: !!test, status: "received", note: null, target: null };
  if (!st.on) rec.status = "off";
  else if (!kind) { rec.status = "no_match"; rec.note = "등록되지 않은 금액"; }
  else if (r.status !== "playing") { rec.status = "not_playing"; rec.note = "게임 중이 아니라 적용 안 함"; }
  else {
    const p = pickTarget(r, st.targets[kind] || "streamer");
    if (!p) { rec.status = "skipped"; rec.note = "대상 없음"; }
    else { const res = p.game.stream(kind); rec.status = res.ok ? "applied" : "skipped"; rec.target = p.idx; rec.note = p.name + (res.ok ? "" : " (지금은 효과 없음)"); if (res.ok) { p.epoch++; afterChange(io, r, p); sendSnap(io, r, p, "stream"); } }
  }
  st.log.push(rec); if (st.log.length > 100) st.log.shift();
  io.to(chan(r.id)).emit("brk:donation", { ...rec, label: kind ? STREAM_LABEL[kind] : null }); emitRoom(io, r);
  return rec;
}
function onPlatformDonation(io, r, platform, raw) {
  let data = raw; if (typeof data === "string") { try { data = JSON.parse(data); } catch { return; } }
  if (!data || typeof data !== "object" || rooms.get(r.id) !== r) return;
  let amount = null;
  if (platform === "chzzk") amount = parseAmount(String(data.payAmount ?? "").replace(/[,\s]/g, ""));
  else if (platform === "soop") { const n = Number(data.balloons); amount = Number.isSafeInteger(n) && n > 0 ? parseAmount(n * SOOP_BALLOON_KRW) : null; }
  else if (platform === "cime") { const beam = Number(String(data.payAmountNumber ?? data.payAmount ?? "").replace(/[,\s]/g, "")); amount = Number.isSafeInteger(beam) ? parseAmount(beam) : null; }
  if (amount === null) return;
  const t = now(), st = r.stream, base = [platform, data.channelId || "", data.donatorChannelId || "anon", amount, String(data.donationText || "").slice(0, 60)].join("|");
  if (platform !== "soop") { const prev = st.recent.get(base); if (prev != null && t - prev < 3000) return; st.recent.set(base, t); if (st.recent.size > 300) for (const [k, v] of st.recent) if (t - v > 3000) st.recent.delete(k); }
  receiveDonation(io, r, { platform, donor: data.donatorNickname || "익명 후원자", amount, test: false });
}

// ---------------- 등록 ----------------
export function registerBrick(io, supabaseAdmin, hooks = {}) {
  HOOKS = hooks; ensureTicker(io);
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const myRoom = () => { const id = userRoom.get(me.id); const r = id ? rooms.get(id) : null; return r && (r.players.has(me.id) || r.spect.has(me.id)) ? r : null; };
    const guard = (fn) => (payload, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      const fail = (e) => { console.error("[brk]", e); try { reply({ ok: false, error: "INTERNAL" }); } catch {} };
      try { const x = fn(payload && typeof payload === "object" ? payload : {}, reply); if (x && typeof x.catch === "function") x.catch(fail); } catch (e) { fail(e); }
    };
    const hostRoom = (cb, o = {}) => {
      const r = myRoom(); if (!r) { cb({ ok: false, error: "NOT_IN_ROOM" }); return null; }
      if (r.hostUserId !== me.id) { cb({ ok: false, error: "NOT_HOST" }); return null; }
      if (!o.allowPlaying && (r.status === "playing" || r.status === "prep")) { cb({ ok: false, error: "GAME_STARTED" }); return null; }
      return r;
    };
    function sendAll(sock, r) {
      const list = rankOf(r).filter(p => p.game).slice(0, isBig(r) ? BK.topViews : 50).map(p => { const v = p.game.view(); v.i = p.idx; return v; });
      if (list.length) sock.emit("brk:views", list);
      sock.emit("brk:tick", { r: r.order.map(u => r.players.get(u)).filter(p => p?.game).map(row), t: now(), full: true });
    }

    socket.on("brk:createRoom", guard(async (pl, cb) => {
      { const f = createFlight("brk", me.id, cb); if (!f) return; cb = f; }
      const old = myRoom(); if (old) leave(io, old, me.id);
      const { name, avatar } = await profileOf(supabaseAdmin, me, pl.nickname);
      const id = `bk_${now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const mp = Math.round(Number(pl.maxPlayers));
      const r = { id, inviteCode: genCode(), hostUserId: me.id, status: "lobby", mode: pl.mode === "classic" ? "classic" : "augment", maxPlayers: mp >= 1 && mp <= BK.maxPlayers ? mp : 8, time: BK.times.includes(Number(pl.time)) ? Number(pl.time) : 300, fair: pl.fair !== false, isPublic: false, players: new Map(), order: [], spect: new Map(), stream: defaultStream(), createdAt: now() };
      rooms.set(id, r); invites.set(r.inviteCode, id);
      const p = newSeat(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id }); r.players.set(me.id, p); r.order.push(me.id);
      attach(io, socket, r, p); cb({ ok: true, code: r.inviteCode, me: me.id, meta: META }); emitRoom(io, r);
    }));
    socket.on("brk:joinRoom", guard(async (pl, cb) => {
      const code = String(pl.code || "").trim(); const r = rooms.get(invites.get(code));
      if (!r) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      const seat = r.players.get(me.id);
      if (seat && !seat.left) { attach(io, socket, r, seat); cb({ ok: true, code: r.inviteCode, me: me.id, meta: META, rejoined: true }); io.to(chan(r.id)).emit("brk:notice", { k: "back", name: seat.name }); emitRoom(io, r); if (seat.game) { sendSnap(io, r, seat, "rejoin"); sendAll(socket, r); } return; }
      const sp = r.spect.get(me.id);
      if (sp) { attach(io, socket, r, sp); cb({ ok: true, code: r.inviteCode, me: me.id, meta: META, spectator: true }); emitRoom(io, r); sendAll(socket, r); return; }
      const old = myRoom(); if (old && old !== r) leave(io, old, me.id);
      const { name, avatar } = await profileOf(supabaseAdmin, me, pl.nickname);
      if (rooms.get(r.id) !== r) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      if (r.players.has(me.id) && !r.players.get(me.id).left) return cb({ ok: true, code: r.inviteCode, me: me.id, meta: META });
      if (pl.watch === true || (r.status !== "lobby" && r.status !== "ended") || r.order.length >= r.maxPlayers || r.players.get(me.id)?.left) {
        if (r.spect.size >= BK.maxSpect) return cb({ ok: false, error: "ROOM_FULL" });
        const s = { id: me.id, name, sockId: socket.id, connected: true, dcAt: 0, focus: null }; r.spect.set(me.id, s); attach(io, socket, r, s);
        cb({ ok: true, code: r.inviteCode, me: me.id, meta: META, spectator: true }); emitRoom(io, r); sendAll(socket, r); return;
      }
      if (r.status === "ended") for (const u of [...r.order]) { const q = r.players.get(u); if (!q || q.left) removeSeat(r, u); }
      const p = newSeat(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id }); r.players.set(me.id, p); r.order.push(me.id); attach(io, socket, r, p);
      cb({ ok: true, code: r.inviteCode, me: me.id, meta: META }); io.to(chan(r.id)).emit("brk:notice", { k: "join", name }); emitRoom(io, r);
    }));
    socket.on("brk:sit", guard((pl, cb) => {
      const r = myRoom(); if (!r || !r.spect.has(me.id)) return cb({ ok: false, error: "NOT_SPECTATOR" });
      if (r.status === "playing" || r.status === "prep") return cb({ ok: false, error: "GAME_STARTED" });
      if (r.order.length >= r.maxPlayers) return cb({ ok: false, error: "ROOM_FULL" });
      const s = r.spect.get(me.id); r.spect.delete(me.id); r.players.delete(me.id);
      const p = newSeat(me.id, s.name, { isGuest: me.isGuest, sockId: socket.id }); r.players.set(me.id, p); r.order.push(me.id);
      if (!humans(r).some(h => h.id === r.hostUserId)) r.hostUserId = me.id;
      attach(io, socket, r, p); cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("brk:toWatch", guard((pl, cb) => {
      const r = myRoom(); if (!r || !r.players.has(me.id)) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (r.status === "playing" || r.status === "prep") return cb({ ok: false, error: "GAME_STARTED" });
      if (r.hostUserId === me.id) return cb({ ok: false, error: "HOST_CANT_WATCH" });
      const p = r.players.get(me.id); removeSeat(r, me.id); r.spect.set(me.id, { id: me.id, name: p.name, sockId: socket.id, connected: true, dcAt: 0, focus: null }); userRoom.set(me.id, r.id);
      cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("brk:setOpts", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return;
      if (pl.mode === "classic" || pl.mode === "augment") r.mode = pl.mode;
      if (pl.maxPlayers !== undefined) { const n = Math.round(Number(pl.maxPlayers)); if (!(n >= 1 && n <= BK.maxPlayers)) return cb({ ok: false, error: "BAD_VALUE" }); if (n < r.order.length) return cb({ ok: false, error: "BELOW_CURRENT" }); r.maxPlayers = n; }
      if (pl.time !== undefined) { if (!BK.times.includes(Number(pl.time))) return cb({ ok: false, error: "BAD_VALUE" }); r.time = Number(pl.time); }
      if (typeof pl.fair === "boolean") r.fair = pl.fair;
      if (typeof pl.isPublic === "boolean") r.isPublic = pl.isPublic;
      cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("brk:kick", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return;
      const uid = String(pl.uid || ""); if (uid === me.id || (!r.players.has(uid) && !r.spect.has(uid))) return cb({ ok: false, error: "BAD_TARGET" });
      const p = r.players.get(uid) || r.spect.get(uid); if (p.sockId) io.to(p.sockId).emit("brk:kicked", {}); leave(io, r, uid); cb({ ok: true });
    }));
    socket.on("brk:start", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return;
      if (r.status !== "lobby" && r.status !== "ended") return cb({ ok: false, error: "GAME_STARTED" });
      if (r.status === "ended") for (const u of [...r.order]) { const p = r.players.get(u); if (!p || p.left) removeSeat(r, u); }
      if (!r.order.some(u => r.players.get(u)?.connected)) return cb({ ok: false, error: "NEED_1" });
      cb({ ok: true }); startGame(io, r);
    }));
    socket.on("brk:toLobby", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return; if (r.status !== "ended") return cb({ ok: false, error: "NOT_ENDED" });
      for (const u of [...r.order]) { const p = r.players.get(u); if (!p || p.left) removeSeat(r, u); else { p.game = null; p.done = null; } }
      r.status = "lobby"; r.result = null; if (r.endTimer) { clearTimeout(r.endTimer); r.endTimer = null; }
      cb({ ok: true }); emitRoom(io, r);
    }));

    // ---------- 입력 ----------
    // { e: epoch, t0: 시작 틱, xs: [틱마다 패들 목표 x], ev: [[틱 위치, 'L'|'U'|'P'|'R', ...]], h: 끝난 뒤 해시 }
    socket.on("brk:in", guard((pl, cb) => {
      const r = myRoom(); const p = r?.players.get(me.id);
      if (!r || !p || p.left || !p.game) return cb({ ok: false, error: "NOT_PLAYING" });
      if (r.status !== "playing" && r.status !== "prep") return cb({ ok: false, error: "NOT_PLAYING" });
      if (pl.e !== p.epoch) return cb({ ok: true, stale: true });                        // 다시 맞추기 전 기준 → 버림
      if (p.done) return cb({ ok: false, error: "DONE" });
      const g = p.game, xs = Array.isArray(pl.xs) ? pl.xs : [], n = xs.length;
      if (!n || n > BK.maxBatch || !Number.isInteger(pl.t0)) { p.epoch++; sendSnap(io, r, p, "BAD_IN"); return cb({ ok: false, error: "BAD_IN" }); }
      if (pl.t0 !== g.t) { p.epoch++; sendSnap(io, r, p, "GAP"); return cb({ ok: false, error: "GAP" }); }
      // 실제 시간보다 빨리 돌리면 거절 (준비 중엔 고르기 몇 틱만)
      const t = now(), maxT = r.status === "prep" ? 30 : p.baseTick + Math.floor((t - r.startsAt) / (1000 / TPS)) + BK.slackTicks;
      if (g.t + n > maxT) { p.epoch++; sendSnap(io, r, p, "TOO_FAST"); return cb({ ok: false, error: "TOO_FAST" }); }
      if (t > deadlineOf(r) + BK.grace) return cb({ ok: false, error: "DONE" });
      const evs = new Map();
      for (const e of Array.isArray(pl.ev) ? pl.ev.slice(0, 40) : []) { if (!Array.isArray(e) || !Number.isInteger(e[0]) || e[0] < 0 || e[0] >= n) continue; const k = e[1]; if (!["L", "U", "P", "R"].includes(k)) continue; if (r.status === "prep" && (k === "U" || k === "L")) continue; if (!evs.has(e[0])) evs.set(e[0], []); evs.get(e[0]).push([k, String(e[2] ?? "").slice(0, 20), Number(e[3]), Number(e[4])]); }
      if (r.status === "prep" && [...evs.values()].length === 0) return cb({ ok: true }); // 준비 중엔 고르기만
      for (let i = 0; i < n; i++) {
        const x = Number(xs[i]);
        const ev = (evs.get(i) || []).map(e => e[0] === "U" ? ["U", e[1], e[2], e[3]] : e[0] === "P" ? ["P", e[1]] : [e[0]]);
        if (r.status === "prep") { if (ev.length) g.step({ ev }); else continue; }
        else g.step({ x: Number.isFinite(x) ? x : g.pTarget, ev });
        if (!g.alive) break;
      }
      p.lastIn = t;
      afterChange(io, r, p);
      if (Number(pl.h) !== g.hash()) { p.epoch++; p.hashBad = (p.hashBad || 0) + 1; sendSnap(io, r, p, "hash"); return cb({ ok: true, resync: true }); }
      cb({ ok: true, t: g.t });
    }));
    socket.on("brk:focus", guard((pl, cb) => {
      const r = myRoom(); if (!r) return cb({ ok: false });
      const rec = r.players.get(me.id) || r.spect.get(me.id); const i = Number(pl.idx);
      rec.focus = Number.isInteger(i) && i >= 0 && i < BK.maxPlayers ? i : null;
      const q = [...r.players.values()].find(x => x.idx === rec.focus && x.game); if (q) { const v = q.game.view(); v.i = q.idx; socket.emit("brk:views", [v]); }
      cb({ ok: true });
    }));
    socket.on("brk:sync", guard((pl, cb) => { const r = myRoom(); if (!r) return cb({ ok: false, error: "NOT_IN_ROOM", meta: META }); cb({ ok: true, room: pubRoom(r, me.id), meta: META }); const p = r.players.get(me.id); if (p?.game) sendSnap(io, r, p, "sync"); sendAll(socket, r); }));
    socket.on("brk:emote", guard((pl, cb) => {
      const r = myRoom(); const p = r?.players.get(me.id); if (!p) return cb({ ok: false });
      const t = now(); if (t - (p.emoAt || 0) < 1500) return cb({ ok: false, error: "TOO_FAST" }); p.emoAt = t;
      const e = ["👍", "🔥", "😱", "😂", "👏", "💯"][Number(pl.e)]; if (!e) return cb({ ok: false });
      io.to(chan(r.id)).emit("brk:emote", { i: p.idx, e }); cb({ ok: true });
    }));
    // ---------- 스트리머 ----------
    socket.on("brk:stream", guard((pl, cb) => {
      const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; const st = r.stream;
      if (typeof pl.on === "boolean") st.on = pl.on;
      if (st.on) logGameStreamer("brick", r);
      if (pl.rules) { const next = { ...st.rules }; for (const k of STREAM_KINDS) if (pl.rules[k] !== undefined) { const v = parseAmount(Number(pl.rules[k])); if (v === null) return cb({ ok: false, error: "BAD_AMOUNT" }); next[k] = v; } if (new Set(Object.values(next)).size !== STREAM_KINDS.length) return cb({ ok: false, error: "DUP_AMOUNT" }); st.rules = next; }
      if (pl.targets) for (const k of STREAM_KINDS) if (STREAM_TARGETS.includes(pl.targets[k])) st.targets[k] = pl.targets[k];
      cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("brk:testDonation", guard((pl, cb) => {
      const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; if (!r.stream.on) return cb({ ok: false, error: "STREAM_OFF" });
      if (r.lastTest && now() - r.lastTest < 1200) return cb({ ok: false, error: "TOO_FAST" }); r.lastTest = now();
      const amount = parseAmount(Number(pl.amount)); if (amount === null) return cb({ ok: false, error: "BAD_AMOUNT" });
      cb({ ok: true, entry: receiveDonation(io, r, { platform: "test", donor: pl.donor || "테스트 시청자", amount, test: true }) });
    }));
    socket.on("brk:streamLink", guard(async (pl, cb) => {
      const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; if (!HOOKS.linkChat) return cb({ ok: false, error: "NO_LINKER" });
      const st = r.stream, platform = ["chzzk", "cime", "soop"].includes(pl.platform) ? pl.platform : null;
      if (!platform || (platform !== "soop" && !pl.accessToken) || (platform === "soop" && !pl.url)) return cb({ ok: false, error: "BAD_LINK" });
      if (st.link.status === "connecting" && now() - (r.linkAt || 0) < 30000) return cb({ ok: false, error: "BUSY" });
      r.linkAt = now(); st.link = { status: "connecting", platform, nickname: null, donation: false, error: null }; emitRoom(io, r);
      const key = "dw_bk_" + r.inviteCode;
      try {
        const res = await HOOKS.linkChat({ platform, key, accessToken: platform === "soop" ? null : String(pl.accessToken), soopUrl: platform === "soop" ? String(pl.url).slice(0, 200) : null, channelId: pl.channelId ? String(pl.channelId) : null, nickname: pl.nickname ? String(pl.nickname).slice(0, 30) : null, hostUserId: me.id, roomCode: r.inviteCode, contentMode: "brick",
          onDonation: (d) => onPlatformDonation(io, r, platform, d), onChat: () => {},
          onClose: () => { if (rooms.get(r.id) !== r) return; st.link = { ...st.link, status: "error", donation: false, error: "연결이 끊겼어요 (방송 종료 등) — 다시 연결해 주세요" }; emitRoom(io, r); } });
        if (rooms.get(r.id) !== r) { try { HOOKS.unlinkChat?.(key); } catch {} return cb({ ok: false, error: "ROOM_CLOSED" }); }
        st.link = { status: res.ok ? "connected" : "error", platform, nickname: String(res.nickname || pl.nickname || "").slice(0, 30) || null, donation: !!res.donationSubscribed, error: res.ok ? (res.donationSubscribed ? null : (res.donationError || "후원 구독 실패")) : String(res.error || "연결 실패").slice(0, 120) };
      } catch (e) { st.link = { status: "error", platform, nickname: null, donation: false, error: String(e.message || e).slice(0, 120) }; }
      emitRoom(io, r); cb({ ok: st.link.status === "connected", link: st.link });
    }));
    socket.on("brk:streamUnlink", guard((pl, cb) => { const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; try { HOOKS.unlinkChat?.("dw_bk_" + r.inviteCode); } catch {} r.stream.link = { status: "off", platform: null, nickname: null, donation: false, error: null }; emitRoom(io, r); cb({ ok: true }); }));
    socket.on("brk:leaveRoom", guard((pl, cb) => { const r = myRoom(); if (r) leave(io, r, me.id); cb({ ok: true }); }));
    socket.on("disconnect", () => {
      const r = myRoom(); if (!r) return;
      const rec = r.players.get(me.id) || r.spect.get(me.id); if (!rec || rec.sockId !== socket.id) return;
      rec.connected = false; rec.dcAt = now();
      if (r.spect.has(me.id)) { setTimeout(() => { const s = r.spect.get(me.id); if (s && !s.connected && now() - s.dcAt >= BK.lobbyDc - 50) leave(io, r, me.id); }, BK.lobbyDc); checkEmpty(io, r); return; }
      io.to(chan(r.id)).emit("brk:notice", { k: "dc", name: rec.name });
      if (r.status === "lobby" || r.status === "ended") setTimeout(() => { if (rooms.get(r.id) !== r || r.status === "playing" || r.status === "prep") return; const q = r.players.get(me.id); if (q && !q.connected && q.dcAt && now() - q.dcAt >= BK.lobbyDc - 50) leave(io, r, me.id); }, BK.lobbyDc);
      else if (r.hostUserId === me.id) pickNewHost(r);
      checkEmpty(io, r); emitRoom(io, r);
    });
  });
}
const META = { augs: AUGS, rarity: RARITY, kindLabel: KIND_LABEL, synergy: SYNERGY, maxAugs: MAX_AUGS, capsule: CAPSULE, bossName: BOSS_NAME, times: BK.times, maxPlayers: BK.maxPlayers, pickMs: BK.pickMs, streamKinds: STREAM_KINDS, streamLabel: STREAM_LABEL, streamTargets: STREAM_TARGETS };
addPublicList("brick", () => { const out = []; for (const r of rooms.values()) { if (!r.isPublic || r.status !== "lobby") continue; const n = r.order.length; if (n >= r.maxPlayers) continue; out.push({ code: r.inviteCode, host: r.players.get(r.hostUserId)?.name || "", n, max: r.maxPlayers }); } return out; }, { lobbyOf: (uid) => { for (const r of rooms.values()) if (r.hostUserId === uid && r.status === "lobby") return r; return null; } });
export const _brkTest = { rooms, invites, userRoom, BK };
