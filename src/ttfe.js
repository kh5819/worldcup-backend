// =========================
// DUO 증강 2048 — 방·소켓 (2026-11-18)  이벤트 prefix 'ttfe:*'
// · 1~50인, 각자 자기 판으로 같은 제한 시간 점수 경쟁 (혼자 방도 가능), 일반 / 증강 모드, 게스트 가능
// · 서버 권위: 화면이 보낸 조작(이동·증강 고르기·증강 사용)을 같은 엔진(ttfe-core.js)으로 다시 돌림
//   → 점수·타일·증강 효과·난수는 서버 계산이 정답. 해시가 다르면 서버 판(snap)으로 다시 맞춤
// · 증강 고르기는 각자 따로(내 판만 멈춤, 15초 지나면 첫 카드). 시작 증강은 시작 전 준비 시간에 모두 같이
// · 죽은 사람(더 못 움직임)·시간 끝난 사람에게는 증강 카드가 뜨지 않음 (엔진 offerIfDue + 서버 확인)
// · 관전(게임 중 입장·꽉 찬 방, 아무 판이나 크게 보기), 재접속(같은 아이디면 판·점수·증강·남은 시간 그대로)
// · 스트리머 모드: 방장이 켠 방에서만 후원 효과(정확한 금액만), 서버가 대상·조건 확인. admin 기록 contentMode "ttfe"
// =========================
import { createFlight } from "./create-flight.js";
import { logGameStreamer } from "./stream-log.js"; // 스트리머 모드 켜면 admin 기록 (11-22)
import { typedNick } from "./nick-pref.js"; // 직접 적은 이름 우선 (2026-11-21)
import { addPublicList } from "./public-rooms.js";
import { Game2048, AUGS, AUG, RARITY, KIND_LABEL, SYNERGY, MAX_AUGS, PICK_AT, seedFor } from "./ttfe-core.js";
import { parseAmount, cleanDonor } from "./duowars-stream.js";
import { recordMulti } from "./game-rank.js";

const rooms = new Map(), invites = new Map(), userRoom = new Map();
export const TT = {
  maxPlayers: 50, times: [0, 60, 120, 180, 300, 600], noLimitCap: 30 * 60_000,
  prepAug: 15_000, prepClassic: 3_000, pickMs: 15_000, grace: 1500,
  lobbyDc: 15_000, emptyTtl: 60_000, endedTtl: 10 * 60_000, maxSpect: 60,
  tickSmall: 250, tickBig: 600, bigAt: 13, topBoards: 8,
  bucket: 80, refill: 25, maxBatch: 60, snapGap: 250, // 순간 80개(망이 잠깐 막혔다 풀릴 때), 계속은 1초 25개
};
const SOOP_BALLOON_KRW = 100;
export const STREAM_KINDS = ["gift", "frenzy", "clean", "time", "junk"];
const STREAM_LABEL = { gift: "🎴 랜덤 증강", frenzy: "🔥 합성 폭주 10이동", clean: "🧹 작은 타일 3개 정리", time: "⏱️ 시간 +15초", junk: "🧱 방해 타일 2개" };
const STREAM_TARGETS = ["streamer", "random", "leader", "last"];
let HOOKS = {};

const chan = (id) => `ttfe:${id}`;
const now = () => Date.now();
const MAX_NICK = 12;
const cleanNick = (s, d) => String(s || "").replace(/[\u0000-\u001f​-‏‪-‮⁠-⁯﻿]/g, "").trim().slice(0, MAX_NICK) || d;
function genCode() { for (let i = 0; i < 50; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!invites.has(c)) return c; } return String(Math.floor(Math.random() * 1e7)).padStart(7, "0"); }
const STATUS = { null: 0, dead: 1, time: 2, left: 3 };
const defaultStream = () => ({ on: false, rules: { gift: 5000, frenzy: 1000, clean: 2000, time: 3000, junk: 1500 }, targets: { gift: "streamer", frenzy: "streamer", clean: "streamer", time: "streamer", junk: "leader" }, link: { status: "off", platform: null, nickname: null, donation: false, error: null }, log: [], recent: new Map() });

const humans = (r) => [...r.players.values()].filter(p => !p.left);
const connectedCount = (r) => humans(r).filter(p => p.connected).length + [...r.spect.values()].filter(s => s.connected).length;
// 준비 단계(시작 증강 고르기)엔 아직 시계가 안 돎 → 끝 시간 없음
const deadlineOf = (r, p) => r.status !== "playing" ? Infinity : r.endsAt ? r.endsAt + ((p.game?.timeBonus || 0) + (p.game?.streamTime || 0)) * 1000 : (r.hardEnd || Infinity);
const isBig = (r) => r.order.length >= TT.bigAt;

// ---------------- 보내기 ----------------
function pubRoom(r, viewer) {
  const host = viewer === r.hostUserId, st = r.stream;
  const spectator = !r.players.has(viewer) || !!r.players.get(viewer)?.left;
  return {
    id: r.id, code: r.inviteCode, hostId: r.hostUserId, status: r.status, me: viewer, spectator,
    opts: { mode: r.mode, maxPlayers: r.maxPlayers, time: r.time, fair: r.fair, isPublic: !!r.isPublic },
    seats: r.order.map(u => { const p = r.players.get(u); return { id: p.id, idx: p.idx, name: p.name, avatar: p.avatar, isGuest: p.isGuest, connected: p.connected, left: !!p.left }; }),
    spectators: r.spect.size,
    prepEnd: r.prepEnd || 0, startsAt: r.startsAt || 0, endsAt: r.endsAt || 0, hardEnd: r.hardEnd || 0,
    result: r.status === "ended" ? r.result : null,
    stream: st.on ? { on: true, rules: st.rules, targets: st.targets, labels: STREAM_LABEL, link: host ? st.link : { status: st.link.status, platform: st.link.platform }, log: st.log.slice(-10) } : { on: false },
    serverNow: now(),
  };
}
function emitRoom(io, r) {
  for (const p of r.players.values()) if (!p.left && p.sockId) io.to(p.sockId).emit("ttfe:room", pubRoom(r, p.id));
  for (const s of r.spect.values()) if (s.sockId) io.to(s.sockId).emit("ttfe:room", pubRoom(r, s.id));
}
function sendSnap(io, r, p, why = "") {
  if (!p.sockId || !p.game) return;
  const t = now(); if (why === "hash" && t - (p.lastSnap || 0) < TT.snapGap) { p.snapLater = true; return; }
  p.lastSnap = t; p.snapLater = false;
  io.to(p.sockId).emit("ttfe:snap", { seq: p.seq, epoch: p.epoch, st: p.game.save(), done: p.done, deadline: deadlineOf(r, p), pickUntil: p.pickUntil || 0, why, serverNow: t });
}
const row = (r, p) => [p.idx, p.game?.score || 0, p.game?.maxTile || 0, p.done ? STATUS[p.done] : (p.game?.offer ? 4 : 0), p.game?.augs.length || 0, p.game?.moves || 0, p.connected ? 1 : 0];
function rankOf(r) {
  return r.order.map(u => r.players.get(u)).filter(Boolean).sort((a, b) => (b.game?.score || 0) - (a.game?.score || 0) || (b.game?.maxTile || 0) - (a.game?.maxTile || 0) || (a.game?.moves || 0) - (b.game?.moves || 0) || a.idx - b.idx);
}
function feed(io, r, ev) { io.to(chan(r.id)).emit("ttfe:feed", { ...ev, t: now() }); }

function flush(io, r) {
  if (r.status !== "playing" && r.status !== "prep") return;
  const rows = [], dirty = [];
  for (const p of r.players.values()) { if (p.dirtyRow) { rows.push(row(r, p)); p.dirtyRow = false; } if (p.dirtyBoard) { dirty.push(p); p.dirtyBoard = false; } }
  if (rows.length) io.to(chan(r.id)).emit("ttfe:tick", { r: rows, t: now() });
  // 역전 하이라이트
  const rk = rankOf(r), lead = rk[0];
  if (lead && (lead.game?.score || 0) > 0 && r.leadIdx !== lead.idx) { const tn = Date.now(); if (r.leadIdx != null && tn - (r.leadAt || 0) > 8000) { feed(io, r, { k: "lead", i: lead.idx, prev: r.leadIdx, score: lead.game.score }); r.leadAt = tn; } r.leadIdx = lead.idx; } // 역전 알림은 8초에 한 번까지 (점수가 비슷하면 계속 뒤집혀서)
  if (!dirty.length) return;
  const pack = (p) => [p.idx, p.game.board(), p.game.augs.map(a => a.id).join(","), p.game.buffs.god > 0 ? 3 : p.game.buffs.frenzy > 0 ? 2 : 0];
  if (!isBig(r)) { io.to(chan(r.id)).emit("ttfe:boards", dirty.map(pack)); return; }
  // 큰 방: 상위 8명 판만 모두에게, 나머지는 크게 보고 있는 사람에게만
  const top = new Set(rk.slice(0, TT.topBoards).map(p => p.idx));
  const pub = dirty.filter(p => top.has(p.idx)); if (pub.length) io.to(chan(r.id)).emit("ttfe:boards", pub.map(pack));
  const byIdx = new Map(dirty.map(p => [p.idx, p]));
  for (const w of [...r.players.values(), ...r.spect.values()]) {
    if (!w.sockId || w.focus == null || top.has(w.focus)) continue;
    const q = byIdx.get(w.focus); if (q) io.to(w.sockId).emit("ttfe:boards", [pack(q)]);
  }
}

// ---------------- 진행 ----------------
function startGame(io, r) {
  for (const u of [...r.order]) { const p = r.players.get(u); if (!p || p.left || !p.connected) removeSeat(r, u); }
  if (!r.order.length) return;
  r.seed = (Math.random() * 2 ** 32) >>> 0; r.result = null; r.leadIdx = null;
  r.order.forEach((u, i) => {
    const p = r.players.get(u); p.idx = i;
    const s = seedFor(r.seed, i, r.fair);
    p.game = new Game2048({ seed: s, augSeed: seedFor(r.seed ^ 0x5bd1e995, i, r.fair), mode: r.mode, timed: r.time > 0 });
    p.seq = 0; p.epoch = (p.epoch || 0) + 1; p.fresh = true; p.done = null; p.doneAt = 0; p.pickUntil = 0; p.bucket = TT.bucket; p.bucketAt = now(); p.dirtyRow = true; p.dirtyBoard = true; p.focus = null; p.feedSeen = 0;
  });
  r.status = "prep"; r.prepEnd = now() + (r.mode === "augment" ? TT.prepAug : TT.prepClassic);
  r.startsAt = 0; r.endsAt = 0; r.hardEnd = 0;
  if (r.endTimer) { clearTimeout(r.endTimer); r.endTimer = null; }
  io.to(chan(r.id)).emit("ttfe:start", { mode: r.mode });
  for (const p of r.players.values()) sendSnap(io, r, p, "start");
  emitRoom(io, r);
}
function beginPlay(io, r) {
  // 시작 증강을 못 고른 사람은 첫 카드
  for (const p of r.players.values()) if (p.game?.offer && !p.done) { autoPick(io, r, p, true); }
  r.status = "playing"; r.startsAt = now();
  r.endsAt = r.time > 0 ? r.startsAt + r.time * 1000 : 0;
  r.hardEnd = r.time > 0 ? 0 : r.startsAt + TT.noLimitCap;
  for (const p of r.players.values()) { p.lastOp = now(); if (p.left) markDone(io, r, p, "left"); else sendSnap(io, r, p, "go"); }
  io.to(chan(r.id)).emit("ttfe:go", { startsAt: r.startsAt, endsAt: r.endsAt, hardEnd: r.hardEnd });
  emitRoom(io, r);
}
function autoPick(io, r, p, silent) {
  const g = p.game; if (!g?.offer) return;
  g.pick(g.offer[0]); p.epoch++; p.fresh = true; p.pickUntil = g.offer ? now() + TT.pickMs : 0;
  afterChange(io, r, p, g.fx);
  if (!silent) sendSnap(io, r, p, "autopick");
}
function markDone(io, r, p, why) {
  if (p.done) return;
  p.done = why; p.doneAt = now(); p.dirtyRow = true; p.dirtyBoard = true;
  if (p.game) p.game.offer = null; // 끝난 사람은 증강 카드 없음
  p.pickUntil = 0;
  if (why === "dead") feed(io, r, { k: "dead", i: p.idx, score: p.game?.score || 0 });
  if (why !== "left") sendSnap(io, r, p, "done");
  checkEnd(io, r);
}
function checkEnd(io, r) {
  if (r.status !== "playing") return;
  if ([...r.players.values()].every(p => p.done)) finish(io, r, "ALL_DONE");
}
function finish(io, r, reason) {
  if (r.status === "ended") return;
  for (const p of r.players.values()) if (!p.done) { p.done = "time"; p.doneAt = now(); if (p.game) p.game.offer = null; }
  flush(io, r);
  r.status = "ended"; r.endedAt = now();
  const rk = rankOf(r);
  r.result = { reason, rows: rk.map((p, i) => ({ place: i + 1, idx: p.idx, id: p.id, name: p.name, avatar: p.avatar, score: p.game?.score || 0, max: p.game?.maxTile || 0, moves: p.game?.moves || 0, merges: p.game?.merges || 0, augs: p.game?.augs.map(a => a.id) || [], done: p.done, won: !!p.game?.won })) };
  io.to(chan(r.id)).emit("ttfe:end", r.result);
  recordMulti("ttfe", r.mode, r.time, [...r.players.values()].filter(p => p.game).map(p => ({ id: p.id, isGuest: p.isGuest, name: p.name, score: p.game.score, max: p.game.maxTile, moves: p.game.moves, augs: p.game.augs.map(a => a.id) }))); // 랭킹 (회원+게스트)
  emitRoom(io, r);
  if (r.endTimer) clearTimeout(r.endTimer);
  r.endTimer = setTimeout(() => { if (rooms.get(r.id) === r && r.status === "ended") delRoom(io, r, "ENDED_TTL"); }, TT.endedTtl);
}
/** 조작 뒤 공통: 고르기 시간, 끝남, 알림 */
function afterChange(io, r, p, fx = []) {
  const g = p.game; p.dirtyRow = true; p.dirtyBoard = true;
  if (g.offer && !p.pickUntil) p.pickUntil = now() + TT.pickMs;
  if (!g.offer) p.pickUntil = 0;
  for (const f of fx || []) {
    if (f.k === "rescue") feed(io, r, { k: "rescue", i: p.idx, id: f.id });
    else if (f.k === "win") feed(io, r, { k: "win", i: p.idx });
    else if (f.k === "use" && (AUG[f.id]?.rarity === "legendary" || AUG[f.id]?.rarity === "epic")) feed(io, r, { k: "use", i: p.idx, id: f.id });
    else if (f.k === "got" && AUG[f.id]?.rarity === "legendary") feed(io, r, { k: "got", i: p.idx, id: f.id });
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
        if (r.status === "prep") {
          const allPicked = [...r.players.values()].every(p => p.left || !p.game?.offer);
          if (t >= r.prepEnd || (allPicked && r.mode === "augment" && t >= r.prepEnd - TT.prepAug + 1500)) beginPlay(io, r);
        }
        if (r.status === "playing") {
          for (const p of r.players.values()) {
            if (p.done) continue;
            if (t > deadlineOf(r, p)) { markDone(io, r, p, "time"); continue; }
            if (!p.connected && p.dcAt && t - p.dcAt > 60_000) { markDone(io, r, p, "left"); continue; } // 1분 넘게 끊기면 지금 점수로 끝
            if (p.game.offer && p.pickUntil && t > p.pickUntil) autoPick(io, r, p);
            if (p.snapLater && t - p.lastSnap >= TT.snapGap) sendSnap(io, r, p, "hash");
          }
        }
        if ((r.status === "playing" || r.status === "prep") && t - (r.lastFlush || 0) >= (isBig(r) ? TT.tickBig : TT.tickSmall)) { r.lastFlush = t; flush(io, r); }
      } catch (e) { console.error("[ttfe] tick", e); }
    }
  }, 100);
  ticker.unref?.();
}

// ---------------- 방 관리 ----------------
function delRoom(io, r, reason) {
  if (r.emptyTimer) clearTimeout(r.emptyTimer); if (r.endTimer) clearTimeout(r.endTimer);
  rooms.delete(r.id); invites.delete(r.inviteCode); r.status = "deleted";
  for (const u of [...r.order, ...r.spect.keys()]) if (userRoom.get(u) === r.id) userRoom.delete(u);
  try { HOOKS.unlinkChat?.("dw_tt_" + r.inviteCode); } catch {}
  io.to(chan(r.id)).emit("ttfe:closed", { reason });
  io.in(chan(r.id)).socketsLeave(chan(r.id));
}
function checkEmpty(io, r) {
  if (connectedCount(r) > 0) { if (r.emptyTimer) { clearTimeout(r.emptyTimer); r.emptyTimer = null; } return; }
  if (r.emptyTimer) return;
  r.emptyTimer = setTimeout(() => { r.emptyTimer = null; if (rooms.get(r.id) === r && connectedCount(r) === 0) delRoom(io, r, "EMPTY"); }, TT.emptyTtl);
}
function removeSeat(r, u) { r.players.delete(u); const i = r.order.indexOf(u); if (i >= 0) r.order.splice(i, 1); if (userRoom.get(u) === r.id && !r.spect.has(u)) userRoom.delete(u); }
function pickNewHost(r) { const h = humans(r).find(p => p.connected) || humans(r)[0]; if (h) r.hostUserId = h.id; else { const s = [...r.spect.values()][0]; if (s) r.hostUserId = s.id; } }
function leave(io, r, uid) {
  const s = r.spect.get(uid);
  if (s) {
    r.spect.delete(uid); if (userRoom.get(uid) === r.id) userRoom.delete(uid);
    if (s.sockId) io.sockets.sockets.get(s.sockId)?.leave(chan(r.id));
    if (!humans(r).length && !r.spect.size) return delRoom(io, r, "EMPTY");
    if (r.hostUserId === uid) pickNewHost(r);
    checkEmpty(io, r); emitRoom(io, r); return;
  }
  const p = r.players.get(uid); if (!p) return;
  if (r.status === "playing" || r.status === "prep") { p.left = true; p.connected = false; if (userRoom.get(uid) === r.id) userRoom.delete(uid); if (r.status === "playing") markDone(io, r, p, "left"); else if (p.game) p.game.offer = null; }
  else removeSeat(r, uid);
  if (p.sockId) io.sockets.sockets.get(p.sockId)?.leave(chan(r.id));
  io.to(chan(r.id)).emit("ttfe:notice", { k: "left", name: p.name });
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
  if (rec.sockId && rec.sockId !== socket.id) { const old = io.sockets.sockets.get(rec.sockId); if (old) { old.emit("ttfe:replaced", {}); old.leave(chan(r.id)); } }
  rec.sockId = socket.id; rec.connected = true; rec.dcAt = 0;
  socket.join(chan(r.id)); userRoom.set(rec.id, r.id); checkEmpty(io, r);
}
const newSeat = (id, name, o = {}) => ({ id, name, avatar: o.avatar || null, isGuest: !!o.isGuest, connected: true, left: false, sockId: o.sockId || null, dcAt: 0, idx: 0, game: null, seq: 0, epoch: 0, done: null, focus: null });

// ---------------- 스트리머: 후원 ----------------
function pickTarget(r, how) {
  const al = [...r.players.values()].filter(p => !p.done && p.game?.alive); if (!al.length) return null;
  if (how === "streamer") { const h = r.players.get(r.hostUserId); return h && !h.done ? h : null; }
  const rk = rankOf(r).filter(p => al.includes(p));
  if (how === "leader") return rk[0]; if (how === "last") return rk[rk.length - 1];
  return al[Math.floor(Math.random() * al.length)];
}
function receiveDonation(io, r, { platform, donor, amount, test }) {
  const st = r.stream;
  const kind = STREAM_KINDS.find(k => st.rules[k] === amount) || null;
  const rec = { at: now(), platform, donor: cleanDonor(donor), amount, kind, test: !!test, status: "received", note: null, target: null };
  if (!st.on) rec.status = "off";
  else if (!kind) { rec.status = "no_match"; rec.note = "등록되지 않은 금액"; }
  else if (r.status !== "playing") { rec.status = "not_playing"; rec.note = "게임 중이 아니라 적용 안 함"; }
  else {
    const p = pickTarget(r, st.targets[kind] || "streamer");
    if (!p) { rec.status = "skipped"; rec.note = "대상 없음 (끝났거나 없음)"; }
    else {
      const res = p.game.stream(kind);
      rec.status = res.ok ? "applied" : "skipped"; rec.target = p.idx; rec.note = `${p.name}${res.note ? " · " + res.note : ""}${res.ok ? "" : " (지금은 효과 없음)"}`;
      if (res.ok) { p.epoch++; p.fresh = true; afterChange(io, r, p, res.fx); sendSnap(io, r, p, "stream"); }
    }
  }
  st.log.push(rec); if (st.log.length > 100) st.log.shift();
  io.to(chan(r.id)).emit("ttfe:donation", { ...rec, label: kind ? STREAM_LABEL[kind] : null });
  emitRoom(io, r);
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
export function registerTtfe(io, supabaseAdmin, hooks = {}) {
  HOOKS = hooks;
  ensureTicker(io);
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const myRoom = () => { const id = userRoom.get(me.id); const r = id ? rooms.get(id) : null; return r && (r.players.has(me.id) || r.spect.has(me.id)) ? r : null; };
    const guard = (fn) => (payload, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      const fail = (e) => { console.error("[ttfe]", e); try { reply({ ok: false, error: "INTERNAL" }); } catch {} };
      try { const x = fn(payload && typeof payload === "object" ? payload : {}, reply); if (x && typeof x.catch === "function") x.catch(fail); } catch (e) { fail(e); }
    };
    const hostRoom = (cb, o = {}) => {
      const r = myRoom();
      if (!r) { cb({ ok: false, error: "NOT_IN_ROOM" }); return null; }
      if (r.hostUserId !== me.id) { cb({ ok: false, error: "NOT_HOST" }); return null; }
      if (!o.allowPlaying && (r.status === "playing" || r.status === "prep")) { cb({ ok: false, error: "GAME_STARTED" }); return null; }
      return r;
    };
    const META = metaOnce();

    socket.on("ttfe:createRoom", guard(async (pl, cb) => {
      { const f = createFlight("ttfe", me.id, cb); if (!f) return; cb = f; }
      const old = myRoom(); if (old) leave(io, old, me.id);
      const { name, avatar } = await profileOf(supabaseAdmin, me, pl.nickname);
      const id = `tt_${now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const mp = Math.round(Number(pl.maxPlayers));
      const r = {
        id, inviteCode: genCode(), hostUserId: me.id, status: "lobby",
        mode: pl.mode === "classic" ? "classic" : "augment", maxPlayers: mp >= 1 && mp <= TT.maxPlayers ? mp : 8,
        time: TT.times.includes(Number(pl.time)) ? Number(pl.time) : 180, fair: pl.fair !== false, isPublic: false,
        players: new Map(), order: [], spect: new Map(), stream: defaultStream(), createdAt: now(),
      };
      rooms.set(id, r); invites.set(r.inviteCode, id);
      const p = newSeat(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id });
      r.players.set(me.id, p); r.order.push(me.id);
      attach(io, socket, r, p);
      cb({ ok: true, code: r.inviteCode, me: me.id, meta: META });
      emitRoom(io, r);
    }));

    socket.on("ttfe:joinRoom", guard(async (pl, cb) => {
      const code = String(pl.code || "").trim();
      const r = rooms.get(invites.get(code));
      if (!r) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      const seat = r.players.get(me.id);
      if (seat && !seat.left) {
        attach(io, socket, r, seat);
        cb({ ok: true, code: r.inviteCode, me: me.id, meta: META, rejoined: true });
        io.to(chan(r.id)).emit("ttfe:notice", { k: "back", name: seat.name });
        emitRoom(io, r); if (seat.game) { sendSnap(io, r, seat, "rejoin"); sendAllBoards(socket, r); }
        return;
      }
      const sp = r.spect.get(me.id);
      if (sp) { attach(io, socket, r, sp); cb({ ok: true, code: r.inviteCode, me: me.id, meta: META, spectator: true }); emitRoom(io, r); sendAllBoards(socket, r); return; }
      const old = myRoom(); if (old && old !== r) leave(io, old, me.id);
      const { name, avatar } = await profileOf(supabaseAdmin, me, pl.nickname);
      if (rooms.get(r.id) !== r) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      if (r.players.has(me.id) && !r.players.get(me.id).left) return cb({ ok: true, code: r.inviteCode, me: me.id, meta: META });
      if (pl.watch === true || r.status !== "lobby" && r.status !== "ended" || r.order.length >= r.maxPlayers || r.players.get(me.id)?.left) {
        if (r.spect.size >= TT.maxSpect) return cb({ ok: false, error: "ROOM_FULL" });
        const s = { id: me.id, name, sockId: socket.id, connected: true, dcAt: 0, focus: null };
        r.spect.set(me.id, s); attach(io, socket, r, s);
        cb({ ok: true, code: r.inviteCode, me: me.id, meta: META, spectator: true });
        emitRoom(io, r); sendAllBoards(socket, r); return;
      }
      if (r.status === "ended") { for (const u of [...r.order]) { const q = r.players.get(u); if (!q || q.left) removeSeat(r, u); } }
      const p = newSeat(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id });
      r.players.set(me.id, p); r.order.push(me.id); attach(io, socket, r, p);
      cb({ ok: true, code: r.inviteCode, me: me.id, meta: META });
      io.to(chan(r.id)).emit("ttfe:notice", { k: "join", name });
      emitRoom(io, r);
    }));
    function sendAllBoards(sock, r) {
      const list = rankOf(r).filter(p => p.game).slice(0, isBig(r) ? TT.topBoards : 50).map(p => [p.idx, p.game.board(), p.game.augs.map(a => a.id).join(","), 0]);
      if (list.length) sock.emit("ttfe:boards", list);
      sock.emit("ttfe:tick", { r: r.order.map(u => r.players.get(u)).filter(p => p?.game).map(p => row(r, p)), t: now(), full: true });
    }

    socket.on("ttfe:sit", guard((pl, cb) => {
      const r = myRoom(); if (!r || !r.spect.has(me.id)) return cb({ ok: false, error: "NOT_SPECTATOR" });
      if (r.status === "playing" || r.status === "prep") return cb({ ok: false, error: "GAME_STARTED" });
      if (r.order.length >= r.maxPlayers) return cb({ ok: false, error: "ROOM_FULL" });
      const s = r.spect.get(me.id); r.spect.delete(me.id); r.players.delete(me.id);
      const p = newSeat(me.id, s.name, { isGuest: me.isGuest, sockId: socket.id }); r.players.set(me.id, p); r.order.push(me.id);
      if (!humans(r).some(h => h.id === r.hostUserId)) r.hostUserId = me.id;
      attach(io, socket, r, p); cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("ttfe:toWatch", guard((pl, cb) => {
      const r = myRoom(); if (!r || !r.players.has(me.id)) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (r.status === "playing" || r.status === "prep") return cb({ ok: false, error: "GAME_STARTED" });
      if (r.hostUserId === me.id) return cb({ ok: false, error: "HOST_CANT_WATCH" });
      const p = r.players.get(me.id); removeSeat(r, me.id);
      r.spect.set(me.id, { id: me.id, name: p.name, sockId: socket.id, connected: true, dcAt: 0, focus: null }); userRoom.set(me.id, r.id);
      cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("ttfe:setOpts", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return;
      if (pl.mode === "classic" || pl.mode === "augment") r.mode = pl.mode;
      if (pl.maxPlayers !== undefined) { const n = Math.round(Number(pl.maxPlayers)); if (!(n >= 1 && n <= TT.maxPlayers)) return cb({ ok: false, error: "BAD_VALUE" }); if (n < r.order.length) return cb({ ok: false, error: "BELOW_CURRENT" }); r.maxPlayers = n; }
      if (pl.time !== undefined) { if (!TT.times.includes(Number(pl.time))) return cb({ ok: false, error: "BAD_VALUE" }); r.time = Number(pl.time); }
      if (typeof pl.fair === "boolean") r.fair = pl.fair;
      if (typeof pl.isPublic === "boolean") r.isPublic = pl.isPublic;
      cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("ttfe:kick", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return;
      const uid = String(pl.uid || ""); if (uid === me.id || (!r.players.has(uid) && !r.spect.has(uid))) return cb({ ok: false, error: "BAD_TARGET" });
      const p = r.players.get(uid) || r.spect.get(uid); if (p.sockId) io.to(p.sockId).emit("ttfe:kicked", {});
      leave(io, r, uid); cb({ ok: true });
    }));
    socket.on("ttfe:start", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return;
      if (r.status !== "lobby" && r.status !== "ended") return cb({ ok: false, error: "GAME_STARTED" });
      if (r.status === "ended") for (const u of [...r.order]) { const p = r.players.get(u); if (!p || p.left) removeSeat(r, u); }
      if (!r.order.some(u => r.players.get(u)?.connected)) return cb({ ok: false, error: "NEED_1" });
      cb({ ok: true }); startGame(io, r);
    }));
    socket.on("ttfe:toLobby", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return;
      if (r.status !== "ended") return cb({ ok: false, error: "NOT_ENDED" });
      for (const u of [...r.order]) { const p = r.players.get(u); if (!p || p.left) removeSeat(r, u); else { p.game = null; p.done = null; } }
      r.status = "lobby"; r.result = null; if (r.endTimer) { clearTimeout(r.endTimer); r.endTimer = null; }
      cb({ ok: true }); emitRoom(io, r);
    }));

    // ---------- 게임 조작 ----------
    // { ops: [[seq, epoch, hash, op], ...] } — 순서대로 서버가 다시 실행. 해시가 다르면 snap
    socket.on("ttfe:ops", guard((pl, cb) => {
      const r = myRoom(); const p = r?.players.get(me.id);
      if (!r || !p || p.left || !p.game) return cb({ ok: false, error: "NOT_PLAYING" });
      if (r.status !== "playing" && r.status !== "prep") return cb({ ok: false, error: "NOT_PLAYING" });
      const list = Array.isArray(pl.ops) ? pl.ops.slice(0, TT.maxBatch) : [];
      const t = now();
      p.bucket = Math.min(TT.bucket, p.bucket + (t - p.bucketAt) / 1000 * TT.refill); p.bucketAt = t;
      let bad = null; const fxAll = [];
      for (const item of list) {
        if (!Array.isArray(item)) { bad = bad || "BAD_OP"; break; }
        const [seq, epoch, h, op] = item;
        if (!Number.isInteger(seq) || seq <= p.seq) continue;                  // 이미 받은 것(재전송)
        if (epoch === p.epoch) {
          if (seq !== p.seq + 1 && !p.fresh) { bad = bad || "GAP"; break; }    // 중간이 빠짐
          p.fresh = false;
        }
        p.seq = seq;                                                          // 번호는 소비
        if (epoch !== p.epoch) continue;                                      // 다시 맞추기 전 판 기준 조작 → 버림
        if (p.done) continue;
        if (t > deadlineOf(r, p) + TT.grace) { markDone(io, r, p, "time"); continue; }
        let why = null;
        if (p.bucket < 1) why = "TOO_FAST";
        else if (!Array.isArray(op) || !["m", "p", "r", "u"].includes(op[0])) why = "BAD_OP";
        else if (r.status === "prep" && (op[0] === "m" || op[0] === "u")) why = "NOT_YET";
        if (!why) {
          p.bucket -= 1;
          const res = p.game.apply(op.slice(0, 4));
          if (res.ok) { p.lastOp = t; fxAll.push(...(res.fx || [])); }
          if (!res.ok) why = res.error || "BAD_OP"; else if (Number(h) !== p.game.hash()) why = "HASH";
        }
        if (why) { bad = bad || why; p.epoch++; p.fresh = true; }                // 이후 조작(옛 판 기준)은 모두 버려짐
        if (!p.game.alive) break;
      }
      afterChange(io, r, p, fxAll);
      if (bad === "GAP") { p.epoch++; p.fresh = true; }
      if (bad) sendSnap(io, r, p, bad === "HASH" ? "hash" : bad);
      cb({ ok: true, seq: p.seq });
    }));
    // 크게 볼 판 (관전·끝난 사람·큰 방)
    socket.on("ttfe:focus", guard((pl, cb) => {
      const r = myRoom(); if (!r) return cb({ ok: false });
      const rec = r.players.get(me.id) || r.spect.get(me.id); const i = Number(pl.idx);
      rec.focus = Number.isInteger(i) && i >= 0 && i < TT.maxPlayers ? i : null;
      const q = [...r.players.values()].find(x => x.idx === rec.focus && x.game);
      if (q) socket.emit("ttfe:boards", [[q.idx, q.game.board(), q.game.augs.map(a => a.id).join(","), 0]]);
      cb({ ok: true });
    }));
    socket.on("ttfe:sync", guard((pl, cb) => {
      const r = myRoom(); if (!r) return cb({ ok: false, error: "NOT_IN_ROOM", meta: META });
      cb({ ok: true, room: pubRoom(r, me.id), meta: META });
      const p = r.players.get(me.id); if (p?.game) sendSnap(io, r, p, "sync"); sendAllBoards(socket, r);
    }));
    socket.on("ttfe:emote", guard((pl, cb) => {
      const r = myRoom(); const p = r?.players.get(me.id); if (!p) return cb({ ok: false });
      const t = now(); if (t - (p.emoAt || 0) < 1500) return cb({ ok: false, error: "TOO_FAST" }); p.emoAt = t;
      const e = ["👍", "🔥", "😱", "😂", "👏", "💯"][Number(pl.e)] ; if (!e) return cb({ ok: false });
      io.to(chan(r.id)).emit("ttfe:emote", { i: p.idx, e }); cb({ ok: true });
    }));

    // ---------- 스트리머 모드 (방장) ----------
    socket.on("ttfe:stream", guard((pl, cb) => {
      const r = hostRoom(cb, { allowPlaying: true }); if (!r) return;
      const st = r.stream;
      if (typeof pl.on === "boolean") st.on = pl.on;
      if (st.on) logGameStreamer("ttfe", r);
      if (pl.rules) {
        const next = { ...st.rules };
        for (const k of STREAM_KINDS) if (pl.rules[k] !== undefined) { const v = parseAmount(Number(pl.rules[k])); if (v === null) return cb({ ok: false, error: "BAD_AMOUNT" }); next[k] = v; }
        if (new Set(Object.values(next)).size !== STREAM_KINDS.length) return cb({ ok: false, error: "DUP_AMOUNT" });
        st.rules = next;
      }
      if (pl.targets) for (const k of STREAM_KINDS) if (STREAM_TARGETS.includes(pl.targets[k])) st.targets[k] = pl.targets[k];
      cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("ttfe:testDonation", guard((pl, cb) => {
      const r = hostRoom(cb, { allowPlaying: true }); if (!r) return;
      if (!r.stream.on) return cb({ ok: false, error: "STREAM_OFF" });
      if (r.lastTest && now() - r.lastTest < 1200) return cb({ ok: false, error: "TOO_FAST" }); r.lastTest = now();
      const amount = parseAmount(Number(pl.amount)); if (amount === null) return cb({ ok: false, error: "BAD_AMOUNT" });
      cb({ ok: true, entry: receiveDonation(io, r, { platform: "test", donor: pl.donor || "테스트 시청자", amount, test: true }) });
    }));
    socket.on("ttfe:streamLink", guard(async (pl, cb) => {
      const r = hostRoom(cb, { allowPlaying: true }); if (!r) return;
      if (!HOOKS.linkChat) return cb({ ok: false, error: "NO_LINKER" });
      const st = r.stream;
      const platform = ["chzzk", "cime", "soop"].includes(pl.platform) ? pl.platform : null;
      if (!platform || (platform !== "soop" && !pl.accessToken) || (platform === "soop" && !pl.url)) return cb({ ok: false, error: "BAD_LINK" });
      if (st.link.status === "connecting" && now() - (r.linkAt || 0) < 30000) return cb({ ok: false, error: "BUSY" });
      r.linkAt = now(); st.link = { status: "connecting", platform, nickname: null, donation: false, error: null }; emitRoom(io, r);
      const key = "dw_tt_" + r.inviteCode;
      try {
        const res = await HOOKS.linkChat({ platform, key, accessToken: platform === "soop" ? null : String(pl.accessToken), soopUrl: platform === "soop" ? String(pl.url).slice(0, 200) : null, channelId: pl.channelId ? String(pl.channelId) : null, nickname: pl.nickname ? String(pl.nickname).slice(0, 30) : null, hostUserId: me.id, roomCode: r.inviteCode, contentMode: "ttfe",
          onDonation: (d) => onPlatformDonation(io, r, platform, d), onChat: () => {},
          onClose: () => { if (rooms.get(r.id) !== r) return; st.link = { ...st.link, status: "error", donation: false, error: "연결이 끊겼어요 (방송 종료 등) — 다시 연결해 주세요" }; emitRoom(io, r); } });
        if (rooms.get(r.id) !== r) { try { HOOKS.unlinkChat?.(key); } catch {} return cb({ ok: false, error: "ROOM_CLOSED" }); }
        st.link = { status: res.ok ? "connected" : "error", platform, nickname: String(res.nickname || pl.nickname || "").slice(0, 30) || null, donation: !!res.donationSubscribed, error: res.ok ? (res.donationSubscribed ? null : (res.donationError || "후원 구독 실패")) : String(res.error || "연결 실패").slice(0, 120) };
      } catch (e) { st.link = { status: "error", platform, nickname: null, donation: false, error: String(e.message || e).slice(0, 120) }; }
      emitRoom(io, r); cb({ ok: st.link.status === "connected", link: st.link });
    }));
    socket.on("ttfe:streamUnlink", guard((pl, cb) => { const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; try { HOOKS.unlinkChat?.("dw_tt_" + r.inviteCode); } catch {} r.stream.link = { status: "off", platform: null, nickname: null, donation: false, error: null }; emitRoom(io, r); cb({ ok: true }); }));

    socket.on("ttfe:leaveRoom", guard((pl, cb) => { const r = myRoom(); if (r) leave(io, r, me.id); cb({ ok: true }); }));

    socket.on("disconnect", () => {
      const r = myRoom(); if (!r) return;
      const rec = r.players.get(me.id) || r.spect.get(me.id);
      if (!rec || rec.sockId !== socket.id) return;
      rec.connected = false; rec.dcAt = now();
      if (r.spect.has(me.id)) { setTimeout(() => { const s = r.spect.get(me.id); if (s && !s.connected && now() - s.dcAt >= TT.lobbyDc - 50) leave(io, r, me.id); }, TT.lobbyDc); checkEmpty(io, r); return; }
      io.to(chan(r.id)).emit("ttfe:notice", { k: "dc", name: rec.name });
      if (r.status === "lobby" || r.status === "ended") {
        setTimeout(() => { if (rooms.get(r.id) !== r || r.status === "playing" || r.status === "prep") return; const q = r.players.get(me.id); if (q && !q.connected && q.dcAt && now() - q.dcAt >= TT.lobbyDc - 50) leave(io, r, me.id); }, TT.lobbyDc);
      } else { rec.dirtyRow = true; if (r.hostUserId === me.id) pickNewHost(r); }
      checkEmpty(io, r); emitRoom(io, r);
    });
  });
}

let _meta = null;
function metaOnce() {
  if (_meta) return _meta;
  _meta = { augs: AUGS, rarity: RARITY, kindLabel: KIND_LABEL, synergy: SYNERGY, maxAugs: MAX_AUGS, pickAt: PICK_AT, times: TT.times, maxPlayers: TT.maxPlayers, pickMs: TT.pickMs, streamKinds: STREAM_KINDS, streamLabel: STREAM_LABEL, streamTargets: STREAM_TARGETS };
  return _meta;
}
// 공개 방 (게임천국 "지금 열린 공개 방")
addPublicList("ttfe", () => {
  const out = [];
  for (const r of rooms.values()) { if (!r.isPublic || r.status !== "lobby") continue; const n = r.order.length; if (n >= r.maxPlayers) continue; out.push({ code: r.inviteCode, host: r.players.get(r.hostUserId)?.name || "", n, max: r.maxPlayers }); }
  return out;
}, { lobbyOf: (uid) => { for (const r of rooms.values()) if (r.hostUserId === uid && r.status === "lobby") return r; return null; } });
export const _ttfeTest = { rooms, invites, userRoom, TT };
