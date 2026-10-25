// =========================
// 플듀 키우기 친구 대전 (1대1) — 서버
// 핵심: 서버는 '시계 + 지시 중계'만 한다. 경기 계산은 두 화면이 같은 시작값·같은 지시로 각자 한다(결정적 시뮬).
//   · 밴픽: 서버 권위 (차례·시간·자동 선택)
//   · 경기: 서버가 tick마다 "여기(upTo 스텝)까지 진행해도 됨" + 그 사이 들어온 지시(스텝 번호 붙임)를 보냄
//           → 지시의 스텝 s는 항상 이미 허락한 스텝 이상이라 두 화면 모두 같은 스텝에 적용된다
//   · 결과: 두 화면이 보고한 결과가 같으면 확정, 다르면 방장(파랑 기준 아님, 방장) 결과 + desync 표시
// 이벤트 prefix: 'rpvp:*', socket room name: `rpvp:${roomId}`
// =========================

const rooms = new Map();
const invites = new Map();
const userRoom = new Map();

const MAX_NICK_LEN = 14;
const EMPTY_ROOM_TTL_MS = 120_000;
const LOBBY_GRACE_MS = 90_000;                // 대기실·결과에서 끊긴 사람(앱 전환·카톡으로 링크 보내기 등)을 바로 내보내지 않고 기다리는 시간
const ALLOWED_BANS = [0, 1, 2, 3];          // 한 사람당 밴 수
const ALLOWED_PICK_SEC = [20, 30, 45];
const ALLOWED_SPEED = [1, 2, 3];
const SETUP_SEC = 45;                         // 라인업·작전 정하기
const LOAD_TIMEOUT_MS = 20_000;
const COUNTDOWN_MS = 3_000;
const TICK_MS = 100;
const STEPS_PER_SEC = 30;                     // 엔진 DT = 1/30
const MAX_STEPS = 30 * 760;                   // 엔진 최대 720초 + 여유
const DC_GRACE_MS = 60_000;                   // 경기 중 끊긴 사람 기다리는 시간
const END_WAIT_MS = 15_000;                   // 한쪽 결과만 왔을 때 다른 쪽 기다리는 시간
const CMD_GAP_MS = 250;
const MAX_CMDS_PER_SIDE = 120;
const EMOTE_GAP_MS = 1200;
const EMOTES = ["gg", "nice", "lol", "wow", "sorry", "angry"];

// 프론트 raising/moba/ordercfg.js ORDERS + timeout
const ORDER_TYPES = new Set(["focus", "guard", "cheer", "mental", "switch", "gambit", "allout", "ace", "group", "objective", "push", "defend", "split", "retreat", "timeout"]);
const STANCES = ["atk", "bal", "def"];
const PRE = { pace: ["early", "balanced", "late"], jungle: ["auto", "top", "bot"], objective: ["balanced", "dragon", "baron"], build: ["bal", "atk", "def"] };

// 프론트 raising/monsters.js 40종 (id → 역할). 종을 추가하면 여기도 추가
const SPECIES_ROLE = {"embers":"fighter","blazewhelp":"mage","foxfire":"assassin","magmos":"tank","chirpy":"ranged","dewdrop":"healer","shellby":"tank","squirty":"ranged","jellyn":"support","otty":"fighter","sprout":"support","mossrock":"tank","prickle":"fighter","bloomie":"healer","leafy":"assassin","batling":"assassin","zappy":"mage","glimmer":"support","golemmy":"tank","archie":"ranged","cinder":"mage","brawlcub":"fighter","mistee":"support","crabby":"fighter","shroomy":"support","vinny":"ranged","ghostie":"assassin","boltbot":"fighter","mochi":"healer","wizzy":"mage","magmaw":"tank","sunny":"healer","wavey":"mage","icy":"support","pearlie":"ranged","bambi":"fighter","petal":"mage","drainy":"support","knightie":"tank","comet":"ranged"};
const SPECIES_IDS = Object.keys(SPECIES_ROLE);
// 자동 선택 시 빈 포지션부터 채운다(탑·정글·미드·원딜·서포터 순 역할 묶음)
const POS_POOLS = [["tank", "fighter"], ["assassin", "fighter"], ["mage", "assassin"], ["ranged"], ["healer", "support"]];

function genInviteCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!invites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}
const roomName = (id) => `rpvp:${id}`;
const otherSide = (s) => (s === "a" ? "b" : "a");

function draftOrder(banN) {
  const seq = [];
  for (let i = 0; i < banN; i++) { seq.push({ side: "a", kind: "ban" }); seq.push({ side: "b", kind: "ban" }); }
  for (const side of ["a", "b", "b", "a", "a", "b", "b", "a", "a", "b"]) seq.push({ side, kind: "pick" });
  return seq;
}

function newPlayer(name, isGuest, avatarUrl, socketId) {
  return { name: String(name || "익명").slice(0, MAX_NICK_LEN), isGuest: !!isGuest, avatar_url: avatarUrl || null, connected: true, socketId, lastCmdAt: 0, lastEmoteAt: 0, leaveTimer: null };
}

function sideOf(room, uid) {
  const i = room.playerOrder.indexOf(uid);
  if (i < 0 || i > 1) return null;
  return (i === 0) !== room.swap ? "a" : "b";
}
function uidOfSide(room, side) {
  return room.playerOrder.find((uid) => sideOf(room, uid) === side) || null;
}

function publicDraft(room) {
  const d = room.draft;
  if (!d) return null;
  const cur = d.seq[d.turn] || null;
  return { seq: d.seq, turn: d.turn, cur, deadline: d.deadline, bans: d.bans, picks: d.picks, hover: d.hover };
}

function publicRoom(room) {
  return {
    id: room.id,
    inviteCode: room.inviteCode,
    hostUserId: room.hostUserId,
    status: room.status,
    opts: room.opts,
    game: room.game,
    score: room.score,
    sides: Object.fromEntries(room.playerOrder.slice(0, 2).map((uid) => [uid, sideOf(room, uid)])),
    players: room.playerOrder.map((uid) => {
      const p = room.players.get(uid);
      return p && { playerId: uid, nickname: p.name, isGuest: p.isGuest, avatar_url: p.avatar_url, connected: p.connected };
    }).filter(Boolean),
    draft: room.status === "draft" ? publicDraft(room) : null,
    setup: room.status === "setup" ? { deadline: room.setup.deadline, ready: { a: !!room.setup.a, b: !!room.setup.b }, picks: room.draft?.picks || null } : null,
    paused: room.match?.pausedBy ? { by: room.match.pausedBy, until: room.match.pauseUntil } : null,
    last: room.last || null,
    now: Date.now(),
  };
}
function broadcast(io, room) { io.to(roomName(room.id)).emit("rpvp:roomState", publicRoom(room)); }

function clearTimers(room) {
  for (const k of ["emptyTimer", "turnTimer", "setupTimer", "loadTimer", "tickTimer", "graceTimer", "endTimer"]) {
    if (room[k]) { clearTimeout(room[k]); clearInterval(room[k]); room[k] = null; }
  }
}

function deleteRoom(io, room, reason) {
  clearTimers(room);
  rooms.delete(room.id);
  invites.delete(room.inviteCode);
  for (const uid of room.playerOrder) if (userRoom.get(uid) === room.id) userRoom.delete(uid);
  io.to(roomName(room.id)).emit("rpvp:roomClosed", { reason });
  io.in(roomName(room.id)).socketsLeave(roomName(room.id));
  console.log(`[rpvp] room ${room.id} deleted: ${reason}`);
}

function maybeScheduleEmptyDelete(io, room) {
  const anyConnected = [...room.players.values()].some((p) => p.connected);
  if (!anyConnected && !room.emptyTimer) {
    room.emptyTimer = setTimeout(() => {
      room.emptyTimer = null;
      const r = rooms.get(room.id);
      if (r && [...r.players.values()].every((p) => !p.connected)) deleteRoom(io, r, "EMPTY");
    }, EMPTY_ROOM_TTL_MS);
  }
}

function backToLobby(io, room, reason) {
  clearTimers(room);
  room.status = "lobby";
  room.draft = null; room.setup = null; room.match = null;
  io.to(roomName(room.id)).emit("rpvp:aborted", { reason });
  broadcast(io, room);
}

// ===== 밴픽 =====
function taken(d) {
  return new Set([...d.bans.a, ...d.bans.b, ...d.picks.a, ...d.picks.b].filter(Boolean));
}
function autoChoice(d, side, kind) {
  const used = taken(d), free = SPECIES_IDS.filter((s) => !used.has(s));
  if (!free.length) return null;
  if (kind === "ban") return null;              // 시간 초과 밴 = 밴 없음
  // 아직 비어 있는 포지션 역할부터
  const roles = d.picks[side].map((s) => SPECIES_ROLE[s]), left = roles.slice(), need = [];
  for (const pool of POS_POOLS) { const i = left.findIndex((r) => pool.includes(r)); if (i >= 0) left.splice(i, 1); else need.push(pool); }
  for (const pool of need) {
    const cand = free.filter((s) => pool.includes(SPECIES_ROLE[s]));
    if (cand.length) return cand[Math.floor(Math.random() * cand.length)];
  }
  return free[Math.floor(Math.random() * free.length)];
}
function startDraft(io, room) {
  clearTimers(room);
  room.game += 1;
  room.status = "draft";
  room.setup = null; room.match = null; room.last = null;
  room.draft = { seq: draftOrder(room.opts.bans), turn: 0, bans: { a: [], b: [] }, picks: { a: [], b: [] }, hover: { a: null, b: null }, deadline: 0 };
  startTurn(io, room);
}
function startTurn(io, room) {
  const d = room.draft;
  if (room.turnTimer) { clearTimeout(room.turnTimer); room.turnTimer = null; }
  if (d.turn >= d.seq.length) return startSetup(io, room);
  const ms = room.opts.pickSec * 1000;
  d.deadline = Date.now() + ms;
  d.hover = { a: null, b: null };
  room.turnTimer = setTimeout(() => {
    room.turnTimer = null;
    const r = rooms.get(room.id);
    if (!r || r.status !== "draft" || r.draft !== d) return;
    const cur = d.seq[d.turn];
    const hv = d.hover[cur.side] && !taken(d).has(d.hover[cur.side]) ? d.hover[cur.side] : null;      // 고르던(누른) 몬스터가 있으면 그걸로
    applyChoice(io, r, cur.side, hv || (cur.kind === "pick" ? autoChoice(d, cur.side, "pick") : null), true);
  }, ms + 400);
  broadcast(io, room);
}
function applyChoice(io, room, side, sp, auto = false) {
  const d = room.draft, cur = d.seq[d.turn];
  if (!cur || cur.side !== side) return false;
  if (cur.kind === "pick" && !sp) return false;
  if (sp && (!SPECIES_ROLE[sp] || taken(d).has(sp))) return false;
  (cur.kind === "ban" ? d.bans : d.picks)[side].push(sp || null);
  io.to(roomName(room.id)).emit("rpvp:draftEvent", { side, kind: cur.kind, sp: sp || null, auto });
  d.turn += 1;
  startTurn(io, room);
  return true;
}

// ===== 라인업·작전 =====
function startSetup(io, room) {
  room.status = "setup";
  room.setup = { a: null, b: null, deadline: Date.now() + SETUP_SEC * 1000 };
  room.setupTimer = setTimeout(() => {
    room.setupTimer = null;
    const r = rooms.get(room.id);
    if (!r || r.status !== "setup") return;
    for (const s of ["a", "b"]) if (!r.setup[s]) r.setup[s] = defaultSetup(r.draft.picks[s]);
    startLoading(io, r);
  }, SETUP_SEC * 1000 + 500);
  broadcast(io, room);
}
function defaultSetup(picks) {
  return { order: picks.slice(0, 5), stance: "bal", pre: { pace: "balanced", jungle: "auto", objective: "balanced", build: "bal" }, ace: 3, auto: true };
}
function cleanSetup(raw, picks) {
  const order = Array.isArray(raw?.order) ? raw.order.map(String) : [];
  if (order.length !== 5 || new Set(order).size !== 5 || !order.every((s) => picks.includes(s))) return null;
  const dflt = { pace: "balanced", jungle: "auto", objective: "balanced", build: "bal" }, pre = {};
  for (const k of Object.keys(PRE)) pre[k] = PRE[k].includes(raw?.pre?.[k]) ? raw.pre[k] : dflt[k];
  const ace = Number.isInteger(raw?.ace) && raw.ace >= 0 && raw.ace < 5 ? raw.ace : 3;
  return { order, stance: STANCES.includes(raw?.stance) ? raw.stance : "bal", pre, ace };
}

// ===== 경기 =====
function startLoading(io, room) {
  clearTimers(room);
  room.status = "loading";
  const seed = (Math.floor(Math.random() * 0x7fffffff) | 1) >>> 0;
  const names = {};
  for (const s of ["a", "b"]) { const uid = uidOfSide(room, s); names[s] = room.players.get(uid)?.name || s; }
  room.match = {
    init: { seed, setups: { a: room.setup.a, b: room.setup.b }, names, speed: room.opts.speed, game: room.game },
    loaded: { a: null, b: null }, startAt: 0, granted: 0, cmds: [], pending: [], n: 0, perSide: { a: 0, b: 0 },
    sync: new Map(), desync: false, reports: { a: null, b: null }, pausedBy: null, pauseUntil: 0, pauseAt: 0,
  };
  io.to(roomName(room.id)).emit("rpvp:matchInit", room.match.init);
  room.loadTimer = setTimeout(() => {
    room.loadTimer = null;
    const r = rooms.get(room.id);
    if (!r || r.status !== "loading") return;
    backToLobby(io, r, "LOAD_TIMEOUT");
  }, LOAD_TIMEOUT_MS);
  broadcast(io, room);
}
function maybeStartMatch(io, room) {
  const M = room.match, A = M.loaded.a, B = M.loaded.b;
  if (!A || !B) return;
  if (room.loadTimer) { clearTimeout(room.loadTimer); room.loadTimer = null; }
  if (A.rv !== B.rv || A.hash !== B.hash) {
    console.warn(`[rpvp] ${room.id} init mismatch`, A, B);
    return backToLobby(io, room, "VERSION_MISMATCH");
  }
  room.status = "match";
  M.startAt = Date.now() + COUNTDOWN_MS;
  io.to(roomName(room.id)).emit("rpvp:matchGo", { inMs: COUNTDOWN_MS });
  room.tickTimer = setInterval(() => tick(io, room), TICK_MS);
  broadcast(io, room);
}
function tick(io, room) {
  const M = room.match;
  if (!M || room.status !== "match") return;
  if (M.pausedBy) return;
  const now = Date.now();
  const want = Math.max(0, Math.min(MAX_STEPS, Math.floor(((now - M.startAt) / 1000) * STEPS_PER_SEC * M.init.speed)));
  if (want <= M.granted && !M.pending.length) return;
  M.granted = Math.max(M.granted, want);
  const cmds = M.pending; M.pending = [];
  io.to(roomName(room.id)).emit("rpvp:tick", { upTo: M.granted, cmds });
}
function cleanArg(type, arg) {
  if (arg == null) return null;
  if (typeof arg === "number" && Number.isFinite(arg)) return Math.trunc(arg);
  if (typeof arg === "string" && arg.length <= 24 && /^[a-z0-9:_-]+$/i.test(arg)) return arg;
  return undefined;
}
function finalize(io, room, result, why) {
  if (room.status !== "match") return;
  clearTimers(room);
  const M = room.match;
  room.status = "ended";
  const winnerUid = uidOfSide(room, result);
  if (winnerUid) room.score[winnerUid] = (room.score[winnerUid] || 0) + 1;
  room.last = { result, winnerUid, why, desync: !!M.desync, game: room.game };
  io.to(roomName(room.id)).emit("rpvp:matchEnd", { ...room.last, score: room.score });
  console.log(`[rpvp] ${room.id} game ${room.game} → ${result} (${why})${M.desync ? " DESYNC" : ""}`);
  broadcast(io, room);
}
function onReport(io, room, side, rep) {
  const M = room.match;
  M.reports[side] = rep;
  const o = M.reports[otherSide(side)];
  if (o) {
    if (o.result !== rep.result || o.hash !== rep.hash) M.desync = true;
    const hostSide = sideOf(room, room.hostUserId) || "a";
    return finalize(io, room, M.reports[hostSide].result, "play");
  }
  if (!room.endTimer) {
    room.endTimer = setTimeout(() => {
      room.endTimer = null;
      const r = rooms.get(room.id);
      if (r && r.status === "match" && r.match === M) finalize(io, r, rep.result, "play");
    }, END_WAIT_MS);
  }
}
function pauseFor(io, room, uid) {
  const M = room.match;
  if (!M || room.status !== "match" || M.pausedBy) return;
  M.pausedBy = uid; M.pauseAt = Date.now(); M.pauseUntil = Date.now() + DC_GRACE_MS;
  room.graceTimer = setTimeout(() => {
    room.graceTimer = null;
    const r = rooms.get(room.id);
    if (!r || r.status !== "match" || r.match !== M || M.pausedBy !== uid) return;
    const s = sideOf(r, uid);
    finalize(io, r, otherSide(s), "forfeit");
  }, DC_GRACE_MS);
  io.to(roomName(room.id)).emit("rpvp:paused", { by: uid, until: M.pauseUntil });
  broadcast(io, room);
}
function resume(io, room, uid) {
  const M = room.match;
  if (!M || M.pausedBy !== uid) return;
  if (room.graceTimer) { clearTimeout(room.graceTimer); room.graceTimer = null; }
  M.startAt += Date.now() - M.pauseAt;          // 멈춘 시간만큼 시계를 뒤로 → 진행 스텝 연속
  M.pausedBy = null; M.pauseUntil = 0;
  io.to(roomName(room.id)).emit("rpvp:resumed", {});
  const still = room.playerOrder.find((u) => u !== uid && !room.players.get(u)?.connected);
  if (still) return pauseFor(io, room, still);     // 둘 다 끊겼던 경우: 남은 사람을 다시 기다린다
  broadcast(io, room);
}
// 재접속한 사람에게 경기 전체(시작값+지금까지 지시+허락 스텝)를 보낸다
function matchSnapshot(room) {
  const M = room.match;
  if (!M || !["loading", "match"].includes(room.status)) return null;
  return { init: M.init, cmds: M.cmds.filter((c) => !M.pending.includes(c)), granted: M.granted, started: room.status === "match" };      // 아직 안 보낸 지시는 다음 tick으로 받는다
}

function leavePlayer(io, room, uid) {
  if (!room.players.has(uid)) return;
  const side = sideOf(room, uid);
  if (room.status === "match" && side) finalize(io, room, otherSide(side), "forfeit");
  else if (["draft", "setup", "loading"].includes(room.status)) backToLobby(io, room, "PEER_LEFT");
  const lp = room.players.get(uid);
  if (lp?.leaveTimer) clearTimeout(lp.leaveTimer);
  room.players.delete(uid);
  const i = room.playerOrder.indexOf(uid);
  if (i >= 0) room.playerOrder.splice(i, 1);
  delete room.score[uid];
  room.swap = false;
  if (userRoom.get(uid) === room.id) userRoom.delete(uid);
  io.to(roomName(room.id)).emit("rpvp:peerLeave", { playerId: uid });
  if (!room.playerOrder.length) return deleteRoom(io, room, "ALL_LEFT");
  if (room.hostUserId === uid) room.hostUserId = room.playerOrder[0];
  if (room.status === "ended") room.status = "lobby";
  broadcast(io, room);
}

async function profileOf(supabaseAdmin, me, nick) {
  let avatar = null;
  if (!me.isGuest) {
    try {
      const { data } = await supabaseAdmin.from("profiles").select("nickname, avatar_url").eq("id", me.id).single();
      if (data?.avatar_url) avatar = data.avatar_url;
      if (data?.nickname) nick = data.nickname;          // 프로필 닉네임 우선
    } catch {}
  }
  return { nick: nick || (me.isGuest ? "게스트" : "감독"), avatar };
}

// =========================
// 등록
// =========================
export function registerRaisingPvp(io, supabaseAdmin) {
  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;
    const myRoom = () => { const id = userRoom.get(me.id); return id ? rooms.get(id) : null; };

    socket.on("rpvp:createRoom", async (payload, cb) => {
      try {
        if (me.isGuest) return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });
        const old = myRoom();
        if (old) leavePlayer(io, old, me.id);
        const id = `rp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const room = {
          id, inviteCode: genInviteCode(), hostUserId: me.id, status: "lobby",
          opts: { bans: 2, pickSec: 30, speed: 2 }, game: 0, score: {}, swap: false,
          players: new Map(), playerOrder: [], draft: null, setup: null, match: null, last: null,
        };
        rooms.set(id, room);
        invites.set(room.inviteCode, id);
        const { nick, avatar } = await profileOf(supabaseAdmin, me, payload?.nickname);
        room.players.set(me.id, newPlayer(nick, false, avatar, socket.id));
        room.playerOrder.push(me.id);
        room.score[me.id] = 0;
        userRoom.set(me.id, id);
        socket.join(roomName(id));
        cb?.({ ok: true, roomId: id, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room) });
      } catch (e) {
        console.error("[rpvp:createRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    socket.on("rpvp:joinRoom", async (payload, cb) => {
      try {
        const code = String(payload?.inviteCode || "").trim();
        const room = rooms.get(invites.get(code));
        if (!room) return cb?.({ ok: false, error: "ROOM_NOT_FOUND" });
        if (room.players.has(me.id)) {          // 재접속
          const p = room.players.get(me.id);
          p.connected = true; p.socketId = socket.id;
          if (p.leaveTimer) { clearTimeout(p.leaveTimer); p.leaveTimer = null; }
          socket.join(roomName(room.id));
          userRoom.set(me.id, room.id);
          if (room.emptyTimer) { clearTimeout(room.emptyTimer); room.emptyTimer = null; }
          cb?.({ ok: true, roomId: room.id, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room), rejoined: true, match: matchSnapshot(room) });
          if (room.match?.pausedBy === me.id) resume(io, room, me.id);
          broadcast(io, room);
          return;
        }
        if (room.playerOrder.length >= 2) return cb?.({ ok: false, error: "ROOM_FULL" });
        if (room.status !== "lobby" && room.status !== "ended") return cb?.({ ok: false, error: "GAME_ALREADY_STARTED" });
        const old = myRoom();
        if (old) leavePlayer(io, old, me.id);
        const { nick, avatar } = await profileOf(supabaseAdmin, me, payload?.nickname);
        room.players.set(me.id, newPlayer(nick, !!me.isGuest, avatar, socket.id));
        room.playerOrder.push(me.id);
        room.score[me.id] = 0;
        userRoom.set(me.id, room.id);
        socket.join(roomName(room.id));
        if (room.emptyTimer) { clearTimeout(room.emptyTimer); room.emptyTimer = null; }
        if (room.status === "ended") room.status = "lobby";
        cb?.({ ok: true, roomId: room.id, inviteCode: room.inviteCode, playerId: me.id, room: publicRoom(room) });
        broadcast(io, room);
      } catch (e) {
        console.error("[rpvp:joinRoom]", e);
        cb?.({ ok: false, error: "INTERNAL" });
      }
    });

    socket.on("rpvp:setOptions", (payload, cb) => {
      const room = myRoom();
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby" && room.status !== "ended") return cb?.({ ok: false, error: "NOT_LOBBY" });
      const b = Number(payload?.bans), p = Number(payload?.pickSec), s = Number(payload?.speed);
      if (ALLOWED_BANS.includes(b)) room.opts.bans = b;
      if (ALLOWED_PICK_SEC.includes(p)) room.opts.pickSec = p;
      if (ALLOWED_SPEED.includes(s)) room.opts.speed = s;
      broadcast(io, room);
      cb?.({ ok: true });
    });

    socket.on("rpvp:start", (_payload, cb) => {
      const room = myRoom();
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby" && room.status !== "ended") return cb?.({ ok: false, error: "ALREADY_PLAYING" });
      if (room.playerOrder.length < 2) return cb?.({ ok: false, error: "NEED_2" });
      if (![...room.players.values()].every((p) => p.connected)) return cb?.({ ok: false, error: "PEER_OFFLINE" });
      if (room.game > 0) room.swap = !room.swap;      // 판마다 진영·선픽 교대
      startDraft(io, room);
      cb?.({ ok: true });
    });

    socket.on("rpvp:hover", (payload) => {
      const room = myRoom();
      if (!room || room.status !== "draft") return;
      const side = sideOf(room, me.id), d = room.draft, cur = d.seq[d.turn];
      if (!cur || cur.side !== side) return;
      const sp = SPECIES_ROLE[payload?.sp] ? payload.sp : null;
      d.hover[side] = sp;
      io.to(roomName(room.id)).emit("rpvp:hover", { side, sp });
    });

    socket.on("rpvp:choose", (payload, cb) => {
      const room = myRoom();
      if (!room || room.status !== "draft") return cb?.({ ok: false, error: "NOT_DRAFT" });
      const side = sideOf(room, me.id);
      const sp = payload?.sp == null ? null : String(payload.sp);
      const ok = applyChoice(io, room, side, sp);
      cb?.(ok ? { ok: true } : { ok: false, error: "INVALID" });
    });

    socket.on("rpvp:setup", (payload, cb) => {
      const room = myRoom();
      if (!room || room.status !== "setup") return cb?.({ ok: false, error: "NOT_SETUP" });
      const side = sideOf(room, me.id);
      const s = cleanSetup(payload, room.draft.picks[side]);
      if (!s) return cb?.({ ok: false, error: "INVALID" });
      room.setup[side] = s;
      cb?.({ ok: true });
      if (room.setup.a && room.setup.b) startLoading(io, room);
      else broadcast(io, room);
    });

    socket.on("rpvp:unready", (_p, cb) => {
      const room = myRoom();
      if (!room || room.status !== "setup") return cb?.({ ok: false });
      room.setup[sideOf(room, me.id)] = null;
      broadcast(io, room);
      cb?.({ ok: true });
    });

    socket.on("rpvp:loaded", (payload, cb) => {
      const room = myRoom();
      if (!room || room.status !== "loading") return cb?.({ ok: false, error: "NOT_LOADING" });
      const side = sideOf(room, me.id);
      room.match.loaded[side] = { rv: Number(payload?.rv) || 0, hash: String(payload?.hash || "").slice(0, 40) };
      cb?.({ ok: true });
      maybeStartMatch(io, room);
    });

    socket.on("rpvp:cmd", (payload, cb) => {
      const room = myRoom();
      if (!room || room.status !== "match") return cb?.({ ok: false, error: "NOT_MATCH" });
      const M = room.match, side = sideOf(room, me.id), p = room.players.get(me.id);
      const type = String(payload?.type || ""), arg = cleanArg(type, payload?.arg);
      if (!ORDER_TYPES.has(type) || arg === undefined) return cb?.({ ok: false, error: "INVALID" });
      if (M.pausedBy || Date.now() < M.startAt) return cb?.({ ok: false, error: "PAUSED" });
      if (Date.now() - p.lastCmdAt < CMD_GAP_MS || M.perSide[side] >= MAX_CMDS_PER_SIDE) return cb?.({ ok: false, error: "RATE" });
      p.lastCmdAt = Date.now(); M.perSide[side] += 1;
      // 스텝 = 이미 허락한 마지막 스텝. 두 화면 모두 아직 그 다음 스텝을 진행하지 않았으므로 같은 순간에 적용된다
      const c = { s: M.granted, side, type, arg, n: M.n++ };
      M.cmds.push(c); M.pending.push(c);
      cb?.({ ok: true, s: c.s });
    });

    socket.on("rpvp:sync", (payload) => {
      const room = myRoom();
      if (!room || room.status !== "match") return;
      const M = room.match, side = sideOf(room, me.id), s = Number(payload?.s), h = String(payload?.h || "");
      if (!Number.isInteger(s)) return;
      const e = M.sync.get(s) || {};
      e[side] = h;
      if (e.a && e.b) {
        if (e.a !== e.b && !M.desync) { M.desync = true; console.warn(`[rpvp] ${room.id} desync at step ${s}`); io.to(roomName(room.id)).emit("rpvp:desync", { s }); }
        M.sync.delete(s);
      } else M.sync.set(s, e);
      if (M.sync.size > 50) M.sync.delete(M.sync.keys().next().value);
    });

    socket.on("rpvp:end", (payload) => {
      const room = myRoom();
      if (!room || room.status !== "match") return;
      const side = sideOf(room, me.id), result = payload?.result;
      if (result !== "a" && result !== "b") return;
      onReport(io, room, side, { result, steps: Number(payload?.steps) || 0, hash: String(payload?.hash || "") });
    });

    socket.on("rpvp:emote", (payload) => {
      const room = myRoom();
      if (!room) return;
      const p = room.players.get(me.id), k = String(payload?.k || "");
      if (!EMOTES.includes(k) || Date.now() - p.lastEmoteAt < EMOTE_GAP_MS) return;
      p.lastEmoteAt = Date.now();
      io.to(roomName(room.id)).emit("rpvp:emote", { playerId: me.id, side: sideOf(room, me.id), k });
    });

    socket.on("rpvp:toLobby", (_p, cb) => {
      const room = myRoom();
      if (!room) return cb?.({ ok: false });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status === "ended") { room.status = "lobby"; broadcast(io, room); }
      cb?.({ ok: true });
    });

    socket.on("rpvp:leaveRoom", (_p, cb) => {
      const room = myRoom();
      if (room) { leavePlayer(io, room, me.id); socket.leave(roomName(room.id)); }
      cb?.({ ok: true });
    });

    socket.on("rpvp:kick", (payload, cb) => {
      const room = myRoom();
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (room.status !== "lobby" && room.status !== "ended") return cb?.({ ok: false, error: "NOT_LOBBY" });
      const t = String(payload?.targetUserId || "");
      if (!t || t === me.id || !room.players.has(t)) return cb?.({ ok: false, error: "INVALID_TARGET" });
      const sid = room.players.get(t).socketId;
      if (sid) { io.to(sid).emit("rpvp:kicked", {}); io.in(sid).socketsLeave(roomName(room.id)); }
      leavePlayer(io, room, t);
      cb?.({ ok: true });
    });

    socket.on("rpvp:requestState", (_p, cb) => {
      const room = myRoom();
      if (!room) return cb?.({ ok: false, error: "NOT_IN_ROOM" });
      cb?.({ ok: true, room: publicRoom(room), match: matchSnapshot(room) });
    });

    socket.on("disconnect", () => {
      const room = myRoom();
      if (!room) return;
      const p = room.players.get(me.id);
      if (!p || p.socketId !== socket.id) return;
      p.connected = false;
      if (room.status === "lobby" || room.status === "ended") {
        if (p.leaveTimer) clearTimeout(p.leaveTimer);
        p.leaveTimer = setTimeout(() => {
          p.leaveTimer = null;
          const r = rooms.get(room.id);
          if (r && r.players.get(me.id) === p && !p.connected && (r.status === "lobby" || r.status === "ended")) leavePlayer(io, r, me.id);
        }, LOBBY_GRACE_MS);
        broadcast(io, room);
        maybeScheduleEmptyDelete(io, room);
      } else {
        if (room.status === "match") pauseFor(io, room, me.id);
        io.to(roomName(room.id)).emit("rpvp:peerUpdate", { playerId: me.id, connected: false });
        broadcast(io, room);
        maybeScheduleEmptyDelete(io, room);
      }
    });
  });
}
