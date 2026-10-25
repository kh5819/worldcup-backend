// =========================
// DUO GAME ZONE — 인생게임 멀티 (서버) v2: 1살부터 사망까지
// 기존 worldcup/quiz/tier 멀티 시스템과 완전 격리.
// - 별도 Map(lifegameRooms) / 별도 invite code Map / 'lifegame:*' 이벤트 prefix
// - socket.io room name = `lifegame:${roomId}`
// - v2: 모두가 각자의 인생을 산다. 나이는 함께 먹고(한 해 = 한 라운드), 사건이 있는 사람만 동시에 선택.
//   코어(lifegame-core.js)·데이터는 프론트가 원본 → scripts/sync-lifegame-data.js 로 복사
// =========================

import * as LEG from "./lifegame-data.js";
import { buildLife, MINI_AGES } from "./lifegame-life-data.js";
import { createCore, MAX_AGE } from "./lifegame-core.js";

import {
  startMinigame, handleMiniAct, recheckMinigame, abortMinigame, isMinigameActive,
} from "./lifegame-minigames.js";

const core = createCore(buildLife(LEG));
const STAT_DEFS = core.STAT_DEFS;
const SYS = core.SYS;              // v3: 기억·관계·목표·시대·업적 + 플레이어 상호작용
const SOCIAL_CHANCE = 0.3;         // 해마다 두 사람 사이에 인연 제안이 생길 확률
const RIVAL_CHANCE = 0.12;         // 같은 직업 둘이 맞붙을 확률(해마다, 같은 쌍은 3년에 한 번)
const RIVAL_CAREERS = new Set(["politics", "writer", "idol", "athlete", "gamer", "streamer", "business", "artist", "lawyer", "doctor", "developer", "corporate"]);
const INFLUENCE_CHANCE = 0.18;     // 직업이 다른 사람에게 닿을 확률(의사·변호사·유튜버·정치인)

// ===== Room storage =====
const lifegameRooms = new Map();      // roomId → room
const lifegameInvites = new Map();    // inviteCode → roomId
const lifegameUserRoom = new Map();   // userId → roomId (단일 방 제약)

// ===== Constants =====
const MIN_PLAYERS = 2;
const MAX_PLAYERS_HARD_CAP = 8;
const ALLOWED_TURN_SECS = [5, 10, 15, 20, 30];
const EMPTY_ROOM_TTL_MS = 30_000;
const BIRTH_MS = 7000;          // 탄생 카드 보는 시간
const YEAR_MS = 1300;           // 아무 일 없는 해
const YEAR_MS_NOTABLE = 2600;   // 운명·마일스톤·사망이 있던 해
const RESULT_HOLD_MS = 2600;    // 모두 고른 뒤 결과 보여 주는 시간
const MINI_MONEY_MUL = 20;      // 미니게임 돈 보상(구 단위) → 만원

// ===== Utils =====
function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!lifegameInvites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}

function clampStat(key, val) {
  if (key === "money") return Math.round(val);
  return Math.max(0, Math.min(100, val));
}

function lobbyStats() {
  const s = {};
  for (const d of STAT_DEFS) s[d.key] = d.initial;
  return s;
}

function newPlayerState(name, isGuest, avatarUrl, gender, recent) {
  return {
    ready: false,
    recent: Array.isArray(recent) ? recent.slice(0, 12).map(x => String(x).slice(0, 40)) : [],
    name: String(name || "익명").slice(0, 20),
    isGuest: !!isGuest,
    avatar_url: avatarUrl || null,
    gender: gender || null, // 'M' | 'F' | 'X' | null
    joinedAt: Date.now(),
    connected: true,
    stats: lobbyStats(),    // 게임 시작 후엔 life.stats 와 같은 객체를 가리킨다(미니게임 보상이 그대로 반영)
    life: null,
    finished: false,
  };
}

function startLifeFor(p) {
  p.life = core.createPlayer(p.name, { gender: p.gender, recent: p.recent });
  p.stats = p.life.stats;
  p.finished = false;
}

// ===== 공개용 직렬화 =====
function publicLife(L) {
  if (!L) return null;
  return {
    age: L.age, alive: L.alive, deathAge: L.deathAge, cause: L.cause,
    housing: L.housing, job: L.job ? { title: L.job.title, salary: L.job.salary } : null,
    careerTitle: L.careerTitle || null, careerYears: L.careerYears,
    spouse: L.spouse ? { name: L.spouse.name, bond: L.spouse.bond, since: L.spouse.since } : null,
    kids: L.kids.map(k => ({ name: k.name, born: k.born, gender: k.gender })),
    pets: (L.pets || []).map(x => ({ kind: x.kind, breed: x.breed, name: x.name, born: x.born, startAge: x.startAge || 0, alive: x.alive, diedAt: x.diedAt ?? null })),
    birth: L.birth || null,
    flags: Array.from(L.flags),
    routes: Array.from(L.routes),
    relations: {
      romance: L.relations?.romance || null,
      friends: { ...(L.relations?.friends || {}) },
      foes: [...(L.relations?.foes || [])],
    },
    ending: L.ending && !L.alive ? endingPublic(L.ending) : null,
    titles: !L.alive ? (L.titles || []) : [],
    // v3
    career: L.career || null, careerStep: L.careerStep || 0, edu: L.edu || null, birthYear: L.birthYear || null,
    careerHist: (L.careerHist || []).map(h => ({ key: h.key, step: h.step, from: h.from, to: h.to, state: h.state, why: h.why })),
    careerSince: L.careerSince ?? null,
    people: core.peopleView(L), goal: core.goalView(L), achv: (L.achv || []).slice(),
  };
}

function endingPublic(e) {
  return e ? { id: e.id, title: e.title, emoji: e.emoji, badge: e.badge, rarity: e.rarity, quote: e.quote } : null;
}

function publicPlayer(userId, p) {
  if (!p) return null;
  return {
    userId,
    name: p.name,
    isGuest: p.isGuest,
    avatar_url: p.avatar_url || null,
    gender: p.gender || null,
    connected: p.connected,
    ready: !!p.ready,
    stats: { ...p.stats },
    finished: p.finished,
    life: publicLife(p.life),
  };
}

function publicRoom(room) {
  return {
    id: room.id,
    v: 2,
    inviteCode: room.inviteCode,
    hostUserId: room.hostUserId,
    status: room.status,
    maxPlayers: room.maxPlayers,
    turnTimeSec: room.turnTimeSec,
    minigames: room.minigames !== false,
    year: room.year || 0,
    maxAge: MAX_AGE,
    miniAges: MINI_AGES,
    deadline: room.deadline || null,
    pendingUserIds: room.pending ? [...room.pending.keys()] : [],
    world: room.world ? core.worldView(room.world) : null,
    social: room.social ? socialPublic(room.social) : null,
    lastEntries: room.lastEntries || [],
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
  };
}

// ===== 타이머 =====
function clearYearTimer(room) {
  if (room.yearTimer) { clearTimeout(room.yearTimer); room.yearTimer = null; }
}
function clearEmptyRoomTimer(room) {
  if (room.emptyRoomTimer) { clearTimeout(room.emptyRoomTimer); room.emptyRoomTimer = null; }
}
/** 게임 흐름용 지연 실행 — 게임이 바뀌면(재시작·종료) 무효 */
function later(room, fn, ms) {
  const gen = room.gen;
  clearYearTimer(room);
  room.yearTimer = setTimeout(() => {
    room.yearTimer = null;
    if (room.status !== "playing" || room.gen !== gen) return;
    fn();
  }, ms);
}

function deleteRoom(io, room, reason = "UNKNOWN") {
  abortMinigame(room);
  clearYearTimer(room);
  clearEmptyRoomTimer(room);
  lifegameRooms.delete(room.id);
  lifegameInvites.delete(room.inviteCode);
  for (const uid of room.playerOrder) {
    if (lifegameUserRoom.get(uid) === room.id) lifegameUserRoom.delete(uid);
  }
  io.to(socketRoomName(room.id)).emit("lifegame:roomClosed", { reason });
  io.in(socketRoomName(room.id)).socketsLeave(socketRoomName(room.id));
  console.log(`[lifegame] room ${room.id} deleted: ${reason}`);
}

function socketRoomName(roomId) { return `lifegame:${roomId}`; }
function userRoomName(uid) { return `lifegame:u:${uid}`; }
/** 본인에게만 */
function emitTo(io, uid, ev, payload) { io.to(userRoomName(uid)).emit(ev, payload); }
/** 방 전체(그 사람 빼고) — 비공개 선택 결과는 공개 시점에 다른 사람에게 */
function emitOthers(io, room, uid, ev, payload) {
  const ch = io.to(socketRoomName(room.id));
  (typeof ch.except === "function" ? ch.except(userRoomName(uid)) : ch).emit(ev, payload);
}

function broadcastRoomState(io, room) {
  io.to(socketRoomName(room.id)).emit("lifegame:roomState", publicRoom(room));
}

// ===== 게임 흐름 =====
function aliveIds(room) {
  return room.playerOrder.filter(uid => room.players.get(uid)?.life?.alive);
}

function startGame(io, room) {
  abortMinigame(room);
  room.status = "playing";
  room.gen = (room.gen || 0) + 1;
  room.year = 0;
  room.pending = new Map();
  room.deadline = null;
  room.lastEntries = [];
  room.miniUsed = new Set();
  room.world = core.createWorld();          // v3: 모두 같은 해에 태어나 같은 시대를 산다
  room.social = null; room.pairCool = {}; room.partners = []; room.mpQueue = {}; room.reveal = [];
  const first = {};
  const births = {};
  for (const uid of room.playerOrder) {
    const p = room.players.get(uid);
    if (!p) continue;
    p.ready = false;
    startLifeFor(p);
    const rec = core.beginLife(p.life, room.world);
    first[uid] = rec;
    births[uid] = rec.birth;
  }
  io.to(socketRoomName(room.id)).emit("lifegame:gameStart", {
    v: 3, maxAge: MAX_AGE, miniAges: MINI_AGES, birthMs: BIRTH_MS, births, world: core.worldView(room.world),
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
  });
  later(room, () => runYear(io, room, first), BIRTH_MS);
}

/** 한 해 진행. first = 1살(탄생 직후) 기록 */
function runYear(io, room, first = null) {
  if (room.status !== "playing") return;
  room.year += 1;
  room.pending = new Map();
  if (!first) consistencySweep(room);
  const entries = [];
  let notable = false;
  for (const uid of room.playerOrder) {
    const p = room.players.get(uid);
    if (!p?.life?.alive) continue;
    const rec = first ? first[uid] : core.advanceYear(p.life);
    if (!rec) continue;
    syncPlayerSpouse(room, uid);
    const e = {
      userId: uid, age: p.life.age,
      milestone: rec.milestone || null,
      quiet: rec.quiet || null,
      lines: rec.lines || [],
      lineKeys: rec.lineKeys || [],
      fate: rec.fate || null,
      net: p.life.age >= 19 && rec.economy ? rec.economy.net : null,
      achv: rec.achv || [], notices: rec.notices || [], news: rec.news || [], goalNew: rec.goalNew || null, goalDone: rec.goalDone || null,
      mp: room.mpQueue?.[uid] || [],
    };
    if (room.mpQueue) room.mpQueue[uid] = [];
    if (rec.milestone || rec.fate) notable = true;
    if (rec.death) {
      e.death = { age: rec.death.age, cause: rec.death.cause, ending: endingPublic(rec.death.ending) };
      p.finished = true;
      notable = true;
      onPlayerDeath(room, uid);
    } else if (rec.event) {
      e.event = core.publicEvent(p.life, rec.event);
      room.pending.set(uid, rec.event);
    }
    entries.push(e);
  }
  // v3: 사람 사이의 일(동의 필요 없는 것) — 같은 직업 맞대결·직업의 영향·동업 정산
  if (!first) interactYear(room, entries);
  room.lastEntries = entries;
  const turnMs = room.turnTimeSec * 1000;
  room.reveal = [];
  if (!first) planSocial(room, turnMs);
  room.deadline = room.pending.size || room.social ? Date.now() + turnMs : null;

  io.to(socketRoomName(room.id)).emit("lifegame:year", {
    year: room.year,
    entries,
    deadline: room.deadline,
    turnSec: room.turnTimeSec,
    world: core.worldView(room.world),
    social: room.social ? socialPublic(room.social) : null,
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
  });

  // 나만 받는 기록(기억) — 다른 사람에겐 보내지 않는다
  for (const uid of room.playerOrder) { const L = room.players.get(uid)?.life; if (L) emitTo(io, uid, "lifegame:me", { year: room.year, memories: (L.memories || []).slice(-80) }); }

  // 연결 끊긴 사람의 사건은 바로 자동 선택
  for (const uid of [...room.pending.keys()]) {
    if (!room.players.get(uid)?.connected) autoPick(io, room, uid);
  }
  if (room.status !== "playing") return;
  if (!room.pending.size && !room.social) {
    if (!aliveIds(room).length) return later(room, () => endGame(io, room), YEAR_MS_NOTABLE);
    return later(room, () => afterYear(io, room), notable ? YEAR_MS_NOTABLE : YEAR_MS);
  }
  // 제한 시간: 사건은 기본 선택, 인연 제안은 '거절'(안전한 기본값)
  later(room, () => {
    for (const uid of [...room.pending.keys()]) autoPick(io, room, uid, true);
    if (room.social) resolveSocial(io, room, true);
    maybeAdvance(io, room);
  }, turnMs + 300);
}

// ===== v3: 플레이어 상호작용 =====
const pairKey = (a, b) => [a, b].sort().join("|");
function socialPublic(sc) {
  return { id: sc.id, kind: sc.kind, a: sc.a, b: sc.b, aName: sc.aName, bName: sc.bName, deadline: sc.deadline, answered: Object.keys(sc.answers) };
}
/** 해마다 한 쌍에게 인연 제안(친구·연인·결혼·동업) — 둘 다 동의해야 이뤄진다 */
function planSocial(room, turnMs) {
  room.social = null;
  const alive = aliveIds(room).filter(uid => room.players.get(uid)?.connected);
  if (alive.length < 2 || Math.random() > SOCIAL_CHANCE) return;
  const pairs = [];
  for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
    const a = alive[i], b = alive[j], k = pairKey(a, b);
    if (room.pairCool[k] != null && room.year - room.pairCool[k] < 3) continue;
    const pa = room.players.get(a).life, pb = room.players.get(b).life;
    const kind = SYS.proposalFor(pa, pb, a, b);
    if (kind) pairs.push({ a, b, kind });
  }
  if (!pairs.length) return;
  const pk = pairs[Math.floor(Math.random() * pairs.length)];
  room.pairCool[pairKey(pk.a, pk.b)] = room.year;
  room.social = { id: `s${room.year}_${Math.random().toString(36).slice(2, 7)}`, kind: pk.kind, a: pk.a, b: pk.b,
    aName: room.players.get(pk.a).name, bName: room.players.get(pk.b).name, deadline: Date.now() + turnMs, answers: {}, year: room.year };
}
function resolveSocial(io, room, timedOut = false) {
  const sc = room.social;
  if (!sc) return;
  const A = room.players.get(sc.a), B = room.players.get(sc.b);
  const ok = !timedOut && sc.answers[sc.a] === true && sc.answers[sc.b] === true && A?.life?.alive && B?.life?.alive;
  const lines = {};
  if (ok) {
    const r = sc.kind === "marry" ? SYS.marry(A.life, B.life, [sc.a, sc.b]) : SYS.link(A.life, B.life, sc.kind, [sc.a, sc.b]);
    lines[sc.a] = [r[0]]; lines[sc.b] = [r[1]];
    if (sc.kind === "partner") room.partners.push({ a: sc.a, b: sc.b, since: room.year });
    for (const uid of [sc.a, sc.b]) { const L = room.players.get(uid).life; L.achv && SYS.achvCheck(L); }
  } else {
    if (A?.life) lines[sc.a] = [{ k: "mp_declined", v: { who: sc.bName } }];
    if (B?.life) lines[sc.b] = [{ k: "mp_declined", v: { who: sc.aName } }];
  }
  room.social = null;
  io.to(socketRoomName(room.id)).emit("lifegame:socialResult", {
    id: sc.id, kind: sc.kind, ok, timedOut: !!timedOut, a: sc.a, b: sc.b, aName: sc.aName, bName: sc.bName, lines,
    players: room.playerOrder.map(uid => publicPlayer(uid, room.players.get(uid))),
  });
}
/** 사건·제안이 다 끝났으면: 숨겨 둔 선택 결과를 다른 사람에게 공개하고 다음 해로 */
function maybeAdvance(io, room) {
  if (room.status !== "playing" || room.pending.size || room.social || isMinigameActive(room)) return;
  room.deadline = null;
  for (const r of room.reveal || []) emitOthers(io, room, r.userId, "lifegame:choiceResult", { ...r, reveal: true });
  room.reveal = [];
  later(room, () => afterYear(io, room), RESULT_HOLD_MS);
}
const pushMp = (room, uid, line) => { if (!line) return; (room.mpQueue[uid] ||= []).push(line); };
/** 누군가 세상을 떠남 → 그 사람과 이어진 다른 사람들의 인생에 반영(남은 사람의 인생은 계속) */
function onPlayerDeath(room, deadUid) {
  const dp = room.players.get(deadUid);
  if (!dp?.life) return;
  for (const uid of room.playerOrder) {
    if (uid === deadUid) continue;
    const L = room.players.get(uid)?.life;
    if (!L?.alive) continue;
    pushMp(room, uid, SYS.playerDied(L, deadUid, dp.name));
  }
  room.partners = (room.partners || []).filter(x => x.a !== deadUid && x.b !== deadUid);
  if (room.social && (room.social.a === deadUid || room.social.b === deadUid)) room.social.answers[deadUid] = false;
}
/** 플레이어끼리 결혼했는데 한쪽 인생에서 이혼이 일어났으면 상대도 이혼 처리(결혼은 둘의 것) */
function syncPlayerSpouse(room, uid) {
  const L = room.players.get(uid)?.life;
  const se = L?.spouseEnd;
  if (!se || !se.pid || se.synced || se.why !== "divorce") return;
  se.synced = true;
  const O = room.players.get(se.pid);
  if (O?.life?.alive) pushMp(room, se.pid, SYS.playerDivorced(O.life, uid, room.players.get(uid).name));
}
/** 해마다 플레이어 사이 관계의 앞뒤를 맞춘다: 떠난 사람은 '고인', 한쪽이 끝낸 연애·결혼은 양쪽 다 끝 */
function consistencySweep(room) {
  for (const uid of room.playerOrder) {
    const P = room.players.get(uid), L = P?.life;
    if (!L?.alive) continue;
    for (const x of (L.people || []).filter(y => y.pid && y.status !== "dead")) {
      const O = room.players.get(x.pid);
      if (!O?.life || !O.life.alive) pushMp(room, uid, SYS.playerDied(L, x.pid, O?.name || x.name));
    }
    if (L.spouse?.pid) { const O = room.players.get(L.spouse.pid); if (O?.life?.alive && O.life.spouse?.pid !== uid) pushMp(room, uid, SYS.playerDivorced(L, L.spouse.pid, O.name)); }
    if (L.romancePid) {
      const O = room.players.get(L.romancePid);
      const still = O?.life?.alive && O.life.romancePid === uid && O.life.relations?.romance === P.name && L.relations.romance === O.name;
      const married = L.spouse?.pid === L.romancePid;
      if (!still && !married) {
        pushMp(room, uid, SYS.playerBrokeUp(L, L.romancePid, O?.name || ""));
      }
    }
  }
}
/** 동의가 필요 없는 일: 같은 직업 맞대결, 의사·변호사·유튜버·정치인의 영향, 동업 손익 */
function interactYear(room, entries) {
  const byUid = Object.fromEntries(entries.map(e => [e.userId, e]));
  const add = (uid, line) => { const e = byUid[uid]; if (e) (e.mp ||= []).push(line); };
  const alive = aliveIds(room);
  const L = uid => room.players.get(uid).life;
  // 동업
  for (const pr of room.partners || []) {
    if (!alive.includes(pr.a) || !alive.includes(pr.b)) continue;
    const amt = SYS.partnerYear(L(pr.a), L(pr.b), room.world);
    const k = amt >= 0 ? "mp_partner_profit" : "mp_partner_loss";
    add(pr.a, { k, v: { who: room.players.get(pr.b).name }, money: amt }); add(pr.b, { k, v: { who: room.players.get(pr.a).name }, money: amt });
    if (amt < -800 && Math.random() < 0.3) { pr.ended = true; add(pr.a, { k: "mp_partner_end", v: { who: room.players.get(pr.b).name } }); add(pr.b, { k: "mp_partner_end", v: { who: room.players.get(pr.a).name } }); }
  }
  room.partners = (room.partners || []).filter(x => !x.ended);
  // 같은 직업 맞대결
  for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
    const a = alive[i], b = alive[j], pa = L(a), pb = L(b);
    const rk = "r|" + pairKey(a, b);
    if (!pa.career || pa.career !== pb.career || !RIVAL_CAREERS.has(pa.career) || pa.age < 18 || Math.random() > RIVAL_CHANCE) continue;
    if (room.pairCool[rk] != null && room.year - room.pairCool[rk] < 3) continue;
    room.pairCool[rk] = room.year;
    for (const [me, ot, oid] of [[pa, pb, b], [pb, pa, a]]) if (!SYS.linkOf(me, oid)) SYS.link(me, ot, "rival", [a === oid ? b : a, oid]);
    const aWin = SYS.rivalry(pa, pb);
    add(a, { k: aWin ? "mp_rival_win" : "mp_rival_lose", v: { who: room.players.get(b).name } });
    add(b, { k: aWin ? "mp_rival_lose" : "mp_rival_win", v: { who: room.players.get(a).name } });
  }
  // 직업의 영향
  for (const a of alive) {
    const pa = L(a);
    if (!pa.career || Math.random() > INFLUENCE_CHANCE) continue;
    const others = alive.filter(b => b !== a);
    if (!others.length) continue;
    const b = others[Math.floor(Math.random() * others.length)], pb = L(b);
    const an = room.players.get(a).name, bn = room.players.get(b).name;
    if (pa.career === "doctor" && pa.careerStep >= 2 && pb.stats.health < 45) {
      pb.stats.health = Math.min(100, pb.stats.health + 8); pa.stats.social = Math.min(100, pa.stats.social + 2);
      add(b, { k: "mp_heal", v: { who: an } }); add(a, { k: "mp_healer", v: { who: bn } });
    } else if (pa.career === "lawyer" && pa.careerStep >= 1 && pb.stats.money < 0) {
      pb.stats.money += 800; pa.stats.social = Math.min(100, pa.stats.social + 2);
      add(b, { k: "mp_legal", v: { who: an } }); add(a, { k: "mp_legaler", v: { who: bn } });
    } else if (pa.career === "streamer" && pa.careerStep >= 2) {
      pb.stats.internet = Math.min(100, pb.stats.internet + 4);
      add(b, { k: "mp_shout", v: { who: an } }); add(a, { k: "mp_shouter", v: { who: bn } });
    } else if (pa.career === "politics" && pa.careerStep >= 3) {
      for (const o of others) { L(o).stats.money += 300; add(o, { k: "mp_policy", v: { who: an } }); }
      add(a, { k: "mp_policer", v: {} });
    }
  }
}

function autoPick(io, room, uid, timedOut = false) {
  const p = room.players.get(uid);
  const ev = room.pending.get(uid);
  if (!p || !ev) return;
  const list = core.choicesFor(p.life, ev);
  const c = list[Math.floor(Math.random() * list.length)];
  applyPick(io, room, uid, c.id, timedOut);
}

function applyPick(io, room, uid, choiceId, timedOut) {
  const p = room.players.get(uid);
  const ev = room.pending.get(uid);
  if (!p || !ev) return false;
  const res = core.applyChoice(p.life, ev, choiceId);
  if (!res) return false;
  room.pending.delete(uid);
  if (res.death) { p.finished = true; onPlayerDeath(room, uid); }
  syncPlayerSpouse(room, uid);
  const payload = ({
    year: room.year,
    userId: uid,
    name: p.name,
    timedOut: !!timedOut,
    eventId: ev.id,
    eventEmoji: ev.emoji,
    eventCat: core.categoryOf(ev),
    eventMajor: core.isMajor(ev),
    eventTitle: core.fill(p.life, ev.title),
    choiceId: res.choiceId,
    choiceText: res.choiceText,
    choiceEmoji: res.choiceEmoji,
    narrative: res.narrative,
    deltas: res.deltas,
    grade: res.grade,
    src: res.src || null,
    death: res.death ? { age: res.death.age, cause: res.death.cause, ending: endingPublic(res.death.ending) } : null,
    sys: res.sys || null,
    player: publicPlayer(uid, p),
  });
  emitTo(io, uid, "lifegame:choiceResult", payload);       // 내 결과는 바로
  (room.reveal ||= []).push(payload);                       // 다른 사람에겐 모두 고른 뒤 공개(비공개 선택)
  io.to(socketRoomName(room.id)).emit("lifegame:picked", { year: room.year, userId: uid, pendingUserIds: [...room.pending.keys()] });
  maybeAdvance(io, room);
  return true;
}

function afterYear(io, room) {
  if (room.status !== "playing") return;
  const alive = aliveIds(room);
  if (!alive.length) return endGame(io, room);
  if (room.minigames !== false && MINI_AGES.includes(room.year)) {
    const started = startMinigame({
      room,
      emit: (ev, payload) => io.to(socketRoomName(room.id)).emit(ev, payload),
      clampStat,
      eligible: (uid) => !!room.players.get(uid)?.life?.alive,
      minPlayers: 1,
      moneyMul: MINI_MONEY_MUL,
      onFinish: () => {
        if (room.status !== "playing") return;
        broadcastRoomState(io, room);
        runYear(io, room);
      },
    });
    if (started) return;
  }
  runYear(io, room);
}

function rankPlayers(room) {
  consistencySweep(room);
  const arr = room.playerOrder.map(uid => {
    const p = room.players.get(uid);
    const L = p.life;
    if (L && !L.ending) core.computeEnding(L);
    const highlights = (L?.history || []).filter(h => h.grade === "crit" || h.grade === "bad" || h.fate || /결혼|아기|프러포즈|첫 직장|입영|수능|투병|손주|이혼/.test(h.eventTitle || "")).slice(-10)
      .map(h => ({ age: h.age, emoji: h.eventEmoji, title: h.eventTitle, choice: h.choiceText, grade: h.grade, src: h.src || null }));
    return {
      userId: uid,
      name: p.name,
      avatar_url: p.avatar_url,
      gender: p.gender || null,
      score: L ? core.lifeScore(L) : 0,
      stats: { ...p.stats },
      ending: endingPublic(L?.ending),
      titles: L?.titles || [],
      analysis: L?.analysis || [],
      analysisKeys: L?.analysisKeys || null,
      report: L ? core.lifeReport(L) : null,
      achvFinal: L?.finalAchv || [],
      memories: (L?.memories || []).filter(m => m.w >= 2).slice(-40),
      life: publicLife(L),
      highlights,
    };
  });
  arr.sort((a, b) => b.score - a.score);

  const cats = [];
  if (arr.length) {
    const top = (f, asc) => [...arr].sort((a, b) => asc ? f(a) - f(b) : f(b) - f(a))[0];
    const age = r => r.life?.deathAge ?? r.life?.age ?? 0;
    const a1 = top(age);
    cats.push({ key: "age", emoji: "🐢", label: "최장수", winnerUserId: a1.userId, value: `${age(a1)}세` });
    const m1 = top(r => r.stats.money);
    cats.push({ key: "money", emoji: "💰", label: "최고 부자", winnerUserId: m1.userId, value: m1.stats.money, money: true });
    const h1 = top(r => r.stats.happy);
    cats.push({ key: "happy", emoji: "❤️", label: "가장 행복", winnerUserId: h1.userId, value: h1.stats.happy });
    const k1 = top(r => r.life?.kids?.length || 0);
    if ((k1.life?.kids?.length || 0) > 0) cats.push({ key: "family", emoji: "👨‍👩‍👧", label: "대가족", winnerUserId: k1.userId, value: `자녀 ${k1.life.kids.length}명` });
    const w = top(r => r.score, true);
    cats.push({ key: "worst", emoji: "🪦", label: "가장 파란만장", winnerUserId: w.userId, value: w.score });
  }
  return { ranking: arr, categories: cats };
}

function endGame(io, room) {
  if (room.status !== "playing") return;
  room.status = "ended";
  room.gen = (room.gen || 0) + 1;
  abortMinigame(room);
  clearYearTimer(room);
  room.pending = new Map();
  room.deadline = null;

  for (const uid of room.playerOrder) {
    const p = room.players.get(uid);
    if (p?.life?.alive) core.die(p.life, "natural");      // 안전망(최대 나이 도달 등)
    if (p) p.finished = true;
  }

  const { ranking, categories } = rankPlayers(room);
  io.to(socketRoomName(room.id)).emit("lifegame:gameEnd", { v: 2, ranking, categories, years: room.year });

  // 결과 카드 충분히 읽고 친구들이랑 얘기할 시간 (10분)
  setTimeout(() => {
    if (room.status === "ended") deleteRoom(io, room, "GAME_END_TTL");
  }, 10 * 60_000);
}

// ===== 핸들러 등록 =====
export function registerLifegame(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;
    try { socket.join(userRoomName(me.id)); } catch {}

    // ===== createRoom =====
    socket.on("lifegame:createRoom", async (payload, cb) => {
      try {
        if (me.isGuest) return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });
        if (lifegameUserRoom.has(me.id)) {
          const old = lifegameRooms.get(lifegameUserRoom.get(me.id));
          if (old) leavePlayer(io, old, me.id, /*forced*/ true);
        }

        const turnSec = ALLOWED_TURN_SECS.includes(Number(payload?.turnTimeSec))
          ? Number(payload.turnTimeSec) : 15;
        const maxPlayers = Math.min(MAX_PLAYERS_HARD_CAP, Math.max(MIN_PLAYERS, Number(payload?.maxPlayers) || 6));

        const roomId = `lg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const inviteCode = genInviteCode();

        const room = {
          id: roomId,
          inviteCode,
          hostUserId: me.id,
          status: "lobby",  // 'lobby' | 'playing' | 'ended'
          maxPlayers,
          turnTimeSec: turnSec,
          minigames: true,
          createdAt: Date.now(),

          players: new Map(),
          playerOrder: [],

          gen: 0,
          year: 0,
          pending: new Map(),
          deadline: null,
          lastEntries: [],
          yearTimer: null,
          emptyRoomTimer: null,
        };
        lifegameRooms.set(roomId, room);
        lifegameInvites.set(inviteCode, roomId);

        let avatar = null;
        try {
          const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
          if (data?.avatar_url) avatar = data.avatar_url;
          if (data?.nickname) payload = { ...(payload || {}), nickname: payload?.nickname || data.nickname };
        } catch {}

        const hostName = String(payload?.nickname || "방장").slice(0, 20);
        const hostGender = ["M", "F", "X"].includes(payload?.gender) ? payload.gender : "X";
        room.players.set(me.id, newPlayerState(hostName, false, avatar, hostGender, payload?.recent));
        room.playerOrder.push(me.id);
        lifegameUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));

        cb?.({ ok: true, roomId, inviteCode, room: publicRoom(room) });
        broadcastRoomState(io, room);
        console.log(`[lifegame] created room ${roomId} by ${me.id} (${hostName}) inv=${inviteCode}`);
      } catch (e) {
        console.error("[lifegame:createRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ===== joinRoom (by inviteCode) =====
    socket.on("lifegame:joinRoom", async (payload, cb) => {
      try {
        const code = String(payload?.inviteCode || "").trim();
        const roomId = lifegameInvites.get(code);
        const room = roomId ? lifegameRooms.get(roomId) : null;
        if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.players.has(me.id)) {
          // 재접속
          const p = room.players.get(me.id);
          p.connected = true;
          socket.join(socketRoomName(roomId));
          lifegameUserRoom.set(me.id, roomId);
          clearEmptyRoomTimer(room);
          cb?.({ ok: true, roomId, inviteCode: room.inviteCode, room: publicRoom(room), myEvent: myPendingEvent(room, me.id), myResult: myRevealedResult(room, me.id) });
          broadcastRoomState(io, room);
          return;
        }
        if (room.status !== "lobby") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });
        if (room.players.size >= room.maxPlayers) return cb?.({ ok: false, error: "ROOM_FULL" });

        let avatar = null;
        if (!me.isGuest) {
          try {
            const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
            if (data?.avatar_url) avatar = data.avatar_url;
            if (data?.nickname && !payload?.nickname) payload = { ...(payload || {}), nickname: data.nickname };
          } catch {}
        }
        const playerName = String(payload?.nickname || (me.isGuest ? "게스트" : "유저")).slice(0, 20);
        const joinGender = ["M", "F", "X"].includes(payload?.gender) ? payload.gender : "X";

        room.players.set(me.id, newPlayerState(playerName, !!me.isGuest, avatar, joinGender, payload?.recent));
        room.playerOrder.push(me.id);
        lifegameUserRoom.set(me.id, roomId);
        socket.join(socketRoomName(roomId));

        clearEmptyRoomTimer(room);
        cb?.({ ok: true, roomId, inviteCode: room.inviteCode, room: publicRoom(room) });
        broadcastRoomState(io, room);
      } catch (e) {
        console.error("[lifegame:joinRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    // ===== setOptions (host only, lobby only) =====
    socket.on("lifegame:setOptions", (payload, cb) => {
      const roomId = lifegameUserRoom.get(me.id);
      const room = roomId ? lifegameRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });

      if (payload?.turnTimeSec != null && ALLOWED_TURN_SECS.includes(Number(payload.turnTimeSec))) {
        room.turnTimeSec = Number(payload.turnTimeSec);
      }
      if (payload?.minigames != null) room.minigames = !!payload.minigames;
      if (payload?.maxPlayers != null) {
        const m = Math.min(MAX_PLAYERS_HARD_CAP, Math.max(MIN_PLAYERS, Number(payload.maxPlayers) || 6));
        if (m >= room.players.size) room.maxPlayers = m;
      }
      cb?.({ ok: true, room: publicRoom(room) });
      broadcastRoomState(io, room);
    });

    // ===== setGender (lobby, 본인) =====
    socket.on("lifegame:setGender", (payload, cb) => {
      const roomId = lifegameUserRoom.get(me.id);
      const room = roomId ? lifegameRooms.get(roomId) : null;
      const p = room?.players.get(me.id);
      if (!room || !p) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status === "playing") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });
      if (["M", "F", "X"].includes(payload?.gender)) p.gender = payload.gender;
      cb?.({ ok: true });
      broadcastRoomState(io, room);
    });

    // ===== startGame (host only) =====
    socket.on("lifegame:startGame", (_payload, cb) => {
      const roomId = lifegameUserRoom.get(me.id);
      const room = roomId ? lifegameRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status === "playing") return cb?.({ ok: false, error: "ALREADY_PLAYING" });
      if (room.players.size < MIN_PLAYERS) return cb?.({ ok: false, error: "NOT_ENOUGH_PLAYERS" });

      cb?.({ ok: true });
      startGame(io, room);
    });

    // ===== submitChoice =====
    socket.on("lifegame:submitChoice", (payload, cb) => {
      const roomId = lifegameUserRoom.get(me.id);
      const room = roomId ? lifegameRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
      const ev = room.pending.get(me.id);
      if (!ev) return cb?.({ ok: false, error: "NO_PENDING_EVENT" });
      const choiceId = String(payload?.choiceId || "");
      const p = room.players.get(me.id);
      if (!core.choicesFor(p.life, ev).some(c => c.id === choiceId)) return cb?.({ ok: false, error: "INVALID_CHOICE" });
      const ok = applyPick(io, room, me.id, choiceId, false);
      cb?.({ ok });
    });

    // ===== miniAct (미니게임 입력) =====
    socket.on("lifegame:miniAct", (payload, cb) => {
      const roomId = lifegameUserRoom.get(me.id);
      const room = roomId ? lifegameRooms.get(roomId) : null;
      if (!room || room.status !== "playing") return cb?.({ ok: false });
      cb?.({ ok: handleMiniAct(room, me.id, payload) });
    });

    // ===== leaveRoom =====
    socket.on("lifegame:leaveRoom", (_payload, cb) => {
      const roomId = lifegameUserRoom.get(me.id);
      const room = roomId ? lifegameRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      leavePlayer(io, room, me.id, false);
      socket.leave(socketRoomName(room.id));
      cb?.({ ok: true });
    });

    socket.on("lifegame:kickPlayer", (payload, cb) => {
      const roomId = lifegameUserRoom.get(me.id);
      const room = roomId ? lifegameRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby") return cb?.({ ok: false, error: "NOT_LOBBY" });
      const targetId = String(payload?.targetUserId || "");
      if (!targetId || targetId === me.id) return cb?.({ ok: false, error: "INVALID_TARGET" });
      if (!room.players.has(targetId)) return cb?.({ ok: false, error: "TARGET_NOT_IN_ROOM" });
      io.to(socketRoomName(room.id)).emit("lifegame:kicked", { userId: targetId, reason: "KICKED_BY_HOST" });
      leavePlayer(io, room, targetId, false);
      cb?.({ ok: true });
    });

    // ===== requestState (재접속/리프레시) =====
    socket.on("lifegame:requestState", (_payload, cb) => {
      const roomId = lifegameUserRoom.get(me.id);
      const room = roomId ? lifegameRooms.get(roomId) : null;
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      const p = room.players.get(me.id);
      if (p) p.connected = true;
      socket.join(socketRoomName(room.id));
      clearEmptyRoomTimer(room);
      cb?.({ ok: true, room: publicRoom(room), myEvent: myPendingEvent(room, me.id), myResult: myRevealedResult(room, me.id) });
    });

    // ===== v3: 준비 상태(대기실) =====
    socket.on("lifegame:setReady", (payload, cb) => {
      const roomId = lifegameUserRoom.get(me.id);
      const room = roomId ? lifegameRooms.get(roomId) : null;
      const p = room?.players.get(me.id);
      if (!room || !p) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.status === "playing") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });
      p.ready = !!payload?.ready;
      cb?.({ ok: true });
      broadcastRoomState(io, room);
    });

    // ===== v3: 인연 제안 응답(둘 다 동의해야 성사) =====
    socket.on("lifegame:socialAnswer", (payload, cb) => {
      const roomId = lifegameUserRoom.get(me.id);
      const room = roomId ? lifegameRooms.get(roomId) : null;
      const sc = room?.social;
      if (!room || room.status !== "playing" || !sc) return cb?.({ ok: false, error: "NO_PROPOSAL" });
      if (String(payload?.id || "") !== sc.id) return cb?.({ ok: false, error: "STALE" });
      if (me.id !== sc.a && me.id !== sc.b) return cb?.({ ok: false, error: "NOT_YOURS" });
      if (sc.answers[me.id] != null) return cb?.({ ok: true, dup: true });
      sc.answers[me.id] = payload?.accept === true;
      cb?.({ ok: true });
      io.to(socketRoomName(room.id)).emit("lifegame:socialAnswered", { id: sc.id, userId: me.id });   // 누가 답했는지만(무엇을 골랐는지는 결과 때)
      if (sc.answers[me.id] === false || (sc.answers[sc.a] != null && sc.answers[sc.b] != null)) { resolveSocial(io, room); maybeAdvance(io, room); }
    });

    socket.on("disconnect", () => {
      const roomId = lifegameUserRoom.get(me.id);
      const room = roomId ? lifegameRooms.get(roomId) : null;
      if (!room) return;
      const p = room.players.get(me.id);
      if (!p) return;
      p.connected = false;

      if (room.status === "lobby") {
        leavePlayer(io, room, me.id, false);
      } else if (room.status === "playing") {
        // 내 사건이 남아 있으면 자동 선택(다른 사람이 기다리지 않게), 인연 제안은 거절로
        if (room.pending?.has(me.id)) autoPick(io, room, me.id, true);
        if (room.social && (room.social.a === me.id || room.social.b === me.id) && room.social.answers[me.id] == null) {
          room.social.answers[me.id] = false; resolveSocial(io, room); maybeAdvance(io, room);
        }
        if (isMinigameActive(room)) recheckMinigame(room);
        broadcastRoomState(io, room);
        const anyConnected = room.playerOrder.some(uid => room.players.get(uid)?.connected);
        if (!anyConnected) {
          clearEmptyRoomTimer(room);
          room.emptyRoomTimer = setTimeout(() => deleteRoom(io, room, "ALL_DISCONNECTED"), EMPTY_ROOM_TTL_MS);
        }
      }
    });
  });
}

/** 재접속: 이번 해 내가 이미 고른 결과(아직 공개 전이어도 본인은 볼 수 있다) */
function myRevealedResult(room, uid) {
  return (room.reveal || []).find(r => r.userId === uid && r.year === room.year) || null;
}
function myPendingEvent(room, uid) {
  const ev = room.pending?.get(uid);
  const p = room.players.get(uid);
  return ev && p?.life ? { year: room.year, deadline: room.deadline, event: core.publicEvent(p.life, ev) } : null;
}

function leavePlayer(io, room, userId, forced) {
  if (!room.players.has(userId)) return;
  const wasHost = room.hostUserId === userId;
  const hadPending = room.pending?.has(userId);

  room.players.delete(userId);
  room.playerOrder = room.playerOrder.filter(u => u !== userId);
  if (lifegameUserRoom.get(userId) === room.id) lifegameUserRoom.delete(userId);

  if (room.playerOrder.length === 0) {
    deleteRoom(io, room, "EMPTY");
    return;
  }

  if (wasHost) {
    room.hostUserId = room.playerOrder[0];
  }

  if (room.status === "playing") {
    if (isMinigameActive(room)) recheckMinigame(room);
    const hadSocial = !!(room.social && (room.social.a === userId || room.social.b === userId));
    if (hadSocial) { room.social.answers[userId] = false; resolveSocial(io, room); }
    if (hadPending) room.pending.delete(userId);
    if (hadPending || hadSocial) maybeAdvance(io, room);
    if (!aliveIds(room).length && !isMinigameActive(room)) later(room, () => endGame(io, room), 800);
  }
  broadcastRoomState(io, room);
}

// 시험용
export const __lifegameTest = { core, lifegameRooms, runYear, afterYear, rankPlayers, planSocial, interactYear };
