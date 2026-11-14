// =========================================================
// 플듀 대전쟁 — 멀티 서버 (2~8인, 서버 권한형)
// · 다른 게임과 완전 분리: 'dw:*' 이벤트, 별도 Map
// · 전투는 duowars-core.js(화면과 같은 엔진)를 서버에서 20틱/초로 돌림
// · 클라이언트는 입력(소환·업그레이드·목표)만 보냄 → 서버가 검증·실행
// · 상태 전송: 0.1초마다 "바뀐 유닛만" + 새로 나온 유닛 정보 + 사라진 유닛 번호 + 효과 이벤트
// =========================================================
import fs from "fs";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { DuoWarsGame, energyStats, TICK_HZ } from "./duowars-core.js";
import { createFlight } from "./create-flight.js";
import { addPublicRooms } from "./public-rooms.js";
import { createStream, attachStream, sanitizeRules, sanitizeSettings, parseAmount, cleanDonor, KINDS } from "./duowars-stream.js";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = JSON.parse(fs.readFileSync(path.join(__dir, "duowars-data.json"), "utf8"));

const rooms = new Map();     // roomId → room
const invites = new Map();   // code → roomId
const userRoom = new Map();  // userId → roomId

const MODES = ["coop", "team", "ffa"];
const SOOP_BALLOON_KRW = 100;
let soopSeq = 0;
const MIN_PLAYERS = { coop: 2, team: 2, ffa: 3 };
const MAX_PLAYERS = 8, MAX_SPECS = 30, MAX_VIEWERS = 300;
const RECONNECT_MS = 90_000, HOST_GRACE_MS = 8_000, EMPTY_TTL_MS = 60_000, ENDED_TTL_MS = 15 * 60_000;
const SNAP_EVERY = 2; // 2틱(0.1초)마다 전송
const KEYFRAME_EVERY = TICK_HZ * 5;
const EV_KEEP = new Set(["hit", "aoe", "proj", "chain", "laser", "heal", "pulse", "death", "spawn", "baseHit", "baseDown", "boss", "warn", "emergency", "dash", "enrage", "up", "sudden", "end", "advance", "meteor", "buff", "teamHeal", "baseHeal", "leap", "bossSkill", "giant", "morph", "stun", "knockAll"]);
const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#eab308", "#a855f7", "#f97316", "#14b8a6", "#ec4899"];

const sr = (id) => `dw:${id}`;
const srv = (id) => `dw:${id}:v`; // 관전·시청자 채널 (상태 전송 주기 절반)
const now = () => Date.now();
function genCode() {
  for (let i = 0; i < 60; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!invites.has(c)) return c; }
  return String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
}
// 닉네임: 제어문자·앞뒤 공백 제거, 1~12자
export function cleanName(s, fb = "게스트") {
  const t = String(s ?? "").normalize("NFC").replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 12);
  return t || fb;
}
function cleanDeck(deck) { return (Array.isArray(deck) ? deck : []).map(String).filter((u, i, a) => DATA.units[u] && a.indexOf(u) === i).slice(0, 8); }
function cleanLevels(lv, deck) { const o = {}; for (const u of deck) o[u] = Math.max(1, Math.min(30, Math.floor(+(lv || {})[u] || 1))); return o; }
function cleanOpts(o, prev) {
  const q = { ...prev };
  if (MODES.includes(o?.mode)) q.mode = o.mode;
  if (o?.maxPlayers != null) { const n = Math.round(+o.maxPlayers); if (n >= 2 && n <= MAX_PLAYERS) q.maxPlayers = n; }
  if (o?.stageId != null) { const s = Math.round(+o.stageId); if (DATA.stages.some((x) => x.id === s)) q.stageId = s; }
  if (DATA.difficulty[o?.difficulty]) q.difficulty = o.difficulty;
  for (const k of ["isPublic", "teamAuto", "allowSpectate", "levelFlat", "midJoin", "showNames"]) if (typeof o?.[k] === "boolean") q[k] = o[k];
  if (q.mode === "ffa" && q.maxPlayers < 3) q.maxPlayers = 3;
  return q;
}

export function registerDuoWars(io, supabaseAdmin, hooks = {}) {
  const toAll = (r) => io.to([sr(r.id), srv(r.id)]);
  const S = attachStream({ io, supabaseAdmin, DATA, sr, toAll });
  const minPlayers = (r) => (r.stream ? (r.opts.mode === "team" ? 2 : 1) : MIN_PLAYERS[r.opts.mode]);
  const maxSpecs = (r) => (r.stream ? MAX_VIEWERS : MAX_SPECS);
  const pubStream = (st) => st && { kind: st.kind, title: st.title, platform: st.platform, link: st.link, viewOnly: st.settings.viewOnly, viewerJoin: st.settings.viewerJoin, viewerUnits: st.settings.viewerUnits, viewerUnitCd: st.settings.viewerUnitCd, showDonorNames: st.settings.showDonorNames };
  const profile = async (me) => {
    if (me.isGuest || !supabaseAdmin) return {};
    try { const { data } = await supabaseAdmin.from("profiles").select("nickname").eq("id", me.id).single(); return data || {}; } catch { return {}; }
  };
  addPublicRooms("duowars", rooms);

  const pubPlayer = (p) => ({ id: p.id, name: p.name, isGuest: p.isGuest, ready: p.ready, team: p.team, spec: p.spec, connected: p.connected, deck: p.deck, color: p.color });
  const pubRoom = (r) => ({ id: r.id, code: r.code, hostId: r.hostUserId, status: r.status, opts: r.opts, stream: pubStream(r.stream), players: r.order.map((id) => r.players.get(id)).filter(Boolean).map(pubPlayer) });
  const emitRoom = (r) => toAll(r).emit("dw:room", pubRoom(r));
  const hostInfo = (r) => r.stream ? { ovKey: r.stream.ovKey, settings: r.stream.settings, rules: r.stream.rules, link: r.stream.link, platform: r.stream.platform } : null;
  const sendHost = (r) => { const p = r.players.get(r.hostUserId); const s = p?.socketId && io.sockets.sockets.get(p.socketId); if (s && r.stream) s.emit("dw:host", hostInfo(r)); };
  const seats = (r) => [...r.players.values()].filter((p) => !p.spec);

  function autoTeams(r) {
    if (r.opts.mode !== "team") return;
    if (!r.opts.teamAuto) { for (const p of seats(r)) if (p.team !== 0 && p.team !== 1) p.team = 0; return; }
    let i = 0; for (const id of r.order) { const p = r.players.get(id); if (p && !p.spec) p.team = i++ % 2; }
  }

  function setHost(r, uid) { r.hostUserId = uid; r.host = uid; }
  function pickNewHost(r) {
    const cand = r.order.map((id) => r.players.get(id)).find((p) => p && p.connected && !p.spec) || r.order.map((id) => r.players.get(id)).find((p) => p && p.connected);
    if (cand) { setHost(r, cand.id); toAll(r).emit("dw:notice", { k: "host", name: cand.name }); sendHost(r); }
    return cand;
  }

  function destroy(r) {
    stopLoop(r);
    if (r.stream && hooks.unlinkChat) { try { hooks.unlinkChat("dw_" + r.code); } catch {} }
    if (r.emptyTimer) clearTimeout(r.emptyTimer);
    for (const p of r.players.values()) { if (p.dcTimer) clearTimeout(p.dcTimer); if (userRoom.get(p.id) === r.id) userRoom.delete(p.id); }
    rooms.delete(r.id); invites.delete(r.code);
  }
  function scheduleEmptyCheck(r) {
    const anyConn = [...r.players.values()].some((p) => p.connected);
    if (anyConn) { if (r.emptyTimer) { clearTimeout(r.emptyTimer); r.emptyTimer = null; } return; }
    if (!r.emptyTimer) r.emptyTimer = setTimeout(() => { if (![...r.players.values()].some((p) => p.connected)) destroy(r); }, EMPTY_TTL_MS);
  }

  // 방송방은 스트리머 것 → 방장을 다른 사람(시청자)에게 넘기지 않고 방을 닫음 (오버레이 키·후원 설정 보호)
  function closeStreamRoom(r) {
    toAll(r).emit("dw:closed", { reason: "host_left" });
    for (const p of r.players.values()) { const s = p.socketId && io.sockets.sockets.get(p.socketId); if (s) { s.leave(sr(r.id)); s.leave(srv(r.id)); } }
    destroy(r);
  }
  function removePlayer(r, uid, why) {
    const p = r.players.get(uid); if (!p) return;
    if (p.dcTimer) { clearTimeout(p.dcTimer); p.dcTimer = null; }
    // 플레이어·관전 채널 둘 다에서 빼기 (관전자가 나간 뒤 새 방을 만들어도 예전 방 소식이 계속 오던 문제)
    { const s = p.socketId && io.sockets.sockets.get(p.socketId); if (s) { s.leave(sr(r.id)); s.leave(srv(r.id)); } }
    r.players.delete(uid); r.order = r.order.filter((x) => x !== uid);
    if (userRoom.get(uid) === r.id) userRoom.delete(uid);
    if (r.game && r.status === "playing" && !p.spec) { r.game.removePlayer(uid); }
    if (r.players.size === 0) { destroy(r); return; }
    if (r.stream && r.hostUserId === uid) { closeStreamRoom(r); return; }
    if (r.hostUserId === uid) pickNewHost(r);
    if (r.status === "lobby") autoTeams(r);
    toAll(r).emit("dw:notice", { k: why === "kick" ? "kicked" : "left", name: p.name });
    emitRoom(r);
  }

  // ---------- 플랫폼 후원 이벤트 → 표준 형태 ----------
  function onPlatformDonation(r, platform, raw) {
    let data = raw; if (typeof data === "string") { try { data = JSON.parse(data); } catch { return; } }
    if (!data || typeof data !== "object" || !r.stream) return;
    let amount = null;
    if (platform === "chzzk") amount = parseAmount(String(data.payAmount ?? "").replace(/[,\s]/g, ""));   // 치지직: 원 단위 문자열
    else if (platform === "soop") { const n = Number(data.balloons); amount = Number.isSafeInteger(n) && n > 0 ? parseAmount(n * SOOP_BALLOON_KRW) : null; } // SOOP: 별풍선 1개 = 100원
    else if (platform === "cime") { const beam = Number(data.payAmountNumber ?? data.payAmount); const krw = beam * (r.stream.settings.cimeBeamKrw || 1); amount = Number.isFinite(krw) && Math.abs(krw - Math.round(krw)) < 1e-6 ? parseAmount(Math.round(krw)) : null; }
    const donor = data.donatorNickname || (data.donatorChannelId ? null : "익명 후원자");
    // 치지직·씨미 후원 이벤트엔 고유 번호가 없음 → 같은 내용이 3초 안에 두 번 오면 같은 후원으로 봄
    const t = Date.now(), base = [platform, data.channelId || "", data.donatorChannelId || "anon", data.payAmount ?? data.payAmountNumber ?? data.balloons ?? "", String(data.donationText || "").slice(0, 60), data.donationType || ""].join("|");
    if (platform === "soop") { S.receive(r, { platform, key: base + "|" + t + "|" + (++soopSeq), donor, amount: amount ?? -1, test: false, channel: data.channelId || null }).catch((e) => console.warn("[dw] donation", e.message)); return; }
    const rc = r.stream.recent || (r.stream.recent = new Map());
    const prevAt = rc.get(base); if (prevAt != null && t - prevAt < 3000) return;
    rc.set(base, t); if (rc.size > 300) for (const [k, v] of rc) if (t - v > 3000) rc.delete(k);
    const key = base + "|" + Math.floor(t / 3000);
    S.receive(r, { platform, key, donor, amount: amount ?? -1, test: false, channel: data.channelId || null }).catch((e) => console.warn("[dw] donation", e.message));
  }

  // ---------- 전투 진행 ----------
  function stopLoop(r) { if (r.loop) { clearInterval(r.loop); r.loop = null; } }
  function startGame(r) {
    const ps = seats(r);
    const mode = r.opts.mode;
    const players = ps.map((p, i) => ({ id: p.id, name: p.name, team: mode === "coop" ? 0 : mode === "ffa" ? i : p.team, deck: p.deck.length ? p.deck : DATA.rules.startUnits, levels: p.levels, color: COLORS[i % 8] }));
    const seed = (Math.random() * 2 ** 31) >>> 0;
    const sk = r.stream?.kind;
    const extra = sk === "svs" ? { timeLimit: r.stream.settings.svsTime, aiScale: 0.45 } : sk === "chaos" ? { aiScale: 0.8 } : {};
    const game = new DuoWarsGame(DATA, { mode, stageId: r.opts.stageId, seed, players, difficulty: r.opts.difficulty, levelFlat: r.opts.levelFlat, flatLevel: 10, ...extra });
    r.game = game; r.status = "playing"; r.startedAt = now(); r.lastSent = new Map(); r.evBuf = []; r.ffaOwners = {}; r.lastSentV = new Map(); r.evBufV = []; r.gameId = (r.gameId || 0) + 1;
    if (mode === "ffa") ps.forEach((p, i) => { game.bases[i].ownerName = p.name; r.ffaOwners[i] = p.id; });
    for (const p of ps) { p.ready = false; p.inSeq = 0; }
    toAll(r).emit("dw:start", initPayload(r));
    S.onStart(r);
    stopLoop(r);
    r.loop = setInterval(() => tick(r), 1000 / TICK_HZ);
  }
  function initPayload(r) {
    const g = r.game;
    return {
      mode: g.mode, stream: r.stream ? { kind: r.stream.kind, timeLimit: g.cfg.timeLimit || null } : null, stageId: g.stage.id, difficulty: r.opts.difficulty, tick: g.tick, hz: TICK_HZ, showNames: r.opts.showNames !== false,
      lane: g.lane, L: g.L, depth: g.depth, R: g.R,
      bases: g.bases.map((b) => ({ team: b.team, x: b.x, y: b.y, hp: b.hp, maxHp: b.maxHp, side: b.side, alive: b.alive, ownerName: b.ownerName || null })),
      players: [...g.players.values()].map((p) => ({ id: p.id, name: p.name, team: p.team, deck: p.deck, color: p.color })),
      full: g.units.filter((u) => u.alive).map(unitStatic),
      upd: g.units.filter((u) => u.alive).map(unitDyn),
    };
  }
  const unitStatic = (u) => [u.id, u.def, u.team, u.owner, u.label || null, +u.scale.toFixed(2), u.maxHp, u.lv, u.boss ? 1 : 0, u.tier || null];
  const unitDyn = (u) => [u.id, Math.round(u.x), Math.round(u.y), Math.max(0, Math.round(u.hp)), u.st, Math.min(255, Math.round(u.stT * 20)), u.enraged ? 1 : 0, u.hitFlash > 0 ? 1 : 0, u.stunT > 0 ? 1 : 0];

  function tick(r) {
    const g = r.game; if (!g) return;
    try {
      g.step();
      if (r.stream && !g.over) S.onTick(r);
      for (const e of g.events) if (EV_KEEP.has(e.k)) { r.evBuf.push(e); if (e.k !== "hit") r.evBufV.push(e); }
      if (g.tick % SNAP_EVERY === 0 || g.over) sendSnap(r, false);
      if (g.tick % (SNAP_EVERY * 2) === 0 || g.over) sendSnap(r, true);
      if (g.over) finish(r);
    } catch (e) { console.error("[dw] tick", e); stopLoop(r); r.status = "ended"; toAll(r).emit("dw:end", { winner: -1, error: true }); }
  }
  function sendSnap(r, viewers) {
    const g = r.game;
    const key = g.tick % KEYFRAME_EVERY === 0;
    const lastSent = viewers ? r.lastSentV : r.lastSent;
    const n = [], u = [], d = [];
    const seen = new Set();
    for (const x of g.units) {
      if (!x.alive && x.st === 4 && lastSent.get(x.id) === "dead") { seen.add(x.id); continue; }
      seen.add(x.id);
      const prev = lastSent.get(x.id);
      if (prev === undefined) n.push(unitStatic(x));
      const dyn = unitDyn(x);
      // 애니메이션 시간(stT)은 화면이 스스로 흘려 보내므로 비교에서 뺌 → 가만히 있는 유닛은 안 보냄
      const sig = x.alive ? dyn[1] + "," + dyn[2] + "," + dyn[3] + "," + dyn[4] + "," + dyn[6] + "," + dyn[7] + "," + dyn[8] : "dead";
      if (key || sig !== prev) { u.push(dyn); lastSent.set(x.id, sig); }
    }
    for (const id of lastSent.keys()) if (!seen.has(id)) { d.push(id); lastSent.delete(id); }
    // 효과 이벤트 (너무 많으면 잘라서 보냄)
    let ev; if (viewers) { ev = r.evBufV; r.evBufV = []; } else { ev = r.evBuf; r.evBuf = []; }
    if (ev.length > 160) ev = ev.filter((e) => e.k !== "hit").concat(ev.filter((e) => e.k === "hit").slice(0, 60)).slice(0, 160);
    const ps = [...g.players.values()].map((p) => [p.id, Math.floor(p.energy), p.eMax, p.eLv, p.live, p.alive ? 1 : 0, p.target ?? -1]);
    const snap = { t: g.tick, n, u, d, ev, b: g.bases.map((b) => Math.max(0, Math.round(b.hp))), p: ps, sd: g.suddenDeath ? 1 : 0 };
    io.to(viewers ? srv(r.id) : sr(r.id)).emit("dw:snap", snap);
  }
  function finish(r) {
    const g = r.game; stopLoop(r);
    r.status = "ended";
    if (r.stream) S.onEnd(r, g.winner);
    const st = g.stats;
    const rows = [...g.players.values()].map((p) => ({ id: p.id, name: p.name, team: p.team, kills: st.kills[p.id] || 0, dmg: Math.round(st.dmg[p.id] || 0), summons: st.summons[p.id] || 0, out: p.outAt ? Math.round(p.outAt) : null }));
    // 보상(코인): 협동은 승리 시 모두 같은 보상, 팀전·개인전은 승리 팀/생존자 보너스
    const stage = g.stage, diff = DATA.difficulty[r.opts.difficulty] || DATA.difficulty.normal;
    for (const row of rows) {
      let c;
      if (g.mode === "coop") c = g.winner === 0 ? Math.round(stage.reward.repeat * 1.3 * diff.coin) : Math.round(stage.reward.repeat * 0.3);
      else c = row.team === g.winner ? 260 : 90;
      row.coins = c;
    }
    toAll(r).emit("dw:end", { winner: g.winner, mode: g.mode, time: Math.round(g.time), rows, stream: r.stream ? { kind: r.stream.kind, timeUp: !!g.timeUp, donors: [...r.stream.donors.values()].sort((a, b) => b.total - a.total).slice(0, 10) } : null });
    // 끝난 방은 대기실로 돌아갈 수 있게 남겨 둠
    r.game = null; r.lastActive = now();
    for (const p of [...r.players.values()]) if (!p.connected && !(r.stream && p.id === r.hostUserId)) removePlayer(r, p.id, "left");
    if (rooms.has(r.id)) { r.status = "lobby"; for (const p of r.players.values()) p.ready = p.id === r.hostUserId; emitRoom(r); }
  }

  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const fn = (cb) => (typeof cb === "function" ? cb : () => {});
    const myRoom = () => { const id = userRoom.get(me.id); return id ? rooms.get(id) : null; };
    let inHits = [];
    const inputLimited = () => { const t = now(); inHits = inHits.filter((x) => t - x < 1000); inHits.push(t); return inHits.length > 25; };

    const attach = (r, p) => {
      if (p.socketId && p.socketId !== socket.id) { const old = io.sockets.sockets.get(p.socketId); if (old) { old.emit("dw:replaced", {}); old.leave(sr(r.id)); old.leave(srv(r.id)); } }
      p.socketId = socket.id; p.connected = true; r.lastActive = now();
      if (p.dcTimer) { clearTimeout(p.dcTimer); p.dcTimer = null; }
      socket.leave(p.spec ? sr(r.id) : srv(r.id)); socket.join(p.spec ? srv(r.id) : sr(r.id)); userRoom.set(me.id, r.id);
      scheduleEmptyCheck(r);
    };
    const newPlayer = (name, deck, levels) => ({ id: me.id, name, isGuest: !!me.isGuest, ready: false, team: 0, spec: false, connected: true, socketId: socket.id, deck, levels, dcTimer: null, color: null });

    socket.on("dw:createRoom", async (payload, cb) => {
      { const f = createFlight("dw", me.id, fn(cb)); if (!f) return; cb = f; }
      try {
        const old = myRoom(); if (old) removePlayer(old, me.id, "left");
        const d = await profile(me);
        const id = `dw_${now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, code = genCode();
        const opts = cleanOpts(payload?.opts || {}, { mode: "coop", maxPlayers: 4, stageId: 1, difficulty: "normal", isPublic: false, teamAuto: true, allowSpectate: true, levelFlat: false, midJoin: true, showNames: true });
        if (payload?.opts?.levelFlat == null && opts.mode !== "coop") opts.levelFlat = true;
        let stream = null;
        if (payload?.stream) {
          stream = createStream(payload.stream, DATA);
          opts.mode = stream.kind === "team" ? "team" : "coop";
          opts.allowSpectate = true; if (stream.kind === "team") opts.midJoin = false;
          if (opts.mode === "team" && opts.maxPlayers < 2) opts.maxPlayers = 2;
          if (stream.kind === "raid" && payload?.opts?.stageId == null) opts.stageId = 10;
        }
        const r = { id, code, inviteCode: code, hostUserId: me.id, host: me.id, status: "lobby", opts, players: new Map(), order: [], game: null, loop: null, emptyTimer: null, createdAt: now(), stream };
        Object.defineProperty(r, "isPublic", { get: () => r.opts.isPublic, enumerable: true });
        Object.defineProperty(r, "maxPlayers", { get: () => r.opts.maxPlayers, enumerable: true });
        rooms.set(id, r); invites.set(code, id);
        const deck = cleanDeck(payload?.deck); const p = newPlayer(cleanName(d.nickname || payload?.nickname, "방장"), deck, cleanLevels(payload?.levels, deck));
        p.ready = true; r.players.set(me.id, p); r.order.push(me.id); attach(r, p); autoTeams(r);
        cb({ ok: true, code, me: me.id, room: pubRoom(r), host: hostInfo(r) }); emitRoom(r);
        if (stream && hooks.logStreamer) hooks.logStreamer({ platform: "duowars", channelId: "room:" + code, nickname: p.name, roomCode: code, hostUserId: me.id, hostNick: p.name, contentMode: "duowars" });
      } catch (e) { console.error("[dw:createRoom]", e); cb({ ok: false, error: "INTERNAL" }); }
    });

    socket.on("dw:joinRoom", async (payload, cb) => {
      cb = fn(cb);
      try {
        const r = rooms.get(invites.get(String(payload?.code || "").trim()));
        if (!r) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
        // 재접속
        const ex = r.players.get(me.id);
        if (ex) {
          attach(r, ex);
          toAll(r).emit("dw:notice", { k: "back", name: ex.name });
          cb({ ok: true, code: r.code, me: me.id, room: pubRoom(r), rejoined: true, game: r.status === "playing" && r.game ? initPayload(r) : null, host: r.hostUserId === me.id ? hostInfo(r) : null });
          emitRoom(r); return;
        }
        const old = myRoom(); if (old && old !== r) removePlayer(old, me.id, "left");
        const d = await profile(me);
        if (!rooms.has(r.id)) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
        if (r.players.has(me.id)) return cb({ ok: false, error: "RETRY" });
        const deck = cleanDeck(payload?.deck);
        const p = newPlayer(cleanName(d.nickname || payload?.nickname, me.isGuest ? "게스트" : "유저"), deck, cleanLevels(payload?.levels, deck));
        const nSeats = seats(r).length, nSpecs = r.players.size - nSeats;
        const playing = r.status === "playing";
        const wantSpec = !!payload?.spectate;
        if (playing) {
          const canMid = r.opts.midJoin && r.opts.mode === "coop" && nSeats < r.opts.maxPlayers && !wantSpec;
          if (canMid) {
            r.game._addPlayer({ id: me.id, name: p.name, team: 0, deck: p.deck.length ? p.deck : DATA.rules.startUnits, levels: p.levels, color: COLORS[nSeats % 8] });
          } else {
            if (!r.opts.allowSpectate) return cb({ ok: false, error: "GAME_ALREADY_STARTED" });
            if (nSpecs >= maxSpecs(r)) return cb({ ok: false, error: "ROOM_FULL" });
            p.spec = true;
          }
        } else if (wantSpec) {
          if (!r.opts.allowSpectate) return cb({ ok: false, error: "NO_SPECTATE" });
          if (nSpecs >= maxSpecs(r)) return cb({ ok: false, error: "ROOM_FULL" });
          p.spec = true;
        } else if (nSeats >= r.opts.maxPlayers) {
          if (!r.opts.allowSpectate || nSpecs >= maxSpecs(r)) return cb({ ok: false, error: "ROOM_FULL" });
          p.spec = true;
        }
        r.players.set(me.id, p); r.order.push(me.id); attach(r, p); autoTeams(r);
        if (!p.spec && r.opts.mode === "team" && !r.opts.teamAuto) { const c = [0, 0]; for (const x of seats(r)) if (x !== p) c[x.team]++; p.team = c[0] <= c[1] ? 0 : 1; }
        cb({ ok: true, code: r.code, me: me.id, room: pubRoom(r), game: playing && r.game ? initPayload(r) : null });
        toAll(r).emit("dw:notice", { k: "join", name: p.name, spec: p.spec });
        emitRoom(r);
      } catch (e) { console.error("[dw:joinRoom]", e); cb({ ok: false, error: "INTERNAL" }); }
    });

    socket.on("dw:leaveRoom", (_p, cb) => { cb = fn(cb); const r = myRoom(); if (r) { socket.leave(sr(r.id)); removePlayer(r, me.id, "left"); } cb({ ok: true }); });

    socket.on("dw:setOpts", (o, cb) => {
      cb = fn(cb); const r = myRoom(); if (!r) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (r.hostUserId !== me.id) return cb({ ok: false, error: "NOT_HOST" });
      if (r.status !== "lobby") return cb({ ok: false, error: "NOT_LOBBY" });
      const q = cleanOpts(o || {}, r.opts);
      if (q.maxPlayers < seats(r).length) return cb({ ok: false, error: "BELOW_CURRENT" });
      const modeChanged = q.mode !== r.opts.mode;
      r.opts = q; if (modeChanged) { for (const p of r.players.values()) if (p.id !== r.hostUserId) p.ready = false; }
      autoTeams(r); emitRoom(r); cb({ ok: true });
    });
    socket.on("dw:setReady", (o, cb) => { cb = fn(cb); const r = myRoom(); const p = r?.players.get(me.id); if (!p || r.status !== "lobby") return cb({ ok: false }); p.ready = !!o?.ready; emitRoom(r); cb({ ok: true }); });
    socket.on("dw:setDeck", (o, cb) => { cb = fn(cb); const r = myRoom(); const p = r?.players.get(me.id); if (!p || r.status !== "lobby") return cb({ ok: false }); p.deck = cleanDeck(o?.deck); p.levels = cleanLevels(o?.levels, p.deck); emitRoom(r); cb({ ok: true }); });
    socket.on("dw:setTeam", (o, cb) => {
      cb = fn(cb); const r = myRoom(); const p = r?.players.get(me.id); if (!p || r.status !== "lobby" || r.opts.mode !== "team") return cb({ ok: false });
      if (r.opts.teamAuto) return cb({ ok: false, error: "AUTO" });
      const t = o?.team === 1 ? 1 : 0; const cnt = seats(r).filter((x) => x.team === t && x !== p).length; if (cnt >= 4 && seats(r).length > 1) return cb({ ok: false, error: "TEAM_FULL" });
      p.team = t; p.ready = p.id === r.hostUserId; emitRoom(r); cb({ ok: true });
    });
    socket.on("dw:setSpec", (o, cb) => {
      cb = fn(cb); const r = myRoom(); const p = r?.players.get(me.id); if (!p || r.status !== "lobby") return cb({ ok: false });
      if (o?.spec) { if (!r.opts.allowSpectate) return cb({ ok: false, error: "NO_SPECTATE" }); p.spec = true; p.ready = false; }
      else { if (seats(r).length >= r.opts.maxPlayers) return cb({ ok: false, error: "ROOM_FULL" }); p.spec = false; }
      socket.leave(p.spec ? sr(r.id) : srv(r.id)); socket.join(p.spec ? srv(r.id) : sr(r.id));
      autoTeams(r); emitRoom(r); cb({ ok: true });
    });
    socket.on("dw:kick", (o, cb) => {
      cb = fn(cb); const r = myRoom(); if (!r || r.hostUserId !== me.id || r.status !== "lobby") return cb({ ok: false });
      const uid = String(o?.id || ""); if (uid === me.id || !r.players.has(uid)) return cb({ ok: false });
      const p = r.players.get(uid); const s = p.socketId && io.sockets.sockets.get(p.socketId); if (s) { s.emit("dw:kicked", {}); s.leave(sr(r.id)); }
      removePlayer(r, uid, "kick"); cb({ ok: true });
    });
    socket.on("dw:start", (_o, cb) => {
      cb = fn(cb); const r = myRoom(); if (!r) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (r.hostUserId !== me.id) return cb({ ok: false, error: "NOT_HOST" });
      if (r.status !== "lobby") return cb({ ok: false, error: "NOT_LOBBY" });
      const ps = seats(r).filter((p) => p.connected);
      if (ps.length < minPlayers(r)) return cb({ ok: false, error: "NEED_PLAYERS", need: minPlayers(r) });
      if (ps.some((p) => !p.ready && p.id !== r.hostUserId)) return cb({ ok: false, error: "NOT_READY" });
      if (r.opts.mode === "team") { const c = [0, 0]; for (const p of ps) c[p.team === 1 ? 1 : 0]++; if (!c[0] || !c[1]) return cb({ ok: false, error: "TEAM_EMPTY" }); }
      startGame(r); cb({ ok: true });
    });
    socket.on("dw:input", (o, cb) => {
      cb = fn(cb);
      const r = myRoom(); const g = r?.game; const p = r?.players.get(me.id);
      if (!g || !p || p.spec || r.status !== "playing") return cb({ ok: false, error: "NOT_PLAYING" });
      if (inputLimited()) return cb({ ok: false, error: "TOO_FAST" });
      const seq = Math.floor(+o?.seq || 0);
      if (seq <= (p.inSeq || 0)) return cb({ ok: false, error: "OLD_SEQ", seq });
      p.inSeq = seq;
      let res;
      if (o?.a === "s") res = g.summon(me.id, Math.floor(+o.slot));
      else if (o?.a === "u") res = g.upgradeEnergy(me.id);
      else if (o?.a === "t") res = g.setTarget(me.id, Math.floor(+o.team));
      else res = { ok: false, error: "BAD_INPUT" };
      const pl = g.players.get(me.id);
      cb({ ...res, seq, cd: pl ? pl.cd.map((c) => +Math.max(0, c - g.time).toFixed(2)) : null, e: pl ? Math.floor(pl.energy) : 0, t: g.tick });
    });
    socket.on("dw:resync", (_o, cb) => { cb = fn(cb); const r = myRoom(); if (!r?.game) return cb({ ok: false }); r.lastSent = new Map(); cb({ ok: true, game: initPayload(r) }); });
    socket.on("dw:listRooms", (_o, cb) => {
      cb = fn(cb);
      const list = [...rooms.values()].filter((r) => r.opts.isPublic).slice(0, 40).map((r) => ({ code: r.code, mode: r.opts.mode, n: seats(r).length, max: r.opts.maxPlayers, status: r.status, stage: r.opts.stageId, host: r.players.get(r.hostUserId)?.name || "" }));
      cb({ ok: true, list });
    });

    // ===== 스트리머 모드 =====
    const hostStream = (cb) => { const r = myRoom(); if (!r?.stream) { cb({ ok: false, error: "NOT_STREAM" }); return null; } if (r.hostUserId !== me.id) { cb({ ok: false, error: "NOT_HOST" }); return null; } return r; };
    let testHits = [];
    socket.on("dw:streamSettings", (o, cb) => {
      cb = fn(cb); const r = hostStream(cb); if (!r) return;
      const st = r.stream;
      if (o?.settings) st.settings = sanitizeSettings({ ...st.settings, ...o.settings }, DATA.streamDefaults.settings);
      if (Array.isArray(o?.rules)) st.rules = sanitizeRules(o.rules, DATA);
      if (typeof o?.title === "string") st.title = o.title.replace(/[<>\u0000-\u001f]/g, "").slice(0, 40) || st.title;
      emitRoom(r); cb({ ok: true, host: hostInfo(r) });
    });
    socket.on("dw:testDonation", async (o, cb) => {
      cb = fn(cb); const r = hostStream(cb); if (!r) return;
      const t = now(); testHits = testHits.filter((x) => t - x < 1000); if (testHits.length >= 4) return cb({ ok: false, error: "TOO_FAST" }); testHits.push(t);
      const amount = parseAmount(o?.amount); if (!amount) return cb({ ok: false, error: "BAD_AMOUNT" });
      const res = await S.receive(r, { platform: "test", key: "test:" + r.code + ":" + t + ":" + Math.random().toString(36).slice(2, 8), donor: o?.donor || "테스트 시청자", amount, test: true });
      cb(res);
    });
    socket.on("dw:donLogGet", (_o, cb) => { cb = fn(cb); const r = hostStream(cb); if (!r) return; cb({ ok: true, log: r.stream.log.slice(-80).map((x) => ({ id: x.id, at: x.at, donor: x.donor, amount: x.amount, test: x.test, platform: x.platform, status: x.status, rule: x.ruleName || null, note: x.note || null })), queue: r.stream.queue.length }); });
    socket.on("dw:streamLink", async (o, cb) => {
      cb = fn(cb); const r = hostStream(cb); if (!r) return;
      if (!hooks.linkChat) return cb({ ok: false, error: "NO_LINKER" });
      const platform = ["chzzk", "cime", "soop"].includes(o?.platform) ? o.platform : null;
      if (!platform || (platform !== "soop" && !o?.accessToken) || (platform === "soop" && !o?.url)) return cb({ ok: false, error: "BAD_LINK" });
      if (r.stream.link.status === "connecting" && now() - (r.stream.linkAt || 0) < 30000) return cb({ ok: false, error: "BUSY", link: r.stream.link });
      r.stream.linkAt = now();
      const st = r.stream; st.link = { status: "connecting", platform, nickname: cleanName(o.nickname, platform), donation: false, error: null };
      emitRoom(r);
      try {
        const res = await hooks.linkChat({
          platform, key: "dw_" + r.code, accessToken: platform === "soop" ? null : String(o.accessToken), soopUrl: platform === "soop" ? String(o.url).slice(0, 200) : null, channelId: o.channelId ? String(o.channelId) : null, nickname: o.nickname || null, hostUserId: me.id, roomCode: r.code,
          onDonation: (data) => onPlatformDonation(r, platform, data),
          onClose: () => { if (!rooms.has(r.id) || r.stream.link.platform !== platform) return; r.stream.link = { ...r.stream.link, status: "error", donation: false, error: "SOOP 연결이 끊겼어요 (방송 종료 등) — 다시 연결해 주세요" }; emitRoom(r); sendHost(r); },
          onChat: (evt) => { try { S.onChat(r, { text: evt?.content ?? evt?.message ?? "", sender: evt?.senderChannelId || evt?.profile?.nickname, nick: evt?.profile?.nickname }); } catch {} },
        });
        if (!rooms.has(r.id) || r.stream !== st) { try { hooks.unlinkChat?.("dw_" + r.code); } catch {} return cb({ ok: false, error: "ROOM_CLOSED" }); }
        st.link = { status: res.ok ? "connected" : "error", platform, nickname: cleanName(res.nickname || o.nickname, platform), donation: !!res.donationSubscribed, chat: !!res.subscribed, error: res.ok ? (res.donationSubscribed ? null : (res.donationError || "후원 구독 실패")) : (res.error || "연결 실패") };
      } catch (e) { st.link = { status: "error", platform, nickname: null, donation: false, error: String(e.message || e).slice(0, 120) }; }
      st.platform = platform; emitRoom(r); sendHost(r); cb({ ok: st.link.status === "connected", link: st.link });
    });
    socket.on("dw:streamUnlink", (_o, cb) => { cb = fn(cb); const r = hostStream(cb); if (!r) return; try { hooks.unlinkChat?.("dw_" + r.code); } catch {} r.stream.link = { status: "off", platform: null, nickname: null, donation: false, error: null }; emitRoom(r); sendHost(r); cb({ ok: true }); });
    socket.on("dw:vote", (o, cb) => {
      cb = fn(cb); const r = myRoom(); if (!r?.stream || !r.players.has(me.id)) return cb({ ok: false });
      if (r.stream.settings.viewOnly) return cb({ ok: false, error: "VIEW_ONLY" });
      cb({ ok: S.castVote(r, "web:" + me.id, Math.floor(+o?.idx)) });
    });
    socket.on("dw:viewerTeam", (o, cb) => {
      cb = fn(cb); const r = myRoom(); const p = r?.players.get(me.id); if (!r?.stream || !p || r.stream.kind !== "team") return cb({ ok: false });
      const t = o?.team === 1 ? 1 : 0; r.stream.viewerTeams.set(me.id, t); r.stream.chatTeams.set(cleanDonor(p.name), t); cb({ ok: true, team: t });
    });
    socket.on("dw:viewerUnit", (_o, cb) => {
      cb = fn(cb); const r = myRoom(); const p = r?.players.get(me.id); const st = r?.stream; const g = r?.game;
      if (!st || !p || !g || r.status !== "playing") return cb({ ok: false, error: "NOT_PLAYING" });
      if (!p.spec) return cb({ ok: false, error: "PLAYER" });
      if (!st.settings.viewerUnits || st.settings.viewOnly || !st.settings.viewerJoin) return cb({ ok: false, error: "OFF" });
      const t = now(), last = st.viewerCd.get(me.id) || 0; if (t - last < st.settings.viewerUnitCd * 1000) return cb({ ok: false, error: "COOLDOWN", left: Math.ceil((st.settings.viewerUnitCd * 1000 - (t - last)) / 1000) });
      if (g.units.filter((u) => u.alive && u.viewerUnit).length >= st.settings.viewerUnitCap) return cb({ ok: false, error: "CAP" });
      const team = st.kind === "svs" ? 1 : st.kind === "team" ? (st.viewerTeams.get(me.id) ?? 0) : 0;
      const u = g.spawnSpecial(team === 1 && st.kind !== "team" ? "dn_n_e" : "dn_n_a", team, { owner: "viewer", label: p.name, hpMul: 0.5, atkMul: 0.6, scale: 0.8, tier: "시청자" });
      if (!u) return cb({ ok: false, error: "FAIL" });
      u.viewerUnit = true; st.viewerCd.set(me.id, t);
      toAll(r).emit("dw:notice", { k: "viewerUnit", name: p.name, side: team === 0 ? "ally" : "enemy" });
      cb({ ok: true, cd: st.settings.viewerUnitCd });
    });
    // OBS 오버레이: 비밀 키가 맞아야 요약만 받음 (조작 권한 없음)
    socket.on("dw:ovJoin", (o, cb) => {
      cb = fn(cb); const r = rooms.get(invites.get(String(o?.code || "").trim()));
      const kb = typeof o?.key === "string" ? Buffer.from(o.key) : null, ok = r?.stream && Buffer.from(r.stream.ovKey);
      if (!ok || !kb || kb.length !== ok.length || !crypto.timingSafeEqual(kb, ok)) return cb({ ok: false, error: "BAD_KEY" });
      socket.join(sr(r.id) + ":ov"); cb({ ok: true, ov: S.ovSummary(r) });
    });

    socket.on("disconnect", () => {
      const r = myRoom(); if (!r) return;
      const p = r.players.get(me.id); if (!p || p.socketId !== socket.id) return;
      p.connected = false;
      toAll(r).emit("dw:notice", { k: "dc", name: p.name });
      if (r.status === "lobby") {
        // 대기실: 잠깐 뒤에도 안 돌아오면 내보냄
        p.dcTimer = setTimeout(() => { if (!p.connected && rooms.has(r.id)) removePlayer(r, me.id, "left"); }, r.stream && r.hostUserId === me.id ? RECONNECT_MS : HOST_GRACE_MS * 2);
      } else {
        // 게임 중: 90초 동안 자리 유지 (유닛은 계속 싸우고 에너지도 쌓임)
        p.dcTimer = setTimeout(() => { if (!p.connected && rooms.has(r.id)) removePlayer(r, me.id, "left"); }, RECONNECT_MS);
      }
      if (r.hostUserId === me.id && !r.stream) setTimeout(() => { if (rooms.has(r.id) && !p.connected && r.hostUserId === me.id) { pickNewHost(r); emitRoom(r); } }, HOST_GRACE_MS);
      emitRoom(r); scheduleEmptyCheck(r);
    });
  });

  // 오래된 방 정리
  setInterval(() => {
    const t = now();
    for (const r of rooms.values()) {
      if (r.status !== "playing" && t - (r.lastActive || r.createdAt || t) > 6 * 3600_000) destroy(r);
      if (r.status === "playing" && r.game && r.game.time > 1800) { r.game.over = true; r.game.winner = -1; finish(r); }
    }
  }, 60_000).unref?.();

  return { rooms };
}
