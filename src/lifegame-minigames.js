// =========================
// DUO GAME ZONE — 인생게임 멀티 미니게임 (서버 판정)
// lifegame.js 가 라운드 사이에 호출. 기존 게임 시스템과 격리.
// 모든 판정(시간/정답)은 서버 시계 기준.
// =========================

const INTRO_MS = 3200;
const RESULT_MS = 5500;

const KINDS = {
  reflex: {
    emoji: "⚡", title: "반응속도 대결",
    desc: "화면이 초록색으로 바뀌는 순간 가장 빨리 터치! 너무 일찍 누르면 실격!",
    flavor: "internet", asc: true,
  },
  mash: {
    emoji: "👊", title: "연타 대결",
    desc: "5초 동안 버튼을 최대한 많이 연타하세요!",
    flavor: "power", asc: false,
  },
  stop: {
    emoji: "⏱️", title: "3초 맞추기",
    desc: "숫자가 사라져도 감으로 정확히 3.00초에 멈추세요!",
    flavor: "luck", asc: true,
  },
  math: {
    emoji: "🧮", title: "번개 암산",
    desc: "가장 빨리 정답을 고르세요. 틀리면 탈락!",
    flavor: "intel", asc: true,
  },
  tap: {
    emoji: "🔢", title: "숫자 순서 터치",
    desc: "1부터 9까지 순서대로 가장 빨리 터치! 틀린 숫자는 무시돼요.",
    flavor: "social", asc: true,
  },
};
const KIND_IDS = Object.keys(KINDS);

// 순위별 보상 (1등 / 2등 / 3등 / 그 외 / 기록없음)
const REWARDS = [
  { happy: 6, luck: 3, money: 30 },
  { happy: 3, money: 10 },
  { happy: 1 },
];
const REWARD_REST = {};
const REWARD_DNF = { happy: -3 };
const FLAVOR_BONUS = 5;

function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

function makeMath() {
  let q, ans;
  if (Math.random() < 0.5) {
    const a = rnd(12, 49), b = rnd(12, 49);
    q = `${a} + ${b}`; ans = a + b;
  } else if (Math.random() < 0.5) {
    const a = rnd(11, 39), b = rnd(3, 9);
    q = `${a} × ${b}`; ans = a * b;
  } else {
    const a = rnd(60, 99), b = rnd(11, 39);
    q = `${a} - ${b}`; ans = a - b;
  }
  const set = new Set([ans]);
  while (set.size < 4) {
    const d = rnd(1, 12) * (Math.random() < 0.5 ? -1 : 1);
    const v = ans + d;
    if (v > 0) set.add(v);
  }
  const choices = [...set].sort(() => Math.random() - 0.5);
  return { question: `${q} = ?`, choices, answerIdx: choices.indexOf(ans) };
}

// 숫자 터치: 전원 같은 판 배치 (서버가 1~9를 섞어서 전달)
const TAP_LIMIT_MS = 12000;
const MASH_MAX = 100; // 연타 상한 (클라이언트 화면도 같은 값에서 멈춤 — 화면 숫자와 결과가 어긋나지 않게)
const TAP_MIN_MS = 1200; // 사람이 9번 순서대로 누르는 하한 — 미만이면 비정상 입력(반칙)
function makeTapCells() {
  const cells = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells;
}

// 지속시간을 겨루는 게임(3초 맞추기/숫자 터치)은 클라이언트가 직접 잰 시간을 쓰면 핑(왕복 지연) 차이로 인한 불공정이 없다.
// 서버가 본 시간(= 클라 시간 + 왕복 지연)보다 클 수 없고, 너무 작게(1.5초 초과 차이) 주장하면 조작으로 보고 서버 시간을 쓴다.
function pickElapsed(payload, serverMs) {
  const c = Number(payload?.elapsedMs);
  if (Number.isFinite(c) && c > 0 && c <= serverMs + 150 && c >= serverMs - 1500) return Math.round(c);
  return serverMs;
}

function clearTimers(mini) {
  for (const t of mini.timers) clearTimeout(t);
  mini.timers = [];
}

function later(mini, fn, ms) {
  const t = setTimeout(() => { if (mini.phase !== "done") fn(); }, ms);
  mini.timers.push(t);
}

function activeParticipants(room, mini) {
  return [...mini.participants].filter(uid => {
    const p = room.players.get(uid);
    return p && p.connected;
  });
}

/**
 * @param {object} ctx { room, emit(event,payload), clampStat(key,val), onFinish() }
 * @returns {boolean} 시작 여부 (연결된 인원 2명 미만이면 false)
 */
export function startMinigame(ctx) {
  const { room, emit } = ctx;
  // 이미 진행 중이면 중복 시작 금지 (endRound 이중 호출 방어). 진행 중이므로 "처리됨"으로 반환
  if (room.mini && room.mini.phase !== "done") return true;
  const participants = new Set(
    room.playerOrder.filter(uid => room.players.get(uid)?.connected)
  );
  if (participants.size < 2) return false;

  room.miniUsed = room.miniUsed || new Set();
  let pool = KIND_IDS.filter(k => !room.miniUsed.has(k));
  if (!pool.length) { room.miniUsed.clear(); pool = KIND_IDS.slice(); }
  const kind = pool[Math.floor(Math.random() * pool.length)];
  room.miniUsed.add(kind);

  const mini = {
    kind, phase: "intro", ctx, participants,
    acts: new Map(), timers: [], goAt: null, math: null,
  };
  room.mini = mini;

  const def = KINDS[kind];
  emit("lifegame:miniIntro", {
    kind, emoji: def.emoji, title: def.title, desc: def.desc, introMs: INTRO_MS,
  });
  later(mini, () => beginKind(room, mini), INTRO_MS);
  return true;
}

function beginKind(room, mini) {
  const { emit } = mini.ctx;
  if (mini.kind === "reflex") {
    mini.phase = "wait";
    emit("lifegame:miniWait", { kind: "reflex" });
    later(mini, () => {
      mini.phase = "go";
      mini.goAt = Date.now();
      emit("lifegame:miniGo", { kind: "reflex" });
      later(mini, () => finish(room, mini), 3000);
    }, rnd(1500, 4000));
  } else if (mini.kind === "mash") {
    mini.phase = "go";
    mini.goAt = Date.now();
    emit("lifegame:miniGo", { kind: "mash", durMs: 5000 });
    later(mini, () => finish(room, mini), 5000 + 2500);
  } else if (mini.kind === "stop") {
    mini.phase = "go";
    mini.goAt = Date.now();
    emit("lifegame:miniGo", { kind: "stop", targetMs: 3000 });
    later(mini, () => finish(room, mini), 6500);
  } else if (mini.kind === "tap") {
    mini.phase = "go";
    mini.goAt = Date.now();
    emit("lifegame:miniGo", { kind: "tap", cells: makeTapCells(), limitMs: TAP_LIMIT_MS });
    later(mini, () => finish(room, mini), TAP_LIMIT_MS + 2500);
  } else {
    mini.math = makeMath();
    mini.phase = "go";
    mini.goAt = Date.now();
    emit("lifegame:miniGo", {
      kind: "math", question: mini.math.question, choices: mini.math.choices, limitMs: 10000,
    });
    later(mini, () => finish(room, mini), 10000);
  }
}

/** 클라이언트 입력 처리. 반환: 무시/수락 여부 */
export function handleMiniAct(room, userId, payload) {
  const mini = room.mini;
  if (!mini || mini.phase === "done" || mini.phase === "intro") return false;
  if (!mini.participants.has(userId) || mini.acts.has(userId)) return false;
  const now = Date.now();

  if (mini.kind === "reflex") {
    if (mini.phase === "wait") {
      mini.acts.set(userId, { foul: true, display: "너무 빨랐어요 😵" });
    } else {
      const ms = now - mini.goAt;
      // 사람 반응속도 하한(+핑) 미만 = 초록 직전에 찍은 추측 입력 → 반칙
      if (ms < 100) mini.acts.set(userId, { foul: true, display: "너무 빨랐어요 😵" });
      else mini.acts.set(userId, { value: ms, display: `${ms}ms` });
    }
  } else if (mini.kind === "mash") {
    const count = Math.max(0, Math.min(MASH_MAX, Math.floor(Number(payload?.count) || 0)));
    // 0회 = 자리비움. 순위(2~3등 보상)에 끼지 않도록 기록 없음 처리
    if (count === 0) mini.acts.set(userId, { foul: true, display: "0회 (참여 안 함)" });
    else mini.acts.set(userId, { value: count, display: `${count}회` });
  } else if (mini.kind === "stop") {
    const elapsed = pickElapsed(payload, now - mini.goAt);
    const diff = Math.abs(elapsed - 3000);
    mini.acts.set(userId, { value: diff, display: `${(elapsed / 1000).toFixed(2)}초 (${diff}ms 차이)` });
  } else if (mini.kind === "tap") {
    const serverMs = now - mini.goAt;
    const ms = pickElapsed(payload, serverMs);
    if (payload?.timeout || serverMs > TAP_LIMIT_MS + 2000) mini.acts.set(userId, { foul: true, display: "시간 초과 ⏰" });
    else if (ms < TAP_MIN_MS) mini.acts.set(userId, { foul: true, display: "비정상 기록 😵" });
    else mini.acts.set(userId, { value: ms, display: `${(ms / 1000).toFixed(2)}초` });
  } else if (mini.kind === "math") {
    if (Number(payload?.choiceIdx) === mini.math.answerIdx) {
      const ms = now - mini.goAt;
      mini.acts.set(userId, { value: ms, display: `정답 ${(ms / 1000).toFixed(2)}초` });
    } else {
      mini.acts.set(userId, { foul: true, display: "오답 ❌" });
    }
  }
  checkDone(room, mini);
  return true;
}

/** 이탈/끊김 후 전원 완료 여부 재확인 */
export function recheckMinigame(room) {
  const mini = room.mini;
  if (!mini || mini.phase === "done" || mini.phase === "intro") return;
  checkDone(room, mini);
}

export function abortMinigame(room) {
  const mini = room.mini;
  if (!mini) return;
  mini.phase = "done";
  clearTimers(mini);
  room.mini = null;
}

export function isMinigameActive(room) {
  return !!room.mini && room.mini.phase !== "done";
}

function checkDone(room, mini) {
  const alive = activeParticipants(room, mini);
  if (alive.length === 0) return finish(room, mini);
  if (alive.every(uid => mini.acts.has(uid))) {
    // 반응속도: 전원 반칙으로 wait 중 끝나도 즉시 종료
    finish(room, mini);
  }
}

function finish(room, mini) {
  if (mini.phase === "done") return;
  mini.phase = "done";
  clearTimers(mini);
  const { emit, clampStat, onFinish } = mini.ctx;
  const def = KINDS[mini.kind];

  const rows = [];
  for (const uid of mini.participants) {
    const p = room.players.get(uid);
    if (!p) continue;
    const act = mini.acts.get(uid);
    const valid = act && !act.foul && act.value != null;
    rows.push({
      userId: uid, name: p.name, avatar_url: p.avatar_url || null,
      valid: !!valid, value: valid ? act.value : null,
      display: act ? act.display : "기록 없음",
    });
  }
  rows.sort((a, b) => {
    if (a.valid !== b.valid) return a.valid ? -1 : 1;
    if (!a.valid) return 0;
    return def.asc ? a.value - b.value : b.value - a.value;
  });

  // 동점은 같은 순위
  rows.forEach((r, i) => {
    if (!r.valid) { r.rank = null; return; }
    if (i > 0 && rows[i - 1].valid && rows[i - 1].value === r.value) r.rank = rows[i - 1].rank;
    else r.rank = i + 1;
  });

  const statsAfter = {};
  for (const r of rows) {
    const p = room.players.get(r.userId);
    if (!p) continue;
    let reward = r.valid ? (REWARDS[r.rank - 1] || REWARD_REST) : REWARD_DNF;
    reward = { ...reward };
    if (r.valid && r.rank === 1) reward[def.flavor] = (reward[def.flavor] || 0) + FLAVOR_BONUS;
    r.reward = reward;
    for (const [k, v] of Object.entries(reward)) {
      p.stats[k] = clampStat(k, (p.stats[k] || 0) + v);
    }
    statsAfter[r.userId] = { ...p.stats };
  }

  emit("lifegame:miniResult", {
    kind: mini.kind, emoji: def.emoji, title: def.title, rows, statsAfter, resultMs: RESULT_MS,
  });

  const t = setTimeout(() => {
    if (room.mini === mini) room.mini = null;
    onFinish();
  }, RESULT_MS);
  mini.timers.push(t); // abort 시 같이 정리 (finish 에서 phase=done 이라 later 가드와 무관하게 직접 push)
}
