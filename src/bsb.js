// =========================
// DUO 플듀 베이스볼 — 방·소켓 (2026-11-19)  이벤트 prefix 'bsb:*'
// · 4개 모드: 홈런더비(1~50) · 투수VS타자(2) · 미니 야구(2~8, 팀) · 보스 레이드(1~8), 각각 일반 / 증강
// · 기존 방 흐름 그대로: 게스트 가능, 초대 코드, 관전, 재접속(같은 아이디), 방장 권한, 공개방 목록, 스트리머 후원(치지직·씨미·SOOP)
// · 서버 권위: 투구는 서버가 만들고(투수는 구종·코스·세기만 고름), 스윙은 시각·배트 위치만 받아 서버가 판정·타구·수비·점수 계산
// · 시간: 서버가 공 놓는 시각(rel)을 정하고, 스윙 dt 를 서버가 잰 경과 시간과 비교 — 지연 보정은 300ms까지만
// · 50인 홈런더비: 내 타석은 나에게만, 전체 순위는 0.5초마다 가벼운 표로, 관전 대상만 자세히
// =========================
import { createFlight } from "./create-flight.js";
import { typedNick } from "./nick-pref.js"; // 직접 적은 이름 우선 (2026-11-21)
import { addPublicList } from "./public-rooms.js";
import { parseAmount, cleanDonor } from "./duowars-stream.js";
import { Derby, Match, Raid } from "./bsb-modes.js";
import { AUGS, RARITY, ROLE_LABEL, KIND_LABEL, SYNERGY, MAX_AUGS, PT, PITCH_TYPES, BOSSES, PATS, MODE_MAX, DERBY } from "./bsb-core.js";

const rooms = new Map(), invites = new Map(), userRoom = new Map(), soloIpHits = new Map();
const socketIp = (s) => String(s.handshake.headers["cf-connecting-ip"] || s.handshake.headers["x-forwarded-for"] || s.handshake.address || "").split(",")[0].trim();
export const BB = { lobbyDc: 15_000, emptyTtl: 60_000, endedTtl: 10 * 60_000, maxSpect: 60, tickMs: 20, rowsMs: 500, autoAfter: 8_000, derbyDcEnd: 60_000, inRate: 40, soloPerSock: 30, soloPerIp: 120 };
const GAMES = ["derby", "pvb", "mini", "raid"];
const SOOP_BALLOON_KRW = 100;
export const STREAM_KINDS = ["buff", "debuff", "golden", "event"];
const STREAM_LABEL = { buff: "💪 타자 버프 (5구)", debuff: "🌀 타자 디버프 (5구)", golden: "✨ 황금 공", event: "🎉 특수 이벤트" };
const STREAM_TARGETS = ["streamer", "random", "leader", "last"];
let HOOKS = {};
const chan = (id) => `bsb:${id}`;
const now = () => Date.now();
const MAX_NICK = 12;
const cleanNick = (s, d) => String(s || "").replace(/[\u0000-\u001f​-‏‪-‮⁠-⁯﻿]/g, "").trim().slice(0, MAX_NICK) || d;
function genCode() { for (let i = 0; i < 50; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!invites.has(c)) return c; } return String(Math.floor(Math.random() * 1e7)).padStart(7, "0"); }
const defaultStream = () => ({ on: false, rules: { buff: 1000, debuff: 1100, golden: 3000, event: 5000 }, targets: { buff: "streamer", debuff: "leader", golden: "streamer", event: "streamer" }, link: { status: "off", platform: null, nickname: null, donation: false, error: null }, log: [], recent: new Map() });
const humans = (r) => [...r.players.values()].filter(p => !p.left && !p.ai);
const connectedCount = (r) => humans(r).filter(p => p.connected).length + [...r.spect.values()].filter(s => s.connected).length;
const playing = (r) => r.status === "playing";

// ---------- 방 설정 ----------
function defaultOpts(game) {
  if (game === "derby") return { len: "t120", diff: "normal", fair: true };
  if (game === "pvb") return { innings: 3, ext: true, diff: "normal" };
  if (game === "mini") return { innings: 3, ext: true, rot: "rotate", aiFill: true, diff: "normal" };
  return { boss: "slime", diff: "normal" };
}
function cleanOpts(game, o = {}, base = defaultOpts(game)) {
  const out = { ...base };
  if (["easy", "normal", "hard"].includes(o.diff)) out.diff = o.diff;
  if (game === "derby") { if (["t60", "t120", "t180", "p20", "p30", "practice"].includes(o.len)) out.len = o.len; if (typeof o.fair === "boolean") out.fair = o.fair; }
  if (game === "pvb" || game === "mini") { if ([1, 3, 5].includes(Number(o.innings))) out.innings = Number(o.innings); if (typeof o.ext === "boolean") out.ext = o.ext; }
  if (game === "mini") { if (["rotate", "fixed"].includes(o.rot)) out.rot = o.rot; if (typeof o.aiFill === "boolean") out.aiFill = o.aiFill; }
  if (game === "raid" && BOSSES[o.boss]) out.boss = o.boss;
  return out;
}
function pubRoom(r, viewer) {
  const host = viewer === r.hostUserId, st = r.stream;
  const spectator = !r.players.has(viewer) || !!r.players.get(viewer)?.left;
  return {
    id: r.id, code: r.inviteCode, hostId: r.hostUserId, status: r.status, me: viewer, spectator, solo: !!r.solo,
    game: r.game, mode: r.mode, opts: r.opts, maxPlayers: r.maxPlayers, isPublic: !!r.isPublic,
    seats: r.order.map(u => { const p = r.players.get(u); return { id: p.id, idx: p.idx, name: p.name, avatar: p.avatar, isGuest: p.isGuest, connected: p.connected, left: !!p.left, team: p.team ?? 0, ai: !!p.ai }; }),
    spectators: r.spect.size, result: r.status === "ended" ? r.result : null,
    stream: st.on ? { on: true, rules: st.rules, targets: st.targets, labels: STREAM_LABEL, link: host ? st.link : { status: st.link.status, platform: st.link.platform }, log: st.log.slice(-10) } : { on: false },
    serverNow: now(),
  };
}
function emitRoom(io, r) {
  for (const p of r.players.values()) if (!p.left && !p.ai && p.sockId) io.to(p.sockId).emit("bsb:room", pubRoom(r, p.id));
  for (const s of r.spect.values()) if (s.sockId) io.to(s.sockId).emit("bsb:room", pubRoom(r, s.id));
}
function sendSnap(io, r, uid, sockId) {
  if (!r.G || !sockId) return;
  io.to(sockId).emit("bsb:snap", { snap: r.G.snapshot(uid, now()), serverNow: now() });
  if (r.G.rows) io.to(sockId).emit("bsb:rows", { r: r.G.rows(), t: now() });
}
// 모드 → 소켓 (나에게만 보내는 건 관전 중인 사람에게도)
function makeOut(io, r) {
  return (to, ev, d) => {
    if (rooms.get(r.id) !== r) return;
    if (to === "all") { io.to(chan(r.id)).emit("bsb:" + ev, d); if (ev === "end") onEnd(io, r); return; }
    const p = r.players.get(to); if (p?.sockId && !p.ai) io.to(p.sockId).emit("bsb:" + ev, d);
    if (r.game === "derby" && ["windup", "pitch", "res", "done"].includes(ev)) {
      for (const w of [...r.players.values(), ...r.spect.values()]) if (w.sockId && w.focus === p?.idx && w.id !== to) io.to(w.sockId).emit("bsb:fev", { i: p.idx, ev, d });
    }
  };
}
function onEnd(io, r) {
  r.status = "ended"; r.result = r.G.result; r.endedAt = now();
  emitRoom(io, r);
  if (r.endTimer) clearTimeout(r.endTimer);
  r.endTimer = setTimeout(() => { if (rooms.get(r.id) === r && r.status === "ended") delRoom(io, r, "ENDED_TTL"); }, BB.endedTtl);
}

// ---------- 시작 ----------
function buildSeats(r) {
  for (const u of [...r.order]) { const p = r.players.get(u); if (!p || p.ai || p.left || !p.connected) removeSeat(r, u); }
  const hs = r.order.map(u => r.players.get(u));
  if (r.game === "pvb") {
    if (hs.length === 1) addAi(r, 1);
    const a = r.order.map(u => r.players.get(u)); a[0].team = 0; a[1].team = 1;
  } else if (r.game === "mini") {
    const cnt = [0, 0]; for (const p of hs) cnt[p.team ?? 0]++;
    if (!cnt[0] || !cnt[1] || r.opts.aiFill) { const want = r.solo ? 3 : Math.max(1, Math.min(4, Math.max(cnt[0], cnt[1]))); for (let t = 0; t < 2; t++) while (cnt[t] < want) { addAi(r, t); cnt[t]++; } }
  }
  r.order.forEach((u, i) => { r.players.get(u).idx = i; });
}
let aiSeq = 0;
function addAi(r, team) {
  const id = `ai_${++aiSeq}`, n = [...r.players.values()].filter(p => p.ai).length + 1;
  r.players.set(id, { id, name: `AI ${n}`, avatar: null, isGuest: true, ai: true, connected: true, left: false, sockId: null, team, idx: 0 }); r.order.push(id);
}
function startGame(io, r) {
  for (const u of [...r.order]) { const p = r.players.get(u); if (p?.ai) removeSeat(r, u); }
  buildSeats(r); if (!r.order.length) return;
  r.seed = (Math.random() * 2 ** 32) >>> 0; r.result = null; r.status = "playing";
  const seats = r.order.map(u => { const p = r.players.get(u); return { id: p.id, name: p.name, idx: p.idx, team: p.team ?? 0, ai: !!p.ai, skill: r.opts.diff }; });
  const aug = r.mode === "augment", out = makeOut(io, r), o = r.opts;
  if (r.game === "derby") { const len = o.len; r.G = new Derby({ seats, aug, seed: r.seed, out, opts: { time: len[0] === "t" ? Number(len.slice(1)) : 0, pitches: len[0] === "p" ? Number(len.slice(1)) : 0, practice: len === "practice", diff: o.diff, fair: o.fair } }); }
  else if (r.game === "raid") r.G = new Raid({ seats, aug, seed: r.seed, out, opts: { boss: o.boss, diff: o.diff } });
  else r.G = new Match({ seats, mode: r.game, aug, seed: r.seed, out, opts: { innings: o.innings, ext: o.ext, rot: o.rot, diff: o.diff } });
  for (const p of r.players.values()) { p.focus = null; p.dcAuto = false; }
  if (r.endTimer) { clearTimeout(r.endTimer); r.endTimer = null; }
  io.to(chan(r.id)).emit("bsb:start", { game: r.game, mode: r.mode });
  emitRoom(io, r);
  r.G.start(now());
  for (const p of humans(r)) if (p.sockId) sendSnap(io, r, p.id, p.sockId);
}

let ticker = null;
function ensureTicker(io) {
  if (ticker) return;
  ticker = setInterval(() => {
    const t = now();
    for (const r of rooms.values()) {
      if (!playing(r) || !r.G) continue;
      try {
        // 끊긴 사람: 경기·레이드는 AI가 대신, 홈런더비는 1분 지나면 그 점수로 끝
        for (const p of r.players.values()) {
          if (p.ai || p.left) continue;
          if (!p.connected && p.dcAt) {
            if (r.game !== "derby" && !p.dcAuto && t - p.dcAt > BB.autoAfter) { p.dcAuto = true; r.G.setAuto?.(p.id, true, t); io.to(chan(r.id)).emit("bsb:notice", { k: "auto", name: p.name }); }
            if (r.game === "derby" && t - p.dcAt > BB.derbyDcEnd) { const P = r.G.P.get(p.id); if (P && !P.done) r.G.finishP(P, "left"); }
          }
        }
        r.G.tick(t);
        if (r.G.rows && t - (r.lastRows || 0) >= BB.rowsMs && r.G.status !== "ended") { r.lastRows = t; io.to(chan(r.id)).emit("bsb:rows", { r: r.G.rows(), t }); leadCheck(io, r); }
      } catch (e) { console.error("[bsb] tick", e); }
    }
  }, BB.tickMs);
  ticker.unref?.();
}
function leadCheck(io, r) {
  if (r.game !== "derby" || r.order.length < 2) return;
  const lead = r.G.rankList()[0]; if (!lead || lead.score <= 0) return;
  if (r.leadIdx !== lead.idx) { const t = now(); if (r.leadIdx != null && t - (r.leadAt || 0) > 8000) { io.to(chan(r.id)).emit("bsb:feed", { k: "lead", i: lead.idx, prev: r.leadIdx, score: lead.score }); r.leadAt = t; } r.leadIdx = lead.idx; }
}

// ---------- 방 관리 ----------
function delRoom(io, r, reason) {
  if (r.emptyTimer) clearTimeout(r.emptyTimer); if (r.endTimer) clearTimeout(r.endTimer);
  rooms.delete(r.id); invites.delete(r.inviteCode); r.status = "deleted";
  for (const u of [...r.order, ...r.spect.keys()]) if (userRoom.get(u) === r.id) userRoom.delete(u);
  try { HOOKS.unlinkChat?.("dw_bb_" + r.inviteCode); } catch {}
  io.to(chan(r.id)).emit("bsb:closed", { reason }); io.in(chan(r.id)).socketsLeave(chan(r.id));
}
function checkEmpty(io, r) {
  if (connectedCount(r) > 0) { if (r.emptyTimer) { clearTimeout(r.emptyTimer); r.emptyTimer = null; } return; }
  if (r.emptyTimer) return;
  r.emptyTimer = setTimeout(() => { r.emptyTimer = null; if (rooms.get(r.id) === r && connectedCount(r) === 0) delRoom(io, r, "EMPTY"); }, BB.emptyTtl);
}
function removeSeat(r, u) { r.players.delete(u); const i = r.order.indexOf(u); if (i >= 0) r.order.splice(i, 1); if (userRoom.get(u) === r.id && !r.spect.has(u)) userRoom.delete(u); }
function pickNewHost(r) { const h = humans(r).find(p => p.connected) || humans(r)[0]; if (h) r.hostUserId = h.id; else { const s = [...r.spect.values()][0]; if (s) r.hostUserId = s.id; } }
function leave(io, r, uid) {
  const s = r.spect.get(uid);
  if (s) { r.spect.delete(uid); if (userRoom.get(uid) === r.id) userRoom.delete(uid); if (s.sockId) io.sockets.sockets.get(s.sockId)?.leave(chan(r.id)); if (!humans(r).length && !r.spect.size) return delRoom(io, r, "EMPTY"); if (r.hostUserId === uid) pickNewHost(r); checkEmpty(io, r); emitRoom(io, r); return; }
  const p = r.players.get(uid); if (!p) return;
  if (p.sockId) io.sockets.sockets.get(p.sockId)?.leave(chan(r.id)); // 먼저 방송에서 빼야 나간 사람에게 '끝' 결과가 안 감
  if (playing(r)) { p.left = true; p.connected = false; if (userRoom.get(uid) === r.id) userRoom.delete(uid); r.G?.leave(uid, now()); }
  else removeSeat(r, uid);
  io.to(chan(r.id)).emit("bsb:notice", { k: "left", name: p.name });
  if (!humans(r).length && !r.spect.size) return delRoom(io, r, "EMPTY");
  if (r.hostUserId === uid) pickNewHost(r);
  emitRoom(io, r); checkEmpty(io, r);
}
async function profileOf(supa, me, nick) {
  let name = nick, avatar = null;
  if (!me.isGuest) { try { const { data } = await supa.from("profiles").select("nickname, avatar_url").eq("id", me.id).single(); if (data?.nickname && !typedNick(nick)) name = data.nickname; if (data?.avatar_url) avatar = data.avatar_url; } catch {} }
  let n = cleanNick(name, "");
  if (!n || n === "게스트") { let h = 0; for (const ch of String(me.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; n = (me.isGuest ? "게스트" : "플레이어") + String(h % 1000).padStart(3, "0"); }
  return { name: n, avatar };
}
function attach(io, socket, r, rec) {
  if (rec.sockId && rec.sockId !== socket.id) { const old = io.sockets.sockets.get(rec.sockId); if (old) { old.emit("bsb:replaced", {}); old.leave(chan(r.id)); } }
  rec.sockId = socket.id; rec.connected = true; rec.dcAt = 0; socket.join(chan(r.id)); userRoom.set(rec.id, r.id); checkEmpty(io, r);
  if (rec.dcAuto && r.G && !rec.left) { rec.dcAuto = false; r.G.setAuto?.(rec.id, false, now()); }
}
const newSeat = (id, name, o = {}) => ({ id, name, avatar: o.avatar || null, isGuest: !!o.isGuest, connected: true, left: false, sockId: o.sockId || null, dcAt: 0, idx: 0, team: o.team ?? 0, ai: false, focus: null });
function smallerTeam(r) { const c = [0, 0]; for (const p of r.players.values()) if (!p.ai) c[p.team ?? 0]++; return c[1] < c[0] ? 1 : 0; }

// ---------- 스트리머 ----------
function rankIds(r) {
  const G = r.G; if (!G) return [];
  if (r.game === "derby") return G.rankList().filter(P => !P.done).map(P => P.id);
  if (r.game === "raid") return [...G.P.values()].filter(P => !P.left).sort((a, b) => b.dmg - a.dmg).map(P => P.id);
  return [...G.P.values()].filter(P => !P.left).sort((a, b) => (b.stats.h + b.stats.rbi) - (a.stats.h + a.stats.rbi)).map(P => P.id);
}
function pickTarget(r, how) {
  const list = rankIds(r).filter(id => !r.players.get(id)?.ai); if (!list.length) return null;
  if (how === "streamer") return list.includes(r.hostUserId) ? r.hostUserId : null;
  if (how === "leader") return list[0]; if (how === "last") return list[list.length - 1];
  return list[Math.floor(Math.random() * list.length)];
}
function receiveDonation(io, r, { platform, donor, amount, test }) {
  const st = r.stream, kind = STREAM_KINDS.find(k => st.rules[k] === amount) || null;
  const rec = { at: now(), platform, donor: cleanDonor(donor), amount, kind, test: !!test, status: "received", note: null, target: null };
  if (!st.on) rec.status = "off";
  else if (!kind) { rec.status = "no_match"; rec.note = "등록되지 않은 금액"; }
  else if (!playing(r) || r.G?.status !== "play") { rec.status = "not_playing"; rec.note = "게임 중이 아니라 적용 안 함"; }
  else {
    // 같은 효과는 2초에 한 번까지 (도배로 경기를 멈추게 못 하게)
    const last = st.lastKind?.[kind] || 0; st.lastKind = st.lastKind || {};
    if (now() - last < 2000) { rec.status = "skipped"; rec.note = "너무 잦아요 (2초 뒤 다시)"; }
    else {
      const uid = kind === "event" && r.game === "raid" ? (r.order[0]) : pickTarget(r, st.targets[kind] || "streamer");
      if (!uid) { rec.status = "skipped"; rec.note = "대상 없음"; }
      else { const res = r.G.stream(kind, uid, now()); const p = r.players.get(uid); rec.status = res?.ok ? "applied" : "skipped"; rec.target = p?.idx ?? null; rec.note = (p?.name || "") + (res?.ok ? "" : " (지금은 효과 없음)"); if (res?.ok) st.lastKind[kind] = now(); }
    }
  }
  st.log.push(rec); if (st.log.length > 100) st.log.shift();
  io.to(chan(r.id)).emit("bsb:donation", { ...rec, label: kind ? STREAM_LABEL[kind] : null }); emitRoom(io, r);
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

// ---------- 등록 ----------
export function registerBaseball(io, supabaseAdmin, hooks = {}) {
  HOOKS = hooks; ensureTicker(io);
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const myRoom = () => { const id = userRoom.get(me.id); const r = id ? rooms.get(id) : null; return r && (r.players.has(me.id) || r.spect.has(me.id)) ? r : null; };
    let inCount = 0, inWin = 0;
    const guard = (fn, o = {}) => (payload, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      if (o.game) { const t = now(); if (t - inWin > 1000) { inWin = t; inCount = 0; } if (++inCount > BB.inRate) return reply({ ok: false, error: "TOO_FAST" }); }
      const fail = (e) => { console.error("[bsb]", e); try { reply({ ok: false, error: "INTERNAL" }); } catch {} };
      try { const x = fn(payload && typeof payload === "object" ? payload : {}, reply); if (x && typeof x.catch === "function") x.catch(fail); } catch (e) { fail(e); }
    };
    const hostRoom = (cb, o = {}) => {
      const r = myRoom(); if (!r) { cb({ ok: false, error: "NOT_IN_ROOM" }); return null; }
      if (r.hostUserId !== me.id) { cb({ ok: false, error: "NOT_HOST" }); return null; }
      if (!o.allowPlaying && playing(r)) { cb({ ok: false, error: "GAME_STARTED" }); return null; }
      return r;
    };
    socket.on("bsb:ping", guard((pl, cb) => cb({ ok: true, s: now(), c: pl.c })));
    // 혼자 하기: 공용 '방 만들기 제한'(게스트 IP당 10분 10개) 대신 베이스볼 자체 제한 — 혼자 판을 여러 번 새로 시작해도 막히지 않게
    let soloHits = [];
    socket.on("bsb:solo", guard(async (pl, cb) => {
      const t = now(); soloHits = soloHits.filter(x => t - x < 600_000);
      const ip = socketIp(socket), ipArr = (soloIpHits.get(ip) || []).filter(x => t - x < 600_000);
      if (soloHits.length >= BB.soloPerSock || ipArr.length >= BB.soloPerIp) return cb({ ok: false, error: "RATE_LIMITED" });
      soloHits.push(t); ipArr.push(t); soloIpHits.set(ip, ipArr); if (soloIpHits.size > 20000) soloIpHits.clear();
      return create({ ...pl, solo: true }, cb);
    }));
    socket.on("bsb:createRoom", guard((pl, cb) => create({ ...pl, solo: false }, cb)));
    const create = async (pl, cb) => {
      { const f = createFlight("bsb", me.id, cb); if (!f) return; cb = f; }
      const old = myRoom(); if (old) leave(io, old, me.id);
      const { name, avatar } = await profileOf(supabaseAdmin, me, pl.nickname);
      const game = GAMES.includes(pl.game) ? pl.game : "derby";
      const id = `bb_${now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const mp = Math.round(Number(pl.maxPlayers)), max = MODE_MAX[game];
      const r = { id, inviteCode: genCode(), hostUserId: me.id, status: "lobby", game, mode: pl.mode === "classic" ? "classic" : "augment", maxPlayers: mp >= 1 && mp <= max ? mp : Math.min(max, game === "derby" ? 16 : max), opts: cleanOpts(game, pl.opts || {}), isPublic: false, solo: !!pl.solo, players: new Map(), order: [], spect: new Map(), stream: defaultStream(), createdAt: now() };
      rooms.set(id, r); invites.set(r.inviteCode, id);
      const p = newSeat(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id, team: 0 }); r.players.set(me.id, p); r.order.push(me.id);
      attach(io, socket, r, p); cb({ ok: true, code: r.inviteCode, me: me.id, meta: META }); emitRoom(io, r);
      if (r.solo) startGame(io, r);
    };
    socket.on("bsb:joinRoom", guard(async (pl, cb) => {
      const code = String(pl.code || "").trim(); const r = rooms.get(invites.get(code));
      if (!r) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      const seat = r.players.get(me.id);
      if (seat && !seat.left) { attach(io, socket, r, seat); cb({ ok: true, code: r.inviteCode, me: me.id, meta: META, rejoined: true }); io.to(chan(r.id)).emit("bsb:notice", { k: "back", name: seat.name }); emitRoom(io, r); sendSnap(io, r, me.id, socket.id); return; }
      const sp = r.spect.get(me.id);
      if (sp) { attach(io, socket, r, sp); cb({ ok: true, code: r.inviteCode, me: me.id, meta: META, spectator: true }); emitRoom(io, r); sendSnap(io, r, null, socket.id); return; }
      const old = myRoom(); if (old && old !== r) leave(io, old, me.id);
      const { name, avatar } = await profileOf(supabaseAdmin, me, pl.nickname);
      if (rooms.get(r.id) !== r) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      const humanCount = humans(r).length;
      if (pl.watch === true || r.status === "playing" || r.solo || humanCount >= r.maxPlayers || r.players.get(me.id)?.left) {
        if (r.spect.size >= BB.maxSpect) return cb({ ok: false, error: "ROOM_FULL" });
        const s = { id: me.id, name, sockId: socket.id, connected: true, dcAt: 0, focus: null }; r.spect.set(me.id, s); attach(io, socket, r, s);
        cb({ ok: true, code: r.inviteCode, me: me.id, meta: META, spectator: true }); emitRoom(io, r); sendSnap(io, r, null, socket.id); return;
      }
      if (r.status === "ended") for (const u of [...r.order]) { const q = r.players.get(u); if (!q || q.left || q.ai) removeSeat(r, u); }
      const p = newSeat(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id, team: r.game === "pvb" ? (r.order.length ? 1 : 0) : smallerTeam(r) }); r.players.set(me.id, p); r.order.push(me.id); attach(io, socket, r, p);
      cb({ ok: true, code: r.inviteCode, me: me.id, meta: META }); io.to(chan(r.id)).emit("bsb:notice", { k: "join", name }); emitRoom(io, r);
    }));
    socket.on("bsb:sit", guard((pl, cb) => {
      const r = myRoom(); if (!r || !r.spect.has(me.id)) return cb({ ok: false, error: "NOT_SPECTATOR" });
      if (playing(r)) return cb({ ok: false, error: "GAME_STARTED" });
      if (humans(r).length >= r.maxPlayers) return cb({ ok: false, error: "ROOM_FULL" });
      const s = r.spect.get(me.id); r.spect.delete(me.id); r.players.delete(me.id);
      const p = newSeat(me.id, s.name, { isGuest: me.isGuest, sockId: socket.id, team: smallerTeam(r) }); r.players.set(me.id, p); r.order.push(me.id);
      if (!humans(r).some(h => h.id === r.hostUserId)) r.hostUserId = me.id;
      attach(io, socket, r, p); cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("bsb:toWatch", guard((pl, cb) => {
      const r = myRoom(); if (!r || !r.players.has(me.id)) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (playing(r)) return cb({ ok: false, error: "GAME_STARTED" });
      if (r.hostUserId === me.id) return cb({ ok: false, error: "HOST_CANT_WATCH" });
      const p = r.players.get(me.id); removeSeat(r, me.id); r.spect.set(me.id, { id: me.id, name: p.name, sockId: socket.id, connected: true, dcAt: 0, focus: null }); userRoom.set(me.id, r.id);
      cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("bsb:setOpts", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return;
      if (GAMES.includes(pl.game) && pl.game !== r.game) {
        const max = MODE_MAX[pl.game]; if (humans(r).length > max) return cb({ ok: false, error: "BELOW_CURRENT" });
        r.game = pl.game; r.opts = defaultOpts(pl.game); r.maxPlayers = Math.min(max, Math.max(pl.game === "derby" ? 16 : max, humans(r).length)); // 모드를 바꾸면 그 모드 기본 인원
        r.order.forEach((u, i) => { const p = r.players.get(u); p.team = pl.game === "pvb" ? (i ? 1 : 0) : i % 2; });
      }
      if (pl.mode === "classic" || pl.mode === "augment") r.mode = pl.mode;
      if (pl.maxPlayers !== undefined) { const n = Math.round(Number(pl.maxPlayers)); if (!(n >= 1 && n <= MODE_MAX[r.game])) return cb({ ok: false, error: "BAD_VALUE" }); if (n < humans(r).length) return cb({ ok: false, error: "BELOW_CURRENT" }); r.maxPlayers = n; }
      if (pl.opts) r.opts = cleanOpts(r.game, pl.opts, r.opts);
      if (typeof pl.isPublic === "boolean") r.isPublic = pl.isPublic;
      cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("bsb:team", guard((pl, cb) => {
      const r = myRoom(); if (!r || playing(r)) return cb({ ok: false, error: "GAME_STARTED" });
      if (r.game !== "mini" && r.game !== "pvb") return cb({ ok: false, error: "NO_TEAMS" });
      const uid = pl.uid && r.hostUserId === me.id ? String(pl.uid) : me.id; const p = r.players.get(uid); if (!p) return cb({ ok: false, error: "BAD_TARGET" });
      const t = Number(pl.t) === 1 ? 1 : 0;
      if (r.game === "pvb") { for (const q of r.players.values()) q.team = q.id === uid ? t : 1 - t; }
      else { const cnt = [...r.players.values()].filter(q => !q.ai && q.team === t && q.id !== uid).length; if (cnt >= 4) return cb({ ok: false, error: "TEAM_FULL" }); p.team = t; }
      cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("bsb:kick", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return;
      const uid = String(pl.uid || ""); if (uid === me.id || (!r.players.has(uid) && !r.spect.has(uid))) return cb({ ok: false, error: "BAD_TARGET" });
      const p = r.players.get(uid) || r.spect.get(uid); if (p.sockId) io.to(p.sockId).emit("bsb:kicked", {}); leave(io, r, uid); cb({ ok: true });
    }));
    socket.on("bsb:start", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return;
      if (r.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      for (const u of [...r.order]) { const p = r.players.get(u); if (!p || p.left || p.ai) removeSeat(r, u); }
      if (!r.order.some(u => r.players.get(u)?.connected)) return cb({ ok: false, error: "NEED_1" });
      if (r.game === "mini" && !r.opts.aiFill) { const c = [0, 0]; for (const p of humans(r)) c[p.team]++; if (r.order.length >= 2 && (!c[0] || !c[1])) return cb({ ok: false, error: "NEED_TEAMS" }); }
      cb({ ok: true }); startGame(io, r);
    }));
    socket.on("bsb:toLobby", guard((pl, cb) => {
      const r = hostRoom(cb); if (!r) return; if (r.status !== "ended") return cb({ ok: false, error: "NOT_ENDED" });
      for (const u of [...r.order]) { const p = r.players.get(u); if (!p || p.left || p.ai) removeSeat(r, u); }
      r.status = "lobby"; r.result = null; r.G = null; r.solo = false; if (r.endTimer) { clearTimeout(r.endTimer); r.endTimer = null; }
      cb({ ok: true }); emitRoom(io, r);
    }));
    // ---------- 경기 입력 ----------
    const inGame = (cb) => { const r = myRoom(); const p = r?.players.get(me.id); if (!r || !p || p.left || !playing(r) || !r.G) { cb({ ok: false, error: "NOT_PLAYING" }); return null; } return r; };
    socket.on("bsb:swing", guard((pl, cb) => { const r = inGame(cb); if (!r) return; cb(r.G.swing(me.id, pl, now())); }, { game: true }));
    socket.on("bsb:pitch", guard((pl, cb) => { const r = inGame(cb); if (!r) return; if (!r.G.pitch) return cb({ ok: false, error: "NO_PITCHER" }); cb(r.G.pitch(me.id, pl, now())); }, { game: true }));
    socket.on("bsb:pick", guard((pl, cb) => { const r = inGame(cb); if (!r) return; cb(r.G.pick(me.id, String(pl.id || ""), now())); }, { game: true }));
    socket.on("bsb:use", guard((pl, cb) => { const r = inGame(cb); if (!r) return; if (r.mode !== "augment") return cb({ ok: false, error: "NO_AUG" }); cb(r.G.use(me.id, String(pl.id || ""), now())); }, { game: true }));
    socket.on("bsb:focus", guard((pl, cb) => {
      const r = myRoom(); if (!r) return cb({ ok: false });
      const rec = r.players.get(me.id) || r.spect.get(me.id); const i = Number(pl.idx);
      rec.focus = Number.isInteger(i) && i >= 0 && i < 60 ? i : null;
      if (r.game === "derby" && r.G && rec.focus != null) { const q = [...r.G.P.values()].find(P => P.idx === rec.focus); if (q) socket.emit("bsb:fsnap", { i: q.idx, snap: r.G.snapshot(q.id, now()) }); }
      cb({ ok: true });
    }));
    socket.on("bsb:sync", guard((pl, cb) => { const r = myRoom(); if (!r) return cb({ ok: false, error: "NOT_IN_ROOM", meta: META }); cb({ ok: true, room: pubRoom(r, me.id), meta: META }); sendSnap(io, r, r.players.has(me.id) ? me.id : null, socket.id); }));
    socket.on("bsb:emote", guard((pl, cb) => {
      const r = myRoom(); const p = r?.players.get(me.id); if (!p) return cb({ ok: false });
      const t = now(); if (t - (p.emoAt || 0) < 1500) return cb({ ok: false, error: "TOO_FAST" }); p.emoAt = t;
      const e = ["👍", "🔥", "😱", "😂", "👏", "⚾"][Number(pl.e)]; if (!e) return cb({ ok: false });
      io.to(chan(r.id)).emit("bsb:emote", { i: p.idx, e }); cb({ ok: true });
    }));
    // ---------- 스트리머 ----------
    socket.on("bsb:stream", guard((pl, cb) => {
      const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; const st = r.stream;
      if (typeof pl.on === "boolean") st.on = pl.on;
      if (pl.rules) { const next = { ...st.rules }; for (const k of STREAM_KINDS) if (pl.rules[k] !== undefined) { const v = parseAmount(Number(pl.rules[k])); if (v === null) return cb({ ok: false, error: "BAD_AMOUNT" }); next[k] = v; } if (new Set(Object.values(next)).size !== STREAM_KINDS.length) return cb({ ok: false, error: "DUP_AMOUNT" }); st.rules = next; }
      if (pl.targets) for (const k of STREAM_KINDS) if (STREAM_TARGETS.includes(pl.targets[k])) st.targets[k] = pl.targets[k];
      cb({ ok: true }); emitRoom(io, r);
    }));
    socket.on("bsb:testDonation", guard((pl, cb) => {
      const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; if (!r.stream.on) return cb({ ok: false, error: "STREAM_OFF" });
      if (r.lastTest && now() - r.lastTest < 1200) return cb({ ok: false, error: "TOO_FAST" }); r.lastTest = now();
      const amount = parseAmount(Number(pl.amount)); if (amount === null) return cb({ ok: false, error: "BAD_AMOUNT" });
      cb({ ok: true, entry: receiveDonation(io, r, { platform: "test", donor: pl.donor || "테스트 시청자", amount, test: true }) });
    }));
    socket.on("bsb:streamLink", guard(async (pl, cb) => {
      const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; if (!HOOKS.linkChat) return cb({ ok: false, error: "NO_LINKER" });
      const st = r.stream, platform = ["chzzk", "cime", "soop"].includes(pl.platform) ? pl.platform : null;
      if (!platform || (platform !== "soop" && !pl.accessToken) || (platform === "soop" && !pl.url)) return cb({ ok: false, error: "BAD_LINK" });
      if (st.link.status === "connecting" && now() - (r.linkAt || 0) < 30000) return cb({ ok: false, error: "BUSY" });
      r.linkAt = now(); st.link = { status: "connecting", platform, nickname: null, donation: false, error: null }; emitRoom(io, r);
      const key = "dw_bb_" + r.inviteCode;
      try {
        const res = await HOOKS.linkChat({ platform, key, accessToken: platform === "soop" ? null : String(pl.accessToken), soopUrl: platform === "soop" ? String(pl.url).slice(0, 200) : null, channelId: pl.channelId ? String(pl.channelId) : null, nickname: pl.nickname ? String(pl.nickname).slice(0, 30) : null, hostUserId: me.id, roomCode: r.inviteCode, contentMode: "baseball",
          onDonation: (d) => onPlatformDonation(io, r, platform, d), onChat: () => {},
          onClose: () => { if (rooms.get(r.id) !== r) return; st.link = { ...st.link, status: "error", donation: false, error: "연결이 끊겼어요 (방송 종료 등) — 다시 연결해 주세요" }; emitRoom(io, r); } });
        if (rooms.get(r.id) !== r) { try { HOOKS.unlinkChat?.(key); } catch {} return cb({ ok: false, error: "ROOM_CLOSED" }); }
        st.link = { status: res.ok ? "connected" : "error", platform, nickname: String(res.nickname || pl.nickname || "").slice(0, 30) || null, donation: !!res.donationSubscribed, error: res.ok ? (res.donationSubscribed ? null : (res.donationError || "후원 구독 실패")) : String(res.error || "연결 실패").slice(0, 120) };
      } catch (e) { st.link = { status: "error", platform, nickname: null, donation: false, error: String(e.message || e).slice(0, 120) }; }
      emitRoom(io, r); cb({ ok: st.link.status === "connected", link: st.link });
    }));
    socket.on("bsb:streamUnlink", guard((pl, cb) => { const r = hostRoom(cb, { allowPlaying: true }); if (!r) return; try { HOOKS.unlinkChat?.("dw_bb_" + r.inviteCode); } catch {} r.stream.link = { status: "off", platform: null, nickname: null, donation: false, error: null }; emitRoom(io, r); cb({ ok: true }); }));
    socket.on("bsb:leaveRoom", guard((pl, cb) => { const r = myRoom(); if (r) leave(io, r, me.id); cb({ ok: true }); }));
    socket.on("disconnect", () => {
      const r = myRoom(); if (!r) return;
      const rec = r.players.get(me.id) || r.spect.get(me.id); if (!rec || rec.sockId !== socket.id) return;
      rec.connected = false; rec.dcAt = now();
      if (r.spect.has(me.id)) { setTimeout(() => { const s = r.spect.get(me.id); if (s && !s.connected && now() - s.dcAt >= BB.lobbyDc - 50) leave(io, r, me.id); }, BB.lobbyDc); checkEmpty(io, r); return; }
      io.to(chan(r.id)).emit("bsb:notice", { k: "dc", name: rec.name });
      if (!playing(r)) setTimeout(() => { if (rooms.get(r.id) !== r || playing(r)) return; const q = r.players.get(me.id); if (q && !q.connected && q.dcAt && now() - q.dcAt >= BB.lobbyDc - 50) leave(io, r, me.id); }, BB.lobbyDc);
      else if (r.hostUserId === me.id) pickNewHost(r);
      checkEmpty(io, r); emitRoom(io, r);
    });
  });
}
const META = { augs: AUGS, rarity: RARITY, roleLabel: ROLE_LABEL, kindLabel: KIND_LABEL, synergy: SYNERGY, maxAugs: MAX_AUGS, modeMax: MODE_MAX, streamKinds: STREAM_KINDS, streamLabel: STREAM_LABEL, streamTargets: STREAM_TARGETS, derby: DERBY };
addPublicList("baseball", () => { const out = []; for (const r of rooms.values()) { if (!r.isPublic || r.status !== "lobby" || r.solo) continue; const n = humans(r).length; if (n >= r.maxPlayers) continue; out.push({ code: r.inviteCode, host: r.players.get(r.hostUserId)?.name || "", n, max: r.maxPlayers, game: r.game }); } return out; }, { lobbyOf: (uid) => { for (const r of rooms.values()) if (r.hostUserId === uid && r.status === "lobby") return r; return null; } });
export const _bsbTest = { rooms, invites, userRoom, BB };
