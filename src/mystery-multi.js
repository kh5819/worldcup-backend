// =========================
// 플듀 미스터리 멀티 (서버) — 'mysm:*' 이벤트, 1~8인
// 모드
//   coop : 방 전체가 사건 세션 1개를 공유 (증거·퍼즐·추리·힌트 공용), 장소 이동은 각자.
//          최종 추리는 전원 투표 (질문별 다수결, 동률이면 방장 선택).
//   race : 같은 사건을 각자 세션으로 풀고 엔딩·정확도·시간으로 순위.
// 서버가 유일한 상태 주인. 모든 행동은 엔진(act)을 거쳐 한 번에 하나씩 처리되므로
// 동시에 정답을 내도 중복 처리되지 않는다 (이미 풀린 퍼즐은 already 응답).
// =========================

import { CASES, defaultCaseId } from "./mystery-cases.js";
import { createSession, act, snapshot, startEvents, publicCaseInfo, buildResult, normalizeFinal, ROLES } from "./mystery-engine.js";

const rooms = new Map();      // roomId → room
const invites = new Map();    // code → roomId
const userRoom = new Map();   // userId → roomId

const MAX_PLAYERS = 8;
const EMPTY_ROOM_TTL_MS = 60_000;
const HOST_HANDOFF_MS = 15_000;
const MAX_NICK_LEN = 14;
const RATE_WINDOW_MS = 5_000;
const RATE_MAX = 40;
const VOTE_LIMIT_MS = Number(process.env.MYS_VOTE_MS) || 120_000; // 테스트에서만 짧게
const PING_GAP_MS = 1500;
const PING_KINDS = new Set(["location", "evidence", "help", "puzzle", "ready", "final"]);
export const ROLE_NAMES = { detective: "탐정", observer: "관찰가", cryptographer: "암호 전문가", archivist: "기록관", psychologist: "심리 분석가", engineer: "기술자", investigator: "조사관", reasoner: "추론가" };

let db = null;

// ---------- 유틸 ----------
function genCode() {
  for (let i = 0; i < 50; i++) {
    const c = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    if (!invites.has(c)) return c;
  }
  return String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0");
}
const chan = (room) => `mysm:${room.id}`;
function rateLimited(socket) {
  const now = Date.now();
  const b = socket.data.mysmRate || (socket.data.mysmRate = []);
  while (b.length && now - b[0] > RATE_WINDOW_MS) b.shift();
  b.push(now);
  return b.length > RATE_MAX;
}
function cleanNick(n, fallback) {
  const s = String(n ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, MAX_NICK_LEN);
  return s || fallback;
}

async function profileOf(me, nick) {
  let name = nick, avatar = null;
  if (!me.isGuest && db) {
    try {
      const { data } = await db.from("profiles").select("nickname, avatar_url").eq("id", me.id).maybeSingle();
      if (data?.nickname) name = data.nickname; // 닉네임은 프로필 우선
      avatar = data?.avatar_url || null;
    } catch { /* 프로필 조회 실패는 무시 */ }
  }
  return { name: cleanNick(name, me.isGuest ? "게스트" : "탐정"), avatar };
}

// ---------- 방 상태 ----------
function sessionFor(room, pid) {
  return room.mode === "coop" ? room.session : room.players.get(pid)?.session;
}

// 협동: 공용 세션에 그 플레이어의 위치를 잠시 넣고 처리 → 다시 저장
// 역할: 접속 중인 사람에게 8개를 돌려 나눈다 (1명이면 8개 전부, 8명이면 1개씩).
// 누가 나가거나 돌아오면 다시 나눈다 → 특정 역할이 없어서 막히는 일이 없다.
function assignRoles(room) {
  const live = [...room.players.values()].filter((p) => p.connected);
  const list = live.length ? live : [...room.players.values()];
  const roles = {};
  for (const p of list) roles[p.id] = [];
  const off = room.roleOffset || 0;
  ROLES.forEach((r, i) => roles[list[(i + off) % list.length].id].push(r));
  room.roles = roles;
}
function viewOpts(room, pid) {
  if (room.mode !== "coop") return undefined; // 경쟁: 각자 혼자 하는 것과 같다 (모든 역할 · 분산 없음)
  const live = [...room.players.values()].filter((p) => p.connected);
  const count = Math.min(Math.max(1, live.length), 3);
  // 지도 퍼즐은 조사관이 0번(지도를 가진 사람)이 되도록 순서를 돌린다
  const inv = live.findIndex((p) => room.roles?.[p.id]?.includes("investigator"));
  const order = inv > 0 ? [...live.slice(inv), ...live.slice(0, inv)] : live;
  const idx = Math.max(0, order.findIndex((p) => p.id === pid));
  return { roles: room.roles?.[pid] || [], split: { index: idx % count, count } };
}

function withPlayer(room, pid, fn) {
  const p = room.players.get(pid);
  const st = sessionFor(room, pid);
  if (!p || !st) return null;
  if (room.mode === "coop") st.scene = p.scene;
  try { return fn(st); } finally { if (room.mode === "coop") p.scene = st.scene; }
}

function playerSnapshot(room, pid) {
  const c = CASES[room.caseId];
  return withPlayer(room, pid, (st) => snapshot(c, st, Date.now(), viewOpts(room, pid)));
}

function publicRoom(room) {
  const c = CASES[room.caseId];
  return {
    id: room.id, code: room.inviteCode, mode: room.mode, status: room.status, host: room.hostUserId,
    maxPlayers: room.maxPlayers, caseId: room.caseId, caseTitle: c.title, caseEpisode: c.presentation?.episode || "",
    voting: room.vote ? { voted: Object.keys(room.vote.ballots), questions: room.vote.questions.length, round: room.vote.round, deadline: room.vote.deadline, decide: room.decide } : null,
    decide: room.decide,
    roles: room.roles || null, roleNames: ROLE_NAMES,
    players: [...room.players.values()].map((p) => ({
      id: p.id, name: p.name, avatar: p.avatar, ready: p.ready, connected: p.connected, isGuest: p.isGuest,
      scene: room.status === "playing" || room.status === "ended" ? c.scenes[p.scene]?.name || null : null,
      activity: p.activity, contrib: p.contrib, done: !!p.result, result: p.result || null,
    })),
    ranking: room.ranking || null,
    teamResult: room.teamResult || null,
  };
}

function broadcastRoom(io, room) { io.to(chan(room)).emit("mysm:room", publicRoom(room)); }

// 각 플레이어에게 자기 위치 기준 스냅샷을 밀어준다 (공용 상태가 바뀌었을 때)
function pushSnapshots(io, room, exceptPid) {
  for (const p of room.players.values()) {
    if (p.id === exceptPid || !p.connected) continue;
    const snap = playerSnapshot(room, p.id);
    for (const sid of p.sockets) io.to(sid).emit("mysm:snap", snap);
  }
}

function emitTo(io, p, ev, data) { for (const sid of p.sockets) io.to(sid).emit(ev, data); }

function newPlayer(me, prof, socket) {
  return {
    id: me.id, name: prof.name, avatar: prof.avatar, isGuest: !!me.isGuest,
    ready: false, connected: true, sockets: new Set([socket.id]),
    scene: null, activity: null, session: null, result: null,
    contrib: { evidence: 0, puzzles: 0, deductions: 0, hints: 0 },
    hostTimer: null,
  };
}

function attachSocket(socket, room, p) {
  p.sockets.add(socket.id);
  const wasOff = !p.connected;
  p.connected = true;
  if (wasOff && room.status === "playing") assignRoles(room);
  clearTimeout(p.hostTimer); p.hostTimer = null;
  socket.join(chan(room));
  userRoom.set(p.id, room.id);
  clearTimeout(room.emptyTimer); room.emptyTimer = null;
}

function pickNewHost(room) {
  const next = [...room.players.values()].find((p) => p.connected && p.id !== room.hostUserId)
    || [...room.players.values()].find((p) => p.id !== room.hostUserId);
  if (next) room.hostUserId = next.id;
}

function destroyRoom(room) {
  clearTimeout(room.emptyTimer);
  for (const p of room.players.values()) { clearTimeout(p.hostTimer); if (userRoom.get(p.id) === room.id) userRoom.delete(p.id); }
  invites.delete(room.inviteCode);
  rooms.delete(room.id);
}

function removePlayer(io, room, pid) {
  const p = room.players.get(pid);
  if (!p) return;
  clearTimeout(p.hostTimer);
  for (const sid of p.sockets) io.sockets.sockets.get(sid)?.leave(chan(room));
  room.players.delete(pid);
  if (userRoom.get(pid) === room.id) userRoom.delete(pid);
  if (room.vote) { delete room.vote.ballots[pid]; maybeCloseVote(io, room); }
  if (!room.players.size) { destroyRoom(room); return; }
  if (room.hostUserId === pid) pickNewHost(room);
  if (room.status === "playing") assignRoles(room);
  if (room.mode === "race" && room.status === "playing") maybeFinishRace(io, room);
  broadcastRoom(io, room);
}

function scheduleEmptyCheck(room) {
  if ([...room.players.values()].some((p) => p.connected)) return;
  clearTimeout(room.emptyTimer);
  room.emptyTimer = setTimeout(() => { if (![...room.players.values()].some((p) => p.connected)) destroyRoom(room); }, EMPTY_ROOM_TTL_MS);
}

// ---------- 결과 기록 ----------
async function recordResult(userKey, caseId, r) {
  if (!db) return;
  try {
    const row = {
      user_key: userKey, case_id: caseId, ending: r.ending, accuracy: r.accuracy, elapsed_sec: r.elapsedSec,
      hints_used: r.hintsUsed, solved_main: r.solvedMain, solved_hidden: r.solvedHidden, titles: r.titles,
    };
    // detail 열은 sql/mystery_results_detail.sql 적용 후에만 — 없으면 빼고 다시
    const { error } = await db.from("mystery_results").insert({ ...row, detail: { chapters: r.chapters, puzzles: r.puzzles } });
    if (error && /detail/.test(error.message || "")) await db.from("mystery_results").insert(row);
  } catch (err) { console.error("[mysm] result 기록 실패", err?.message || err); }
}

// ---------- 팀 알림 ----------
const TEAM_KINDS = new Set(["evidence", "puzzle_solved", "deduction", "unlock", "hint"]);
function teamNotices(room, p, events) {
  const out = [];
  for (const e of events) {
    if (!TEAM_KINDS.has(e.type)) continue;
    if (e.type === "evidence") { p.contrib.evidence++; out.push({ type: "evidence", by: p.name, evidence: e.evidence }); }
    if (e.type === "puzzle_solved") { p.contrib.puzzles++; out.push({ type: "puzzle_solved", by: p.name, puzzle: e.puzzle, title: e.title, hidden: e.hidden }); }
    if (e.type === "deduction") { p.contrib.deductions++; out.push({ type: "deduction", by: p.name, deduction: e.deduction }); }
    if (e.type === "unlock") out.push({ type: "unlock", by: p.name, flag: e.flag });
    if (e.type === "hint") { p.contrib.hints++; out.push({ type: "hint", by: p.name, puzzle: e.puzzle, index: e.index, text: e.text, left: e.left }); }
  }
  for (const e of events) {
    if (e.type === "interrogation") out.push({ type: "inter_open", by: p.name, character: e.view.character });
    if (e.type === "inter_break") out.push({ type: "inter_break", by: p.name, statement: e.statement });
  }
  // 이야기 대사는 따로 (기록관만 전부 받는다)
  const lines = events.filter((e) => e.type === "dialogue").flatMap((e) => e.lines);
  if (lines.length && out.length) out.push({ type: "story", by: p.name, lines });
  return out;
}

// ---------- 협동 최종 투표 ----------
function openVote(io, room, byPid) {
  const c = CASES[room.caseId];
  if (room.vote) return;
  room.vote = { questions: c.final.questions, ballots: {}, openedBy: byPid, round: 1, deadline: Date.now() + VOTE_LIMIT_MS, timer: null };
  armVoteTimer(io, room);
  io.to(chan(room)).emit("mysm:final", { intro: c.final.intro, questions: c.final.questions, by: room.players.get(byPid)?.name, deadline: room.vote.deadline, decide: room.decide });
  broadcastRoom(io, room);
}
// 투표가 무기한 멈추지 않도록: 제한 시간이 지나면 낸 표로 마감 (아무도 안 냈으면 1분 연장)
function armVoteTimer(io, room) {
  const v = room.vote; if (!v) return;
  clearTimeout(v.timer);
  v.timer = setTimeout(() => {
    if (room.vote !== v) return;
    if (!Object.keys(v.ballots).length) { v.deadline = Date.now() + 60_000; armVoteTimer(io, room); broadcastRoom(io, room); return; }
    maybeCloseVote(io, room, true);
  }, Math.max(0, v.deadline - Date.now()));
  v.timer.unref?.();
}

function maybeCloseVote(io, room, force = false) {
  const v = room.vote;
  if (!v) return;
  const voters = [...room.players.values()].filter((p) => p.connected);
  // 방장 단독 결정이면 방장 표만 센다
  if (room.decide === "host") {
    if (!v.ballots[room.hostUserId] && !force) return;
    if (v.ballots[room.hostUserId]) v.ballots = { [room.hostUserId]: v.ballots[room.hostUserId] };
  }
  const allIn = voters.length > 0 && voters.every((p) => v.ballots[p.id]);
  if (!allIn && !force && room.decide !== "host") return;
  if (!Object.keys(v.ballots).length) return;
  // 1차에서 동률인 질문이 있으면 한 번 재투표
  if (v.round === 1 && room.decide !== "host") {
    const tied = v.questions.filter((q) => {
      const cnt = {};
      for (const b of Object.values(v.ballots)) if (b[q.id]) cnt[b[q.id].option] = (cnt[b[q.id].option] || 0) + 1;
      const vals = Object.values(cnt); const mx = Math.max(...vals);
      return vals.filter((x) => x === mx).length > 1;
    }).map((q) => q.id);
    if (tied.length) {
      v.round = 2; v.ballots = {}; v.deadline = Date.now() + VOTE_LIMIT_MS; armVoteTimer(io, room);
      io.to(chan(room)).emit("mysm:revote", { tied, deadline: v.deadline });
      broadcastRoom(io, room);
      return;
    }
  }
  clearTimeout(v.timer);
  // 질문별 다수결, 동률이면 방장 표 → 그래도 없으면 먼저 투표한 사람
  const answers = {};
  const tally = {};
  for (const q of v.questions) {
    const count = {};
    for (const b of Object.values(v.ballots)) if (b[q.id]) count[b[q.id].option] = (count[b[q.id].option] || 0) + 1;
    const max = Math.max(...Object.values(count));
    const top = Object.keys(count).filter((k) => count[k] === max);
    // 재투표에서도 동률이면: 탐정 역할 → 방장 → 먼저 낸 사람 순으로 결정
    const det = Object.keys(room.roles || {}).find((id) => room.roles[id].includes("detective") && v.ballots[id]);
    const detPick = det ? v.ballots[det][q.id]?.option : null;
    const hostPick = v.ballots[room.hostUserId]?.[q.id]?.option;
    const option = top.length === 1 ? top[0] : top.includes(detPick) ? detPick : top.includes(hostPick) ? hostPick : top[0];
    // 근거: 이긴 답을 고른 사람들이 가장 많이 낸 증거
    const ev = {};
    for (const b of Object.values(v.ballots)) if (b[q.id]?.option === option && b[q.id].evidence) ev[b[q.id].evidence] = (ev[b[q.id].evidence] || 0) + 1;
    const evidence = Object.keys(ev).sort((x, y) => ev[y] - ev[x])[0] || null;
    answers[q.id] = { option, evidence };
    tally[q.id] = count;
  }
  room.vote = null;
  const c = CASES[room.caseId];
  const hostId = room.players.has(room.hostUserId) ? room.hostUserId : [...room.players.keys()][0];
  const r = withPlayer(room, hostId, (st) => act(c, st, { type: "final", answers }));
  if (!r?.ok) { broadcastRoom(io, room); return; }
  room.status = "ended";
  const ending = r.events.find((e) => e.type === "ending");
  room.teamResult = { ...ending.result, answers, tally };
  io.to(chan(room)).emit("mysm:ending", { ...ending, answers, tally });
  for (const p of room.players.values()) recordResult(p.id, room.caseId, ending.result);
  broadcastRoom(io, room);
}

// ---------- 경쟁 ----------
function rankRace(room) {
  const tier = { true: 3, normal: 2, bad: 1 };
  return [...room.players.values()].filter((p) => p.result).sort((a, b) =>
    (tier[b.result.ending] - tier[a.result.ending]) || (b.result.accuracy - a.result.accuracy) || (a.result.elapsedSec - b.result.elapsedSec) || (a.result.hintsUsed - b.result.hintsUsed),
  ).map((p, i) => ({ rank: i + 1, id: p.id, name: p.name, ...p.result }));
}
function maybeFinishRace(io, room) {
  room.ranking = rankRace(room);
  const everyone = [...room.players.values()];
  if (everyone.length && everyone.every((p) => p.result)) room.status = "ended";
  broadcastRoom(io, room);
}

// ---------- 등록 ----------
export function registerMysteryMulti(io, supabaseAdmin) {
  db = supabaseAdmin || null;

  io.on("connection", (socket) => {
    const me = socket.user;
    if (!me) return;
    const guard = (cb) => { if (rateLimited(socket)) { cb?.({ ok: false, error: "RATE_LIMITED" }); return false; } return true; };
    const myRoom = () => rooms.get(userRoom.get(me.id));

    socket.on("mysm:create", async (payload, cb) => {
      try {
        if (!guard(cb)) return;
        if (me.isGuest) return cb?.({ ok: false, error: "GUEST_CANNOT_CREATE" });
        const old = myRoom(); if (old) removePlayer(io, old, me.id);
        const mode = payload?.mode === "race" ? "race" : "coop";
        const maxPlayers = Math.min(MAX_PLAYERS, Math.max(1, Number(payload?.maxPlayers) || MAX_PLAYERS));
        const caseId = CASES[payload?.caseId] ? payload.caseId : defaultCaseId();
        const room = {
          id: `mys_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, inviteCode: genCode(),
          hostUserId: me.id, status: "lobby", mode, maxPlayers, caseId,
          players: new Map(), session: null, vote: null, ranking: null, teamResult: null, emptyTimer: null, createdAt: Date.now(),
          decide: payload?.decide === "host" ? "host" : "vote", roles: null, roleOffset: 0, lastPing: new Map(),
        };
        rooms.set(room.id, room); invites.set(room.inviteCode, room.id);
        const p = newPlayer(me, await profileOf(me, payload?.nickname), socket);
        room.players.set(me.id, p);
        attachSocket(socket, room, p);
        cb?.({ ok: true, me: me.id, room: publicRoom(room) });
      } catch (err) { console.error("[mysm:create]", err); cb?.({ ok: false, error: "INTERNAL_ERROR" }); }
    });

    socket.on("mysm:join", async (payload, cb) => {
      try {
        if (!guard(cb)) return;
        const code = String(payload?.code || "").replace(/\D/g, "");
        const room = rooms.get(invites.get(code));
        if (!room) return cb?.({ ok: false, error: "NO_ROOM" });
        const existing = room.players.get(me.id);
        if (existing) { attachSocket(socket, room, existing); broadcastRoom(io, room); return cb?.(joinPayload(room, me.id, true)); }
        if (room.players.size >= room.maxPlayers) return cb?.({ ok: false, error: "ROOM_FULL" });
        if (room.status === "ended") return cb?.({ ok: false, error: "ROOM_ENDED" });
        const old = myRoom(); if (old && old !== room) removePlayer(io, old, me.id);
        const p = newPlayer(me, await profileOf(me, payload?.nickname), socket);
        room.players.set(me.id, p);
        attachSocket(socket, room, p);
        // 진행 중에 들어오면: 협동은 공용 상태를 그대로 받고, 경쟁은 자기 세션을 새로 시작
        let events = [];
        if (room.status === "playing") {
          const c = CASES[room.caseId];
          assignRoles(room);
          p.scene = c.startScene;
          if (room.mode === "race") { p.session = createSession(c); events = startEvents(c, p.session); p.scene = p.session.scene; }
        }
        broadcastRoom(io, room);
        cb?.({ ...joinPayload(room, me.id, false), events });
      } catch (err) { console.error("[mysm:join]", err); cb?.({ ok: false, error: "INTERNAL_ERROR" }); }
    });

    function joinPayload(room, pid, rejoined) {
      const c = CASES[room.caseId];
      const playing = room.status !== "lobby";
      return {
        ok: true, me: pid, rejoined, room: publicRoom(room), case: publicCaseInfo(c),
        snapshot: playing ? playerSnapshot(room, pid) : null,
        voting: room.vote ? { intro: c.final.intro, questions: room.vote.questions, myBallot: room.vote.ballots[pid] || null } : null,
      };
    }

    // 끊겼다 돌아온 경우: 내가 속한 방을 찾아 현재 상태 복원
    socket.on("mysm:rejoin", (payload, cb) => {
      try {
        if (!guard(cb)) return;
        const room = myRoom();
        const p = room?.players.get(me.id);
        if (!room || !p) return cb?.({ ok: false, error: "NO_ROOM" });
        attachSocket(socket, room, p);
        broadcastRoom(io, room);
        cb?.(joinPayload(room, me.id, true));
      } catch (err) { console.error("[mysm:rejoin]", err); cb?.({ ok: false, error: "INTERNAL_ERROR" }); }
    });

    socket.on("mysm:ready", (payload, cb) => {
      const room = myRoom(); const p = room?.players.get(me.id);
      if (!room || !p || room.status !== "lobby") return cb?.({ ok: false, error: "NO_ROOM" });
      p.ready = !!payload?.ready;
      broadcastRoom(io, room);
      cb?.({ ok: true });
    });

    socket.on("mysm:start", (payload, cb) => {
      try {
        if (!guard(cb)) return;
        const room = myRoom();
        if (!room) return cb?.({ ok: false, error: "NO_ROOM" });
        if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
        if (room.status !== "lobby") return cb?.({ ok: false, error: "ALREADY_STARTED" });
        const notReady = [...room.players.values()].filter((p) => p.id !== me.id && p.connected && !p.ready);
        if (notReady.length) return cb?.({ ok: false, error: "NOT_READY", names: notReady.map((p) => p.name) });
        const c = CASES[room.caseId];
        room.status = "playing";
        room.roleOffset = Math.floor(Math.random() * ROLES.length);
        assignRoles(room);
        let sharedEvents = [];
        if (room.mode === "coop") { room.session = createSession(c); sharedEvents = startEvents(c, room.session); }
        for (const p of room.players.values()) {
          let events = sharedEvents;
          if (room.mode === "race") { p.session = createSession(c); events = startEvents(c, p.session); }
          p.scene = c.startScene;
          emitTo(io, p, "mysm:started", { case: publicCaseInfo(c), snapshot: playerSnapshot(room, p.id), events, room: publicRoom(room) });
        }
        broadcastRoom(io, room);
        cb?.({ ok: true });
      } catch (err) { console.error("[mysm:start]", err); cb?.({ ok: false, error: "INTERNAL_ERROR" }); }
    });

    socket.on("mysm:act", (payload, cb) => {
      try {
        if (!guard(cb)) return;
        const room = myRoom(); const p = room?.players.get(me.id);
        if (!room || !p) return cb?.({ ok: false, error: "NO_ROOM" });
        if (room.status !== "playing") return cb?.({ ok: false, error: "NOT_PLAYING" });
        const c = CASES[room.caseId];
        const action = payload?.action || {};
        // 협동의 최종 추리는 투표로만
        if (room.mode === "coop" && action.type === "final") return cb?.({ ok: false, error: "USE_VOTE" });
        const r = withPlayer(room, me.id, (st) => act(c, st, action, Date.now(), viewOpts(room, me.id)));
        if (!r) return cb?.({ ok: false, error: "NO_SESSION" });
        // 지금 보고 있는 퍼즐 (동료 화면에 표시)
        const pz = r.events.find((e) => e.type === "puzzle");
        if (pz) p.activity = { puzzle: pz.puzzle.id, title: pz.puzzle.title };
        if (r.events.some((e) => e.type === "puzzle_solved")) p.activity = null;
        const mySnap = playerSnapshot(room, me.id);

        if (room.mode === "coop") {
          const fin = r.events.find((e) => e.type === "final");
          if (fin) { r.events = r.events.filter((e) => e.type !== "final"); openVote(io, room, me.id); }
          const notices = teamNotices(room, p, r.events);
          if (notices.length) {
            const pub = notices.filter((n) => n.type !== "story");
            const story = notices.filter((n) => n.type === "story");
            for (const o of room.players.values()) {
              if (o.id === me.id || !o.connected) continue;
              const toSend = room.roles?.[o.id]?.includes("archivist") ? notices : pub;
              if (toSend.length) emitTo(io, o, "mysm:team", toSend);
            }
            void story;
          }
          if (r.ok) pushSnapshots(io, room, me.id);
        } else {
          teamNotices(room, p, r.events); // 기여 집계만
          const end = r.events.find((e) => e.type === "ending");
          if (end) {
            p.result = end.result;
            recordResult(p.id, room.caseId, end.result);
            socket.to(chan(room)).emit("mysm:team", [{ type: "race_done", by: p.name, ending: end.ending, title: end.title }]);
            maybeFinishRace(io, room);
          }
        }
        broadcastRoom(io, room);
        cb?.({ ...r, snapshot: mySnap });
      } catch (err) { console.error("[mysm:act]", err); cb?.({ ok: false, error: "INTERNAL_ERROR" }); }
    });

    // 퍼즐 창을 닫았을 때 등 활동 표시 갱신
    socket.on("mysm:presence", (payload, cb) => {
      const room = myRoom(); const p = room?.players.get(me.id);
      if (!room || !p) return cb?.({ ok: false });
      if (payload?.activity === null) p.activity = null;
      broadcastRoom(io, room);
      cb?.({ ok: true });
    });

    socket.on("mysm:vote", (payload, cb) => {
      try {
        if (!guard(cb)) return;
        const room = myRoom();
        if (!room?.vote) return cb?.({ ok: false, error: "NO_VOTE" });
        const ballot = normalizeFinal(CASES[room.caseId], payload?.answers);
        if (!ballot) return cb?.({ ok: false, error: "INCOMPLETE" });
        // 근거 증거는 팀이 실제로 가진 것만
        const own = room.mode === "coop" ? room.session.evidence : room.players.get(me.id)?.session?.evidence || [];
        for (const q of room.vote.questions) if (ballot[q.id].evidence && !own.includes(ballot[q.id].evidence)) ballot[q.id].evidence = null;
        room.vote.ballots[me.id] = ballot;
        broadcastRoom(io, room);
        cb?.({ ok: true });
        maybeCloseVote(io, room);
      } catch (err) { console.error("[mysm:vote]", err); cb?.({ ok: false, error: "INTERNAL_ERROR" }); }
    });

    // 핑: 정해진 종류만 (자유 채팅 없음 → 스팸·신고 부담 없음), 1.5초에 한 번
    socket.on("mysm:ping", (payload, cb) => {
      const room = myRoom(); const p = room?.players.get(me.id);
      if (!room || !p || room.status !== "playing") return cb?.({ ok: false, error: "NO_ROOM" });
      const kind = String(payload?.kind || "");
      if (!PING_KINDS.has(kind)) return cb?.({ ok: false, error: "BAD_PING" });
      const last = room.lastPing.get(me.id) || 0;
      if (Date.now() - last < PING_GAP_MS) return cb?.({ ok: false, error: "RATE_LIMITED" });
      room.lastPing.set(me.id, Date.now());
      const c = CASES[room.caseId];
      const st = sessionFor(room, me.id);
      let ref = null;
      if (kind === "evidence" && st?.evidence.includes(payload?.ref)) ref = { id: payload.ref, name: c.evidence[payload.ref].name };
      io.to(chan(room)).emit("mysm:ping", { by: p.name, byId: me.id, kind, ref, scene: c.scenes[p.scene]?.name || null, activity: p.activity });
      cb?.({ ok: true });
    });
    // 추리 제안: 고른 증거 3장을 팀에 보여 준다 (연결은 각자 보드에서)
    socket.on("mysm:propose", (payload, cb) => {
      const room = myRoom(); const p = room?.players.get(me.id);
      if (!room || !p || room.mode !== "coop" || room.status !== "playing") return cb?.({ ok: false, error: "NO_ROOM" });
      const cards = Array.isArray(payload?.cards) ? payload.cards.slice(0, 3).map(String) : [];
      if (cards.length !== 3 || !cards.every((x) => room.session.evidence.includes(x))) return cb?.({ ok: false, error: "BAD_CARDS" });
      const last = room.lastPing.get(me.id) || 0;
      if (Date.now() - last < PING_GAP_MS) return cb?.({ ok: false, error: "RATE_LIMITED" });
      room.lastPing.set(me.id, Date.now());
      const c = CASES[room.caseId];
      socket.to(chan(room)).emit("mysm:proposal", { by: p.name, byId: me.id, cards, names: cards.map((x) => c.evidence[x].name) });
      cb?.({ ok: true });
    });

    // 방장이 투표를 마감 (아직 안 낸 사람이 오래 자리를 비웠을 때)
    socket.on("mysm:closeVote", (payload, cb) => {
      const room = myRoom();
      if (!room?.vote) return cb?.({ ok: false, error: "NO_VOTE" });
      if (room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      if (!Object.keys(room.vote.ballots).length) return cb?.({ ok: false, error: "NO_BALLOTS" });
      maybeCloseVote(io, room, true);
      cb?.({ ok: true });
    });

    socket.on("mysm:kick", (payload, cb) => {
      const room = myRoom();
      if (!room || room.hostUserId !== me.id) return cb?.({ ok: false, error: "NOT_HOST" });
      const target = room.players.get(payload?.userId);
      if (!target || target.id === me.id) return cb?.({ ok: false, error: "NO_PLAYER" });
      emitTo(io, target, "mysm:kicked", {});
      removePlayer(io, room, target.id);
      cb?.({ ok: true });
    });

    socket.on("mysm:leave", (payload, cb) => {
      const room = myRoom();
      if (room) removePlayer(io, room, me.id);
      cb?.({ ok: true });
    });

    socket.on("disconnect", () => {
      const room = myRoom(); const p = room?.players.get(me.id);
      if (!room || !p) return;
      p.sockets.delete(socket.id);
      if (p.sockets.size) return;
      p.connected = false;
      p.activity = null;
      if (room.status === "playing") { assignRoles(room); pushSnapshots(io, room, null); }
      // 대기실에서 나가면 바로 정리, 게임 중이면 자리 유지 (재접속 대비)
      if (room.status === "lobby") { removePlayer(io, room, me.id); return; }
      if (room.hostUserId === me.id) {
        p.hostTimer = setTimeout(() => { if (!p.connected && room.hostUserId === me.id) { pickNewHost(room); broadcastRoom(io, room); } }, HOST_HANDOFF_MS);
      }
      if (room.vote) maybeCloseVote(io, room); // 남은 사람이 모두 투표했으면 마감
      scheduleEmptyCheck(room);
      broadcastRoom(io, room);
    });
  });
}

// 테스트용
export const _mysmRooms = rooms;
