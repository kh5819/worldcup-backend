// =========================
// 플듀 증강 야추 — 멀티 방·턴 진행 (2026-11-15)
// · 일반 야추 / 증강 야추(3장 중 1장 고르기: 시작 + 3라운드마다) 두 모드
// · 2~8인, 게스트 가능, AI 봇, 혼자 AI 대결(soloAi)
// · 주사위·점수·증강 효과는 전부 서버가 결정 (화면은 연출만)
// · 이벤트 prefix 'yacht:*' (예전 야추 다이스는 2026-11-05 삭제, 같은 이름 재사용)
// =========================
import { createFlight } from "./create-flight.js";
import { addPublicRooms } from "./public-rooms.js";
import * as Y from "./yacht-core.js";

const rooms = new Map();      // roomId → room
const invites = new Map();    // inviteCode → roomId
const userRoom = new Map();   // userId → roomId

const MAX_PLAYERS = [2, 3, 4, 5, 6, 7, 8];
const TURN_SECS = [0, 30, 45, 60, 90];
const PICK_SEC = 25;
const LOBBY_DC_MS = 15_000;      // 대기실에서 끊긴 사람 자리 비우기
const EMPTY_ROOM_MS = 90_000;    // 사람이 아무도 없으면 방 닫기
const ENDED_ROOM_MS = 10 * 60_000;
const DC_AUTO_MS = 6_000;        // 끊긴 사람 차례면 6초 뒤 대신 둠
const BOT_STEP_MS = [750, 1300];
const MAX_NICK = 12;
const LOG_MAX = 30;

const chan = (id) => `yacht:${id}`;
const now = () => Date.now();
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a));
const cleanNick = (s, d) => String(s || "").replace(/[\u0000-\u001f​-‏‪-‮⁠-⁯﻿]/g, "").trim().slice(0, MAX_NICK) || d;

function genCode() {
  for (let i = 0; i < 50; i++) { const c = String(Math.floor(Math.random() * 1e6)).padStart(6, "0"); if (!invites.has(c)) return c; }
  return String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
}

function newPlayer(id, name, o = {}) {
  return {
    id, name, avatar: o.avatar || null, isBot: !!o.isBot, isGuest: !!o.isGuest,
    connected: !o.isBot, left: false, sockId: o.sockId || null, dcAt: 0,
    scores: {}, extra: 0, augs: [], offer: null, refresh: 1, picked: true,
    debuff: { jam: 0, tax: 0 },
    stats: { yachts: 0, augBonus: 0, thief: 0, streak: 0, best: null, used: {} },
    capUsed: {}, rewriteCat: null,
  };
}
function resetPlayerForGame(p) {
  p.scores = {}; p.extra = 0; p.augs = []; p.offer = null; p.refresh = 1; p.picked = true;
  p.debuff = { jam: 0, tax: 0 };
  p.stats = { yachts: 0, augBonus: 0, thief: 0, streak: 0, best: null, used: {} };
  p.capUsed = {}; p.rewriteCat = null;
}
const filled = (p) => Y.CATS.filter(c => typeof p.scores[c] === "number").length;
const isDone = (p) => filled(p) >= Y.CATS.length;
const augOf = (p, id) => p.augs.find(a => a.id === id);
const activeIds = (room) => room.order.filter(uid => { const p = room.players.get(uid); return p && !p.left; });
const humans = (room) => [...room.players.values()].filter(p => !p.isBot && !p.left);
const connectedHumans = (room) => humans(room).filter(p => p.connected);

function log(room, text, uid = null) {
  room.log.push({ t: now(), uid, text });
  if (room.log.length > LOG_MAX) room.log.splice(0, room.log.length - LOG_MAX);
}

// ---------------- 공개 상태 ----------------
function publicPlayer(room, p) {
  const r = Y.upperBonusRule(p), up = Y.upperSum(p);
  return {
    id: p.id, name: p.name, avatar: p.avatar, isBot: p.isBot, isGuest: p.isGuest,
    connected: p.connected, left: p.left,
    scores: p.scores, upper: up, bonusAt: r.at, bonusAmount: r.amount, bonus: up >= r.at ? r.amount : 0,
    extra: p.extra, total: Y.totalOf(p),
    augs: p.augs.map(a => ({ id: a.id, charges: a.charges ?? null })),
    picking: room.phase === "pick" && !p.picked,
    debuff: { ...p.debuff },
  };
}
function turnView(room) {
  const t = room.turn;
  if (!t || room.status !== "playing" || room.phase !== "turn") return null;
  const p = room.players.get(t.uid);
  const rolled = t.rollsUsed > 0;
  const preview = {};
  if (rolled && p && !t.scored) {
    const ctx = scoreCtx(room, p);
    for (const c of Y.CATS) if (typeof p.scores[c] !== "number") preview[c] = Y.scoreCategory(c, t.dice, p, ctx).score;
  }
  const unheld = t.held.filter(h => !h).length;
  return {
    uid: t.uid, dice: t.dice, held: t.held, rollsLeft: t.rollsLeft, rollsMax: t.rollsMax, rollsUsed: t.rollsUsed, scored: !!t.scored,
    toggles: t.toggles, taxed: t.taxed, deadline: t.deadline, preview,
    canRetry: !!(p && augOf(p, "retry") && rolled && t.rollsLeft <= 0 && !t.retryUsed && unheld > 0),
    rewriteCat: p?.rewriteCat || null,
    steadyReady: !!(p && augOf(p, "steadyHand") && !t.steadyUsed),
    seq: room.seq,
  };
}
function publicRoom(room, viewerId) {
  const me = viewerId ? room.players.get(viewerId) : null;
  return {
    id: room.id, code: room.inviteCode, hostId: room.hostUserId, status: room.status,
    opts: { mode: room.mode, maxPlayers: room.maxPlayers, turnSec: room.turnSec, isPublic: !!room.isPublic },
    soloAi: !!room.soloAi,
    round: room.round, maxRound: Y.CATS.length, phase: room.phase, pickIdx: room.pickIdx,
    pickDeadline: room.phase === "pick" ? room.pickDeadline : null,
    players: room.order.map(uid => publicPlayer(room, room.players.get(uid))),
    turn: turnView(room),
    log: room.log.slice(-12),
    me: viewerId || null,
    offer: me && room.phase === "pick" && !me.picked ? me.offer : null,
    refresh: me ? me.refresh : 0,
    result: room.result || null,
    serverNow: now(), // 화면 시계가 틀려도 남은 시간이 맞게
  };
}
function emitState(io, room) {
  for (const p of room.players.values()) {
    if (p.isBot || !p.sockId) continue;
    io.to(p.sockId).emit("yacht:state", publicRoom(room, p.id));
  }
}
function emitAll(io, room, ev, data) { io.to(chan(room.id)).emit(ev, data); }

// ---------------- 타이머 ----------------
function clearTimers(room) {
  for (const k of ["turnTimer", "pickTimer", "botTimer", "dcTimer"]) if (room[k]) { clearTimeout(room[k]); room[k] = null; }
}
function deleteRoom(io, room, reason) {
  clearTimers(room);
  if (room.emptyTimer) clearTimeout(room.emptyTimer);
  if (room.endTimer) clearTimeout(room.endTimer);
  rooms.delete(room.id); invites.delete(room.inviteCode);
  for (const uid of room.order) if (userRoom.get(uid) === room.id) userRoom.delete(uid);
  emitAll(io, room, "yacht:closed", { reason });
  io.in(chan(room.id)).socketsLeave(chan(room.id));
}
function checkEmpty(io, room) {
  if (connectedHumans(room).length > 0) { if (room.emptyTimer) { clearTimeout(room.emptyTimer); room.emptyTimer = null; } return; }
  if (room.emptyTimer) return;
  room.emptyTimer = setTimeout(() => { room.emptyTimer = null; if (rooms.get(room.id) === room && connectedHumans(room).length === 0) deleteRoom(io, room, "EMPTY"); }, EMPTY_ROOM_MS);
}

// ---------------- 게임 진행 ----------------
function startGame(io, room) {
  clearTimers(room);
  // 다시 하기: 나간 사람·끊긴 사람 정리
  for (const uid of [...room.order]) {
    const p = room.players.get(uid);
    if (!p || p.left || (!p.isBot && !p.connected)) removeFromRoom(room, uid);
  }
  for (const p of room.players.values()) resetPlayerForGame(p);
  room.status = "playing"; room.round = 1; room.turnIdx = 0; room.pickIdx = -1; room.result = null;
  room.log = []; room.seq++;
  room.startedAt = now();
  log(room, `게임 시작! ${room.mode === "augment" ? "증강 야추" : "일반 야추"} · ${room.order.length}명`);
  emitAll(io, room, "yacht:start", { mode: room.mode });
  if (room.mode === "augment") startPick(io, room, 0);
  else startTurn(io, room);
}

function startPick(io, room, idx) {
  clearTimers(room);
  room.phase = "pick"; room.pickIdx = idx; room.turn = null;
  room.pickDeadline = now() + PICK_SEC * 1000;
  for (const uid of activeIds(room)) {
    const p = room.players.get(uid);
    p.offer = Y.rollOffer(idx, p.augs.map(a => a.id));
    p.picked = !p.offer.length;
  }
  log(room, idx === 0 ? "증강 고르기 — 3장 중 1장!" : `${Y.PICK_ROUNDS[idx] - 1}라운드 끝! 새 증강 고르기`);
  emitAll(io, room, "yacht:pick", { idx, deadline: room.pickDeadline });
  room.pickTimer = setTimeout(() => {
    room.pickTimer = null;
    if (room.status !== "playing" || room.phase !== "pick" || room.pickIdx !== idx) return;
    for (const uid of activeIds(room)) { const p = room.players.get(uid); if (!p.picked) autoPick(room, p); }
    finishPick(io, room);
  }, PICK_SEC * 1000 + 300);
  // 봇·끊긴 사람은 바로(봇은 조금 뒤) 고름
  room.botTimer = setTimeout(() => {
    room.botTimer = null;
    if (room.phase !== "pick" || room.pickIdx !== idx) return;
    for (const uid of activeIds(room)) { const p = room.players.get(uid); if (!p.picked && (p.isBot || !p.connected)) autoPick(room, p); }
    if (!finishPick(io, room)) emitState(io, room);
  }, rnd(1200, 2400));
  emitState(io, room);
}
function bestOfferId(p) {
  const ord = (id) => Y.RARITY[Y.AUG[id]?.rarity]?.order ?? 0;
  return [...p.offer].sort((a, b) => ord(b) - ord(a) || Math.random() - 0.5)[0];
}
function autoPick(room, p) {
  if (!p.offer?.length) { p.picked = true; return; }
  grantAug(room, p, bestOfferId(p), true);
}
function grantAug(room, p, id, auto = false) {
  const a = Y.AUG[id];
  p.augs.push({ id, charges: a.kind === "active" || a.kind === "toggle" ? a.charges : null });
  p.offer = null; p.picked = true;
  log(room, `${p.name}: ${a.icon} ${a.name} [${Y.RARITY[a.rarity].label}]${auto ? " (자동)" : ""}`, p.id);
}
function finishPick(io, room) {
  if (room.phase !== "pick") return false;
  if (activeIds(room).some(uid => !room.players.get(uid).picked)) return false;
  clearTimers(room);
  emitAll(io, room, "yacht:picked", { idx: room.pickIdx });
  room.phase = "turn";
  startTurn(io, room);
  return true;
}

function currentPlayer(room) { return room.players.get(room.order[room.turnIdx]); }

/** 지금 turnIdx부터 둘 수 있는 사람 찾기 (나간 사람·다 채운 사람 건너뜀). 한 바퀴 넘어가면 라운드 +1 */
function startTurn(io, room) {
  clearTimers(room);
  room.phase = "turn";
  const n = room.order.length;
  let guard = 0;
  while (guard++ <= n) {
    const p = currentPlayer(room);
    if (p && !p.left && !isDone(p)) break;
    advanceIdx(room);
  }
  if (activeIds(room).every(uid => isDone(room.players.get(uid)))) return finishGame(io, room);
  const p = currentPlayer(room);
  if (!p || p.left || isDone(p)) return finishGame(io, room);
  const max = Y.rollsPerTurn(p);
  const jam = Math.min(p.debuff.jam, max - 1);
  const t = room.turn = {
    uid: p.id, dice: new Array(Y.diceCount(p)).fill(0), held: new Array(Y.diceCount(p)).fill(false),
    rollsMax: max - jam, rollsLeft: max - jam, rollsUsed: 0, toggles: {}, taxed: p.debuff.tax,
    steadyUsed: false, retryUsed: false, deadline: null, scored: false,
  };
  if (jam) log(room, `🧊 ${p.name}: 방해 굴림 — 이번 턴 굴림 ${t.rollsMax}번`, p.id);
  if (p.debuff.tax) log(room, `💸 ${p.name}: 점수 세금 -${5 * p.debuff.tax}`, p.id);
  p.debuff = { jam: 0, tax: 0 };
  room.seq++;
  if (room.turnSec > 0 && !p.isBot) {
    t.deadline = now() + room.turnSec * 1000;
    const seq = room.seq;
    room.turnTimer = setTimeout(() => { room.turnTimer = null; if (room.seq === seq || room.turn === t) onTimeout(io, room, t); }, room.turnSec * 1000 + 300);
  }
  emitAll(io, room, "yacht:turn", { uid: p.id, round: room.round });
  emitState(io, room);
  if (p.isBot) scheduleBot(io, room, t);
  else if (!p.connected) scheduleDcAuto(io, room, t);
}
function advanceIdx(room) {
  room.turnIdx = (room.turnIdx + 1) % room.order.length;
  if (room.turnIdx === 0) room.round++;
}
function endTurn(io, room) {
  clearTimers(room);
  const prevRound = room.round;
  // 다음 둘 사람까지 넘김 (나간 사람·다 채운 사람 건너뜀) — 라운드 바뀜을 여기서 다 세야 증강 고르기를 안 놓침
  advanceIdx(room);
  for (let g = 0; g < room.order.length; g++) {
    const q = currentPlayer(room);
    if (q && !q.left && !isDone(q)) break;
    advanceIdx(room);
  }
  // 라운드가 바뀔 때 증강 고르기 (증강 모드, 4·7·10라운드 시작 전)
  if (room.mode === "augment" && room.round !== prevRound) {
    // 한 번에 라운드가 여러 개 넘어가도(다 채운 사람만 남은 경우) 지나친 고르기 중 마지막 것 하나
    let idx = -1;
    for (let k = Y.PICK_ROUNDS.length - 1; k > 0; k--) if (Y.PICK_ROUNDS[k] > prevRound && Y.PICK_ROUNDS[k] <= room.round) { idx = k; break; }
    if (idx > 0 && room.pickIdx < idx && !activeIds(room).every(uid => isDone(room.players.get(uid)))) return startPick(io, room, idx);
  }
  startTurn(io, room);
}

function scoreCtx(room, p, cat = null) {
  const t = room.turn;
  return {
    capUsed: p.capUsed,
    rewriteBonus: !!(cat && p.rewriteCat === cat),
    rollsUsed: t.rollsUsed,
    toggles: { amplify: !!t.toggles.amplify, explode: !!t.toggles.explode },
    taxed: t.taxed,
    remaining: Y.CATS.length - filled(p),
  };
}

// 다음 차례 상대 (방해·세금 대상)
function nextOpponent(room, uid) {
  const n = room.order.length, i0 = room.order.indexOf(uid);
  for (let k = 1; k < n; k++) {
    const p = room.players.get(room.order[(i0 + k) % n]);
    if (p && !p.left && !isDone(p) && p.id !== uid) return p;
  }
  return null;
}

// ---------------- 행동 (사람·봇 공용) ----------------
function doRoll(io, room, p, { retry = false } = {}) {
  const t = room.turn;
  if (!t || t.uid !== p.id || t.scored) return { ok: false, error: "NOT_YOUR_TURN" };
  if (retry) {
    if (!augOf(p, "retry")) return { ok: false, error: "NO_AUG" };
    const unheld = t.held.filter(h => !h).length;
    if (t.rollsUsed === 0 || t.rollsLeft > 0 || t.retryUsed || unheld === 0) return { ok: false, error: "CANT_RETRY" };
    t.retryUsed = true;
  } else if (t.rollsLeft <= 0) return { ok: false, error: "NO_ROLLS" };
  if (t.rollsUsed > 0 && t.held.every(h => h)) return { ok: false, error: "ALL_HELD" };
  const rolled = [];
  t.dice = t.dice.map((v, i) => { if (t.rollsUsed > 0 && t.held[i]) return v; rolled.push(i); return 1 + Math.floor(Math.random() * 6); });
  if (t.rollsUsed === 0) t.held = t.held.map(() => false);
  let fate = [];
  if (augOf(p, "fate")) fate = Y.applyFate(t.dice, t.rollsUsed > 0 ? t.held : t.held.map(() => false));
  let steady = false;
  if (!retry) {
    const heldN = t.held.filter(h => h).length;
    if (t.rollsUsed > 0 && heldN >= 2 && augOf(p, "steadyHand") && !t.steadyUsed) { t.steadyUsed = true; steady = true; }
    else t.rollsLeft--;
  }
  t.rollsUsed++;
  room.seq++;
  emitAll(io, room, "yacht:rolled", { uid: p.id, dice: t.dice, held: t.held, rolled, fate, steady, retry, rollsLeft: t.rollsLeft, seq: room.seq });
  if (fate.length) log(room, `🔮 ${p.name}: 운명 조작 — 주사위 ${fate.length}개가 바뀜`, p.id);
  if (steady) log(room, `🤲 ${p.name}: 안정된 손 — 굴림이 줄지 않음`, p.id);
  if (retry) log(room, `🔁 ${p.name}: 행운의 재도전`, p.id);
  return { ok: true };
}
function doHold(room, p, i) {
  const t = room.turn;
  if (!t || t.uid !== p.id || t.scored) return { ok: false, error: "NOT_YOUR_TURN" };
  if (t.rollsUsed === 0) return { ok: false, error: "ROLL_FIRST" };
  if (!Number.isInteger(i) || i < 0 || i >= t.dice.length) return { ok: false, error: "BAD_DIE" };
  t.held[i] = !t.held[i];
  return { ok: true };
}
function doScore(io, room, p, cat) {
  const t = room.turn;
  if (!t || t.uid !== p.id || t.scored) return { ok: false, error: "NOT_YOUR_TURN" };
  if (!Y.CATS.includes(cat)) return { ok: false, error: "BAD_CAT" };
  if (typeof p.scores[cat] === "number") return { ok: false, error: "FILLED" };
  if (t.rollsUsed === 0) return { ok: false, error: "ROLL_FIRST" };
  const ctx = scoreCtx(room, p, cat);
  const r = Y.scoreCategory(cat, t.dice, p, ctx);
  p.scores[cat] = r.score;
  t.scored = true;
  for (const id of r.capped || []) p.capUsed[id] = (p.capUsed[id] || 0) + 1;
  if (ctx.rewriteBonus) p.rewriteCat = null;
  const gains = [];
  // 증강으로 번 점수 (정통 점수와 차이). 상대가 건 세금은 증강 점수에서 빼지 않음
  if (room.mode === "augment") p.stats.augBonus += r.score - r.base + (ctx.taxed ? Math.min(r.base, 5 * ctx.taxed) : 0);
  // 배율 토글 소모
  for (const id of ["amplify", "explode"]) if (t.toggles[id]) { const a = augOf(p, id); if (a) { a.charges--; p.stats.used[id] = (p.stats.used[id] || 0) + 1; } }
  t.toggles = {};
  const c = [0, 0, 0, 0, 0, 0, 0]; for (const v of r.dice) c[v]++;
  const natural = c.some(x => x >= 5);
  if (natural || (cat === "yacht" && r.score > 0 && r.base > 0)) p.stats.yachts++;
  // 야추 연금: 이미 야추 칸 성공 → 또 야추가 나와 다른 칸에 기록
  if (natural && cat !== "yacht" && augOf(p, "yachtAnnuity") && (p.scores.yacht || 0) > 0) { p.extra += 50; p.stats.augBonus += 50; gains.push({ uid: p.id, amount: 50, reason: "🏦 야추 연금" }); }
  // 연속 보너스
  if (augOf(p, "streak")) {
    if (r.score > 0) { p.stats.streak++; if (p.stats.streak >= 3) { p.extra += 4; p.stats.augBonus += 4; gains.push({ uid: p.id, amount: 4, reason: `🔥 연속 ${p.stats.streak}번` }); } }
    else p.stats.streak = 0;
  }
  // 점수 도둑 (다른 사람) — 정통 규칙으로도 성공했을 때만
  if ((cat === "yacht" || cat === "largeStraight") && r.base > 0) {
    for (const o of room.players.values()) {
      if (o.id === p.id || o.left || !augOf(o, "thief") || o.stats.thief >= 2) continue;
      o.stats.thief++; o.extra += 15; o.stats.augBonus += 15;
      gains.push({ uid: o.id, amount: 15, reason: `🦝 점수 도둑 (${p.name}님 ${Y.CAT_LABEL[cat]})` });
    }
  }
  if (!p.stats.best || r.score > p.stats.best.score) p.stats.best = { cat, score: r.score };
  room.seq++;
  log(room, `${p.name}: ${Y.CAT_LABEL[cat]} ${r.score}점${ctx.toggles.explode ? " 💥×2" : ""}${ctx.toggles.amplify ? " 📢×1.5" : ""}${ctx.rewriteBonus ? " ✍️+15" : ""}`, p.id);
  for (const g of gains) log(room, `${g.reason} +${g.amount}`, g.uid);
  emitAll(io, room, "yacht:scored", { uid: p.id, cat, score: r.score, base: r.base, gains, total: Y.totalOf(p), seq: room.seq });
  return { ok: true, score: r.score, end: true };
}

/** 능동 증강 사용. payload: { id, die, die2, value, delta } */
function doAbility(io, room, p, pl) {
  const t = room.turn;
  if (room.mode !== "augment") return { ok: false, error: "NOT_AUGMENT_MODE" };
  if (!t || t.uid !== p.id || t.scored) return { ok: false, error: "NOT_YOUR_TURN" };
  const id = String(pl?.id || "");
  const a = augOf(p, id), def = Y.AUG[id];
  if (!a || !def) return { ok: false, error: "NO_AUG" };
  if (id === "retry") return doRoll(io, room, p, { retry: true });
  if (def.kind !== "active" && def.kind !== "toggle") return { ok: false, error: "PASSIVE" };
  if (def.kind === "toggle") {
    if (a.charges <= 0) return { ok: false, error: "NO_CHARGES" };
    t.toggles[id] = !t.toggles[id];
    return { ok: true, toggled: t.toggles[id] };
  }
  if (a.charges <= 0) return { ok: false, error: "NO_CHARGES" };
  const n = t.dice.length;
  const die = Number(pl?.die), die2 = Number(pl?.die2);
  const needRolled = ["flip", "nudge", "copyDie", "wild", "rewind"].includes(id);
  if (needRolled && t.rollsUsed === 0) return { ok: false, error: "ROLL_FIRST" };
  const okDie = (i) => Number.isInteger(i) && i >= 0 && i < n;
  let effect = { id };
  switch (id) {
    case "spareRoll": t.rollsLeft++; t.rollsMax++; break;
    case "flip": if (!okDie(die)) return { ok: false, error: "BAD_DIE" }; t.dice[die] = 7 - t.dice[die]; effect.dice = [die]; break;
    case "nudge": {
      const d = Number(pl?.delta);
      if (!okDie(die) || (d !== 1 && d !== -1)) return { ok: false, error: "BAD_DIE" };
      const v = t.dice[die] + d; if (v < 1 || v > 6) return { ok: false, error: "OUT_OF_RANGE" };
      t.dice[die] = v; effect.dice = [die]; break;
    }
    case "copyDie":
      if (!okDie(die) || !okDie(die2) || die === die2) return { ok: false, error: "BAD_DIE" };
      if (t.dice[die] === t.dice[die2]) return { ok: false, error: "SAME_VALUE" };
      t.dice[die2] = t.dice[die]; effect.dice = [die2]; effect.from = die; break;
    case "wild": {
      const v = Number(pl?.value);
      if (!okDie(die) || !Number.isInteger(v) || v < 1 || v > 6) return { ok: false, error: "BAD_DIE" };
      if (t.dice[die] === v) return { ok: false, error: "SAME_VALUE" };
      t.dice[die] = v; effect.dice = [die]; break;
    }
    case "rewind":
      t.dice = t.dice.map(() => 0); t.held = t.held.map(() => false);
      t.rollsLeft = t.rollsMax; t.rollsUsed = 0; t.steadyUsed = false; t.retryUsed = false;
      effect.rewind = true; break;
    case "rewrite": {
      const cat = String(pl?.cat || "");
      if (t.rollsUsed > 0) return { ok: false, error: "BEFORE_ROLL" };
      if (!Y.CATS.includes(cat) || typeof p.scores[cat] !== "number") return { ok: false, error: "BAD_CAT" };
      if (p.rewriteCat) return { ok: false, error: "REWRITE_PENDING" };
      effect.cat = cat; effect.old = p.scores[cat];
      delete p.scores[cat];
      p.rewriteCat = cat;
      if (p.stats.best?.cat === cat) p.stats.best = null;
      break;
    }
    case "jam": case "tax": {
      const o = nextOpponent(room, p.id);
      if (!o) return { ok: false, error: "NO_TARGET" };
      if (o.debuff[id] >= 2) return { ok: false, error: "MAX_STACK" };
      o.debuff[id]++; effect.target = o.id; effect.targetName = o.name; break;
    }
    default: return { ok: false, error: "NO_AUG" };
  }
  a.charges--;
  p.stats.used[id] = (p.stats.used[id] || 0) + 1;
  room.seq++;
  log(room, `${p.name}: ${def.icon} ${def.name}${effect.targetName ? ` → ${effect.targetName}` : ""}${effect.cat ? ` (${Y.CAT_LABEL[effect.cat]} ${effect.old}점 지움)` : ""}`, p.id);
  emitAll(io, room, "yacht:ability", { uid: p.id, ...effect, dice: t.dice, diceIdx: effect.dice || [], seq: room.seq });
  return { ok: true };
}

// ---------------- 자동 진행 (봇 · 시간초과 · 끊김) ----------------
function autoDecide(room, p) {
  const t = room.turn;
  if (t.rollsUsed === 0) return { act: "roll" };
  const best = Y.bestCategory(p, t.dice, scoreCtx(room, p));
  const great = best && (best.v >= 8 || ["yacht", "largeStraight"].includes(best.cat) && best.score > 0);
  if (t.rollsLeft > 0 && !great) return { act: "hold" };
  return { act: "score", cat: best.cat, score: best.score };
}
// 봇의 능동 증강 사용 — 한 걸음에 하나만. 썼으면 true
function botAbility(io, room, p, t) {
  if (room.mode !== "augment" || !p.isBot) return false;
  t.botUsed = t.botUsed || {};
  const can = (id) => { const a = augOf(p, id); return a && a.charges > 0 && !t.botUsed[id]; };
  const use = (pl) => { const r = doAbility(io, room, p, pl); t.botUsed[pl.id] = true; return r.ok; };
  if (t.rollsUsed === 0) {
    if (can("rewrite") && filled(p) >= 6 && !p.rewriteCat) {
      const z = Y.CATS.find(c => p.scores[c] === 0);
      if (z && use({ id: "rewrite", cat: z })) return true;
    }
    for (const id of ["jam", "tax"]) if (can(id) && Math.random() < 0.4 && nextOpponent(room, p.id) && use({ id })) return true;
    return false;
  }
  const ctx = scoreCtx(room, p);
  const val = () => Y.bestCategory(p, t.dice, ctx).v;
  // 주사위 바꾸기: 가장 크게 좋아지는 한 수
  for (const id of ["wild", "copyDie", "flip", "nudge"]) {
    if (!can(id)) continue;
    const b0 = val(); let best = null;
    for (let i = 0; i < t.dice.length; i++) {
      const orig = t.dice[i];
      const tries = id === "wild" ? [1, 2, 3, 4, 5, 6].map(v => ({ v, pl: { id, die: i, value: v } }))
        : id === "flip" ? [{ v: 7 - orig, pl: { id, die: i } }]
        : id === "nudge" ? [1, -1].filter(d => orig + d >= 1 && orig + d <= 6).map(d => ({ v: orig + d, pl: { id, die: i, delta: d } }))
        : t.dice.map((v, j) => ({ v, pl: { id, die: j, die2: i } })).filter(x => x.pl.die !== i);
      for (const x of tries) { if (x.v === orig) continue; t.dice[i] = x.v; const b = val(); t.dice[i] = orig; if (!best || b > best.b) best = { b, pl: x.pl }; }
    }
    if (best && best.b - b0 >= (id === "wild" ? 9 : 6) && use(best.pl)) return true;
  }
  if (t.rollsLeft <= 0) {
    const v = val();
    if (v < 2 && can("spareRoll") && use({ id: "spareRoll" })) return true;
    if (v < -4 && can("rewind") && use({ id: "rewind" })) return true;
  }
  return false;
}
function botStep(io, room, t) {
  room.botTimer = null;
  if (room.turn !== t || room.status !== "playing" || room.phase !== "turn") return;
  const p = room.players.get(t.uid);
  if (!p || (!p.isBot && p.connected)) return;
  if (botAbility(io, room, p, t)) { emitState(io, room); room.botTimer = setTimeout(() => botStep(io, room, t), rnd(...BOT_STEP_MS)); return; }
  // 재도전: 굴림 다 썼고 점수가 별로면
  if (p.isBot && t.rollsLeft <= 0 && t.rollsUsed > 0 && augOf(p, "retry") && !t.retryUsed && t.held.some(h => !h) && Y.bestCategory(p, t.dice, scoreCtx(room, p)).v < 4) {
    doRoll(io, room, p, { retry: true }); emitState(io, room);
    room.botTimer = setTimeout(() => botStep(io, room, t), rnd(...BOT_STEP_MS)); return;
  }
  const d = autoDecide(room, p);
  if (d.act === "roll") { doRoll(io, room, p); emitState(io, room); }
  else if (d.act === "hold") {
    t.held = Y.chooseHolds(p, t.dice);
    if (t.held.every(h => h)) t.held[t.dice.indexOf(Math.min(...t.dice))] = false;
    emitState(io, room);
    doRoll(io, room, p); emitState(io, room);
  } else {
    // 봇: 큰 점수에 배율 토글 켜기
    if (p.isBot && room.mode === "augment" && d.score >= 28) {
      for (const id of ["explode", "amplify"]) { const a = augOf(p, id); if (a && a.charges > 0 && !t.toggles.explode && !t.toggles.amplify) { t.toggles[id] = true; break; } }
    }
    const r = doScore(io, room, p, d.cat);
    if (r.end) { emitState(io, room); return setTimeout(() => { if (rooms.get(room.id) === room && room.turn === t) endTurn(io, room); }, 900); }
    emitState(io, room);
  }
  room.botTimer = setTimeout(() => botStep(io, room, t), rnd(...BOT_STEP_MS));
}
function scheduleBot(io, room, t) {
  room.botTimer = setTimeout(() => botStep(io, room, t), rnd(900, 1500));
}
function scheduleDcAuto(io, room, t) {
  room.dcTimer = setTimeout(() => { room.dcTimer = null; if (room.turn === t) botStep(io, room, t); }, DC_AUTO_MS);
}
function onTimeout(io, room, t) {
  if (room.turn !== t || room.status !== "playing" || room.phase !== "turn" || t.scored) return;
  const p = room.players.get(t.uid);
  if (!p) return;
  log(room, `⏱️ ${p.name}: 시간 초과 — 자동 기록`, p.id);
  if (t.rollsUsed === 0) doRoll(io, room, p);
  const best = Y.bestCategory(p, t.dice, scoreCtx(room, p));
  doScore(io, room, p, best.cat);
  emitState(io, room);
  setTimeout(() => { if (rooms.get(room.id) === room && room.turn === t) endTurn(io, room); }, 900);
}

function finishGame(io, room) {
  clearTimers(room);
  room.status = "ended"; room.phase = null; room.turn = null; room.endedAt = now();
  const rows = room.order.map(uid => room.players.get(uid)).filter(Boolean).map(p => ({
    id: p.id, name: p.name, avatar: p.avatar, isBot: p.isBot, left: p.left,
    total: Y.totalOf(p), scores: p.scores, upper: Y.upperSum(p), bonus: Y.upperSum(p) >= Y.upperBonusRule(p).at ? Y.upperBonusRule(p).amount : 0,
    extra: p.extra, yachts: p.stats.yachts, best: p.stats.best, augs: p.augs.map(a => a.id), augBonus: p.stats.augBonus,
  }));
  rows.sort((a, b) => Number(a.left) - Number(b.left) || b.total - a.total);
  let rank = 0, prev = null;
  rows.forEach((r, i) => { if (r.left) { r.rank = null; return; } if (prev === null || r.total !== prev) rank = i + 1; r.rank = rank; prev = r.total; });
  room.result = { mode: room.mode, rows, at: room.endedAt };
  log(room, `게임 끝! 1등 ${rows[0]?.name || "-"} (${rows[0]?.total ?? 0}점)`);
  emitAll(io, room, "yacht:end", room.result);
  emitState(io, room);
  if (room.endTimer) clearTimeout(room.endTimer);
  room.endTimer = setTimeout(() => { if (rooms.get(room.id) === room && room.status === "ended") deleteRoom(io, room, "ENDED_TTL"); }, ENDED_ROOM_MS);
}

// ---------------- 입장·퇴장 ----------------
function removeFromRoom(room, uid) {
  room.players.delete(uid);
  const i = room.order.indexOf(uid);
  if (i >= 0) { room.order.splice(i, 1); if (i < room.turnIdx) room.turnIdx--; if (room.turnIdx >= room.order.length) room.turnIdx = 0; }
  if (userRoom.get(uid) === room.id) userRoom.delete(uid);
}
function pickNewHost(room) {
  const h = room.order.map(u => room.players.get(u)).find(p => p && !p.isBot && !p.left && p.connected)
    || room.order.map(u => room.players.get(u)).find(p => p && !p.isBot && !p.left);
  if (h) room.hostUserId = h.id;
}
function leave(io, room, uid, why = "left") {
  const p = room.players.get(uid);
  if (!p) return;
  const wasHost = room.hostUserId === uid;
  if (room.status === "playing") {
    p.left = true; p.connected = false;
    if (userRoom.get(uid) === room.id) userRoom.delete(uid);
    log(room, `${p.name}님이 나갔어요`);
  } else {
    removeFromRoom(room, uid);
  }
  if (p.sockId) { const s = io.sockets.sockets.get(p.sockId); s?.leave(chan(room.id)); }
  emitAll(io, room, "yacht:notice", { k: why, name: p.name });
  if (humans(room).length === 0) return deleteRoom(io, room, "EMPTY");
  if (wasHost) pickNewHost(room);
  if (room.status === "playing") {
    if (room.phase === "pick") { if (!finishPick(io, room)) emitState(io, room); return; }
    if (room.turn?.uid === uid) return endTurn(io, room);
    if (activeIds(room).every(id => isDone(room.players.get(id)))) return finishGame(io, room);
  }
  emitState(io, room);
}

async function profileOf(supa, me, nick) {
  let name = nick, avatar = null;
  if (!me.isGuest) {
    try {
      const { data } = await supa.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
      if (data?.nickname) name = data.nickname; // 닉네임은 프로필 우선
      if (data?.avatar_url) avatar = data.avatar_url;
    } catch {}
  }
  let n = cleanNick(name, "");
  // 이름이 없거나 그냥 "게스트"면 구분되게 번호 붙임 (같은 방에 게스트 여럿)
  if (!n || n === "게스트") { let h = 0; for (const ch of String(me.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; n = (me.isGuest ? "게스트" : "플레이어") + String(h % 1000).padStart(3, "0"); }
  return { name: n, avatar };
}

function attachSocket(io, socket, room, p) {
  if (p.sockId && p.sockId !== socket.id) {
    const old = io.sockets.sockets.get(p.sockId);
    if (old) { old.emit("yacht:replaced", {}); old.leave(chan(room.id)); }
  }
  p.sockId = socket.id; p.connected = true; p.dcAt = 0;
  socket.join(chan(room.id));
  userRoom.set(p.id, room.id);
  checkEmpty(io, room);
}

// ---------------- 등록 ----------------
export function registerYacht(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;
    const myRoom = () => { const id = userRoom.get(me.id); const r = id ? rooms.get(id) : null; return r && r.players.has(me.id) ? r : null; };
    // 오류가 나도 응답은 꼭 보냄 (async 처리도 잡음 — 전엔 방 만들기 중 오류면 화면이 8초 동안 기다렸음)
    const guard = (fn) => (payload, cb) => {
      const reply = typeof cb === "function" ? cb : () => {};
      const fail = (e) => { console.error("[yacht]", e); try { reply({ ok: false, error: "INTERNAL" }); } catch {} };
      try { const r = fn(payload || {}, reply); if (r && typeof r.catch === "function") r.catch(fail); } catch (e) { fail(e); }
    };

    socket.on("yacht:createRoom", guard(async (pl, cb) => {
      { const f = createFlight("yacht", me.id, cb); if (!f) return; cb = f; }
      const old = myRoom(); if (old) leave(io, old, me.id);
      const { name, avatar } = await profileOf(supabaseAdmin, me, pl.nickname);
      const mode = pl.mode === "classic" ? "classic" : "augment";
      const maxPlayers = MAX_PLAYERS.includes(Number(pl.maxPlayers)) ? Number(pl.maxPlayers) : 4;
      const turnSec = TURN_SECS.includes(Number(pl.turnSec)) ? Number(pl.turnSec) : 60;
      const id = `yc_${now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      const room = {
        id, inviteCode: genCode(), hostUserId: me.id, status: "lobby", mode, maxPlayers, turnSec,
        isPublic: false, soloAi: pl.soloAi === true,
        players: new Map(), order: [], round: 0, turnIdx: 0, phase: null, pickIdx: -1, pickDeadline: null,
        turn: null, log: [], seq: 0, botSeq: 0, result: null, createdAt: now(),
      };
      rooms.set(id, room); invites.set(room.inviteCode, id);
      const p = newPlayer(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id });
      room.players.set(me.id, p); room.order.push(me.id);
      attachSocket(io, socket, room, p);
      cb({ ok: true, code: room.inviteCode, me: me.id, meta: META });
      emitState(io, room);
    }));

    socket.on("yacht:joinRoom", guard(async (pl, cb) => {
      const code = String(pl.code || "").trim();
      const room = rooms.get(invites.get(code));
      if (!room) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      const existing = room.players.get(me.id);
      if (existing && !existing.left) {
        attachSocket(io, socket, room, existing);
        if (room.status === "playing") log(room, `${existing.name}님이 돌아왔어요`);
        cb({ ok: true, code: room.inviteCode, me: me.id, meta: META, rejoined: true });
        emitAll(io, room, "yacht:notice", { k: "back", name: existing.name });
        emitState(io, room);
        // 끊긴 사이 대신 두던 것 멈춤 — 내 차례면 이어서 직접
        if (room.turn?.uid === me.id && room.dcTimer) { clearTimeout(room.dcTimer); room.dcTimer = null; }
        return;
      }
      if (room.soloAi) return cb({ ok: false, error: "ROOM_NOT_FOUND" });
      // 끝난 방(결과 화면)에도 들어올 수 있음 — 방장이 다시 하기를 누르면 같이 함
      if (room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      if (room.players.size >= room.maxPlayers) return cb({ ok: false, error: "ROOM_FULL" });
      const old = myRoom(); if (old && old !== room) leave(io, old, me.id);
      const { name, avatar } = await profileOf(supabaseAdmin, me, pl.nickname);
      // 프로필 읽는 사이 바뀌었는지 다시 확인
      if (rooms.get(room.id) !== room || room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      if (room.players.size >= room.maxPlayers) return cb({ ok: false, error: "ROOM_FULL" });
      if (room.players.has(me.id)) return cb({ ok: true, code: room.inviteCode, me: me.id, meta: META });
      const p = newPlayer(me.id, name, { avatar, isGuest: me.isGuest, sockId: socket.id });
      room.players.set(me.id, p); room.order.push(me.id);
      attachSocket(io, socket, room, p);
      cb({ ok: true, code: room.inviteCode, me: me.id, meta: META });
      emitAll(io, room, "yacht:notice", { k: "join", name });
      emitState(io, room);
    }));

    socket.on("yacht:setOpts", guard((pl, cb) => {
      const room = myRoom();
      if (!room) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      if (pl.mode === "classic" || pl.mode === "augment") room.mode = pl.mode;
      if (MAX_PLAYERS.includes(Number(pl.maxPlayers))) {
        if (Number(pl.maxPlayers) < room.players.size) return cb({ ok: false, error: "BELOW_CURRENT" });
        room.maxPlayers = Number(pl.maxPlayers);
      }
      if (pl.turnSec !== undefined && TURN_SECS.includes(Number(pl.turnSec))) room.turnSec = Number(pl.turnSec);
      if (typeof pl.isPublic === "boolean" && !room.soloAi) room.isPublic = pl.isPublic;
      cb({ ok: true }); emitState(io, room);
    }));

    socket.on("yacht:addBot", guard((pl, cb) => {
      const room = myRoom();
      if (!room) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      const want = Math.max(1, Math.min(7, Number(pl.count) || 1));
      let added = 0;
      while (added < want && room.players.size < room.maxPlayers) {
        room.botSeq++;
        const uid = `ybot_${room.id}_${room.botSeq}`;
        room.players.set(uid, newPlayer(uid, `🤖 주사위봇${room.botSeq}`, { isBot: true }));
        room.order.push(uid); added++;
      }
      if (!added) return cb({ ok: false, error: "ROOM_FULL" });
      cb({ ok: true }); emitState(io, room);
    }));

    socket.on("yacht:kick", guard((pl, cb) => {
      const room = myRoom();
      if (!room) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      const uid = String(pl.uid || "");
      const p = room.players.get(uid);
      if (!p || uid === me.id) return cb({ ok: false, error: "BAD_TARGET" });
      if (p.sockId) io.to(p.sockId).emit("yacht:kicked", {});
      leave(io, room, uid, "kicked");
      cb({ ok: true });
    }));

    socket.on("yacht:start", guard((pl, cb) => {
      const room = myRoom();
      if (!room) return cb({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb({ ok: false, error: "GAME_STARTED" });
      const ready = room.order.filter(uid => { const p = room.players.get(uid); return p && !p.left && (p.isBot || p.connected); });
      if (ready.length < 2) return cb({ ok: false, error: "NEED_2" });
      cb({ ok: true });
      startGame(io, room);
    }));

    // 게임 중 행동 — 처리 뒤 모두에게 상태
    // 게임 행동 빈도 제한 (1초에 15번) — 마구 보내면 방 전체에 상태가 쏟아짐
    let actWin = 0, actN = 0;
    const tooFast = () => { const t = now(); if (t - actWin > 1000) { actWin = t; actN = 0; } return ++actN > 15; };
    const act = (fn) => guard((pl, cb) => {
      if (tooFast()) return cb({ ok: false, error: "TOO_FAST" });
      const room = myRoom();
      if (!room || room.status !== "playing") return cb({ ok: false, error: "NOT_PLAYING" });
      const p = room.players.get(me.id);
      if (!p || p.left) return cb({ ok: false, error: "NOT_PLAYER" });
      const r = fn(room, p, pl);
      cb(r);
      if (r?.ok) {
        emitState(io, room);
        if (r.end) setTimeout(() => { if (rooms.get(room.id) === room && room.turn?.scored && room.turn.uid === p.id) endTurn(io, room); }, 900);
      }
    });
    socket.on("yacht:roll", act((room, p) => room.phase === "turn" ? doRoll(io, room, p) : { ok: false, error: "NOT_TURN_PHASE" }));
    socket.on("yacht:hold", act((room, p, pl) => room.phase === "turn" ? doHold(room, p, Number(pl.i)) : { ok: false, error: "NOT_TURN_PHASE" }));
    socket.on("yacht:score", act((room, p, pl) => room.phase === "turn" ? doScore(io, room, p, String(pl.cat || "")) : { ok: false, error: "NOT_TURN_PHASE" }));
    socket.on("yacht:ability", act((room, p, pl) => room.phase === "turn" ? doAbility(io, room, p, pl) : { ok: false, error: "NOT_TURN_PHASE" }));
    socket.on("yacht:pick", guard((pl, cb) => {
      const room = myRoom();
      if (!room || room.status !== "playing" || room.phase !== "pick") return cb({ ok: false, error: "NOT_PICK_PHASE" });
      const p = room.players.get(me.id);
      if (!p || p.left || p.picked) return cb({ ok: false, error: "ALREADY_PICKED" });
      if (pl.refresh) {
        if (p.refresh <= 0) return cb({ ok: false, error: "NO_REFRESH" });
        p.refresh--;
        p.offer = Y.rollOffer(room.pickIdx, p.augs.map(a => a.id));
        cb({ ok: true, offer: p.offer });
        return emitState(io, room);
      }
      const id = String(pl.id || "");
      if (!p.offer?.includes(id)) return cb({ ok: false, error: "NOT_OFFERED" });
      grantAug(room, p, id);
      cb({ ok: true });
      if (!finishPick(io, room)) emitState(io, room);
    }));

    socket.on("yacht:leaveRoom", guard((pl, cb) => {
      const room = myRoom();
      if (room) leave(io, room, me.id);
      socket.leave(room ? chan(room.id) : "");
      cb({ ok: true });
    }));

    socket.on("yacht:sync", guard((pl, cb) => {
      const room = myRoom();
      // 방에 없어도 증강 도감용 정의는 줌 (시작 화면 📖 도감)
      if (!room) return cb({ ok: false, error: "NOT_IN_ROOM", meta: META });
      cb({ ok: true, state: publicRoom(room, me.id), meta: META });
    }));

    socket.on("disconnect", () => {
      const room = myRoom();
      if (!room) return;
      const p = room.players.get(me.id);
      if (!p || p.sockId !== socket.id) return;
      p.connected = false; p.dcAt = now();
      emitAll(io, room, "yacht:notice", { k: "dc", name: p.name });
      if (room.status === "lobby" || room.status === "ended") {
        setTimeout(() => {
          if (rooms.get(room.id) !== room || room.status === "playing") return;
          const q = room.players.get(me.id);
          if (q && !q.connected && q.dcAt && now() - q.dcAt >= LOBBY_DC_MS - 50) leave(io, room, me.id);
        }, LOBBY_DC_MS);
      } else if (room.status === "playing") {
        if (room.hostUserId === me.id) pickNewHost(room);
        if (room.phase === "pick" && !p.picked) { autoPick(room, p); if (finishPick(io, room)) { checkEmpty(io, room); return; } }
        if (room.phase === "turn" && room.turn?.uid === me.id && !room.dcTimer && !room.botTimer) scheduleDcAuto(io, room, room.turn);
      }
      checkEmpty(io, room);
      emitState(io, room);
    });
  });
}

// 화면에 한 번 보내는 정의 (증강 설명·칸 이름)
const META = {
  cats: Y.CATS, upper: Y.UPPER, catLabel: Y.CAT_LABEL, rarity: Y.RARITY, pickRounds: Y.PICK_ROUNDS,
  augs: Y.AUGMENTS.map(({ id, rarity, icon, name, kind, charges, target, desc, cond }) => ({ id, rarity, icon, name, kind, charges: charges ?? null, target: target || null, desc, cond: cond || null })),
};

addPublicRooms("yacht", rooms);
export const _yachtTest = { rooms, invites, userRoom };
