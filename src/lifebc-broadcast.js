// =========================
// 인생 방송국 — 스트리머 모드 (lbc:*)
// 시뮬레이션은 스트리머 브라우저에서 돈다. 서버는 시청자 참여만 책임진다:
//   · 투표(사건 결정·편성·MVP): 1인 1표, 마감 후 무효, 결과는 서버가 셈
//   · 예측(우승자·커플 성사 등): 게임 포인트만(현금성 없음), 맞히면 점수, 시청자 순위
//   · 출연 신청: 닉네임·외형·성격·목표 → 스트리머가 승인/추첨 → 게임에 출연자로 들어감
// 진행 중 상태는 메모리 (서버 재시작 시 방송 끝남). DB 안 씀.
// =========================
const BC = new Map();
let IO = null;
const MAX_VIEWERS = Number(process.env.LBC_MAX || 5000), MAX_APPS = 300, TTL = 8 * 3600e3;
const now = () => Date.now();
const room = (id) => `lbc:${id}`;
const bcId = () => { const a = "abcdefghjkmnpqrstuvwxyz23456789"; let s = ""; for (let i = 0; i < 8; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u001f<>`]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const sockIp = (s) => String(s.handshake.headers["x-forwarded-for"] || s.handshake.address || "").split(",")[0].trim();
const ipMakes = new Map();

// 닉네임 거르기 (욕설·운영자 사칭·링크)
const BAD = ["시발", "씨발", "ㅅㅂ", "병신", "ㅂㅅ", "좆", "존나", "개새", "느금", "니애미", "애미", "섹스", "fuck", "shit", "bitch", "nigger", "운영자", "관리자", "admin", "playduo", "플레이듀오", "http", "www.", ".com", ".kr"];
// 치지직·SOOP·씨미 채팅 표 (!1 ~ !6) — index.js의 채팅 다리가 부름. 한 채팅 계정당 한 표, 바꾸면 옮김
export function lbcChatVote(bcId, voterKey, n) {
  const b = BC.get(String(bcId || "")); if (!b || b.ended) return null; const t = now();
  const P = b.poll && !b.poll.closed && t <= b.poll.deadline + 500 ? b.poll : null;
  const R = !P && b.pred && !b.pred.locked && !b.pred.settled && t <= b.pred.deadline + 500 ? b.pred : null;
  const box = P || R; if (!box) return null;
  const opt = box.opts[(n | 0) - 1]; if (!opt) return null;
  const map = P ? P.votes : R.picks, prev = map.get(voterKey);
  if (prev === opt.id) return { kind: P ? "poll" : "pred", opt: opt.id, dup: true };
  if (prev != null) box.counts[prev] = Math.max(0, (box.counts[prev] || 1) - 1);
  map.set(voterKey, opt.id); box.counts[opt.id] = (box.counts[opt.id] || 0) + 1; b.chatVotes = (b.chatVotes || 0) + 1;
  if (prev == null) chatWallet(b, voterKey, "").pts += VOTE_PTS;
  if (IO) emitState(IO, b);
  return { kind: P ? "poll" : "pred", opt: opt.id };
}
// ----- 후원 방송 모드: 치지직·씨미(공식 후원 이벤트)·SOOP(별풍선, 비공식) → 스트리머 화면으로 그대로 전달 -----
// 금액 → 효과는 스트리머 브라우저(시뮬레이션)가 정함. 서버는 금액 읽기·중복 거르기·전달·최근 기록(재접속용)만.
const SOOP_BALLOON_KRW = 100; let donSeq = 0;
export function lbcDonation(bcId, platform, raw) {
  const b = BC.get(String(bcId || "")); if (!b || b.ended || !b.don || !IO) return null;
  let d = raw; if (typeof d === "string") { try { d = JSON.parse(d); } catch { return null; } }
  if (!d || typeof d !== "object") return null;
  let amount = null, beam = null;
  if (platform === "chzzk") { const n = Number(String(d.payAmount ?? "").replace(/[,\s]/g, "")); amount = Number.isSafeInteger(n) && n > 0 && n <= 1e8 ? n : null; } // 원
  else if (platform === "soop") { const n = Number(d.balloons); amount = Number.isSafeInteger(n) && n > 0 && n <= 1e6 ? n * SOOP_BALLOON_KRW : null; } // 별풍선 1개 = 100원
  else if (platform === "cime") { const n = Number(d.payAmountNumber ?? d.payAmount); beam = Number.isFinite(n) && n > 0 && n <= 1e8 ? n : null; } // 빔 → 원 환산은 스트리머 설정
  if (amount == null && beam == null) return null;
  const donor = clean(d.donatorNickname, 16), text = clean(d.donationText, 80), t = now();
  // 치지직·씨미는 후원마다 고유 번호가 없음 → 같은 내용이 3초 안에 또 오면 같은 후원으로 봄 (SOOP은 연달아 쏘기가 많아 안 거름)
  if (platform !== "soop") {
    const k = [platform, d.donatorChannelId || "anon", amount ?? beam, text].join("|"), rc = b.donRecent || (b.donRecent = new Map());
    const prev = rc.get(k); if (prev != null && t - prev < 3000) return null;
    rc.set(k, t); if (rc.size > 300) for (const [kk, v] of rc) if (t - v > 3000) rc.delete(kk);
  }
  const ev = { did: "d" + ++donSeq + "_" + t.toString(36), platform, donor, amount, beam, text, at: t };
  (b.donLog = b.donLog || []).push(ev); if (b.donLog.length > 200) b.donLog.shift();
  b.donCount = (b.donCount || 0) + 1;
  IO.to(`lbcu:${b.id}:${b.hostKey}`).emit("lbc:donation", ev);
  return ev;
}
export const lbcIsDon = (bcId) => !!BC.get(String(bcId || ""))?.don;
// 후원 연결 허가: 방송을 만든 스트리머만 받은 비밀키가 맞아야 함
export function lbcDonKeyOk(bcId, k) { const b = BC.get(String(bcId || "")); return !!b && !b.ended && !!b.don && !!b.donKey && typeof k === "string" && k.length === b.donKey.length && k === b.donKey; }
export const lbcExists = (bcId) => { const b = BC.get(String(bcId || "")); return !!b && !b.ended; };
export function nickOk(n) { const s = String(n || "").toLowerCase().replace(/\s/g, ""); if (!s) return false; return !BAD.some((w) => s.includes(w)); }
// 글자 묶음({ko,ja,en} 또는 문자열) 안전하게
function txt(v, n = 80) { if (typeof v === "string") return clean(v, n); if (v && typeof v === "object") { const o = {}; for (const k of ["ko", "ja", "en"]) if (v[k] != null) o[k] = clean(v[k], n); return o.ko || o.ja || o.en ? o : ""; } return ""; }
const INTENSITY = ["off", "low", "normal", "high"];
const LOOK_MAX = { base: 5, hair: 9, shirt: 9, pants: 5, skin: 3 };
const PRESETS = ["leader", "joker", "romantic", "schemer", "worker", "free"];
const GOALS = ["star", "love", "win", "friends", "chaos"];
// ----- 시청자 사건 카드 (게임 포인트만 씀 · 현금성 없음) — 프론트 cards.js와 같은 값 -----
export const CARD_COST = { confess: 30, gift: 10, prank: 20, rumor: 25, challenge: 25, fight: 30, cheer: 10 };
const CARD_TWO = { confess: 1, gift: 1, prank: 1, rumor: 1, challenge: 1, fight: 1 };
export const CHAT_CARD = { 고백: "confess", 告白: "confess", confess: "confess", 선물: "gift", プレゼント: "gift", gift: "gift", 몰카: "prank", 몰래카메라: "prank", ドッキリ: "prank", prank: "prank",
  뒷담: "rumor", 뒷담화: "rumor", 소문: "rumor", 陰口: "rumor", 噂: "rumor", rumor: "rumor", 대결: "challenge", 対決: "challenge", duel: "challenge", 싸움: "fight", ケンカ: "fight", 喧嘩: "fight", fight: "fight", 응원: "cheer", 応援: "cheer", cheer: "cheer" };
const START_PTS = 30, VOTE_PTS = 2, CARD_CD = 45e3, CARD_STALE = 120e3;
// 시청자가 아무리 많아도 방송 전체로 카드는 이 간격에 하나만 받음 (개입 강도별). 막힌 사람은 포인트·쿨타임 그대로
const CARD_GAP = { low: 90e3, normal: 45e3, high: 25e3 }, CARD_QMAX = { low: 1, normal: 2, high: 4 };
// 대기 중 카드 정리: 스트리머가 2분 동안 처리 못 하면 포인트 돌려줌
function sweepCards(b) { const t = now(); for (const r of [...(b.cardQ || [])]) if (t - r.at > CARD_STALE) { b.cardQ = b.cardQ.filter((x) => x !== r); refund(b, r); if (!r.chat) IO?.to(`lbcu:${b.id}:${r.key}`).emit("lbc:cardResult", { id: b.id, rid: r.rid, ok: false, good: false, text: null }); } }
function wallet(b, r) { return r.chat ? (b.chatW?.get(r.key) || null) : b.viewers.get(r.key) || null; }
function refund(b, r) { const w = wallet(b, r); if (w) w.pts += r.cost; }
// 카드 요청 넣기 (폰·채팅 공용). 돌려줌: { ok, error, rid }
function pushCard(io, b, key, w, nick, card, x, y, chat) {
  if (b.ended) return { ok: false, error: "BC_CLOSED" }; if (b.intensity === "off") return { ok: false, error: "APPLY_OFF" };
  const cost = CARD_COST[card]; if (!cost) return { ok: false, error: "BAD_CARD" };
  if (!x || (CARD_TWO[card] && (!y || x === y))) return { ok: false, error: "BAD_TARGET" };
  sweepCards(b); const t = now();
  if (w.cardAt && t - w.cardAt < CARD_CD) return { ok: false, error: "CARD_COOLDOWN", wait: Math.ceil((CARD_CD - (t - w.cardAt)) / 1000) };
  const gap = _lbcTest.gap ?? CARD_GAP[b.intensity] ?? CARD_GAP.normal, gapLeft = gap - (t - (b.cardLastAt || 0));
  if (gapLeft > 0) return { ok: false, error: "CARD_BUSY", wait: Math.ceil(gapLeft / 1000) };
  if ((b.cardQ || []).length >= (CARD_QMAX[b.intensity] ?? CARD_QMAX.normal)) return { ok: false, error: "CARD_BUSY", wait: Math.ceil(gap / 1000) };
  if (w.pts < cost) return { ok: false, error: "NO_POINTS", need: cost, pts: w.pts };
  w.pts -= cost; w.cardAt = t; b.cardLastAt = t;
  const r = { rid: "c" + ++b.pseq, card, a: x, b: CARD_TWO[card] ? y : null, nick: clean(nick, 16) || "?", key, chat: !!chat, cost, at: t };
  (b.cardQ = b.cardQ || []).push(r);
  const { key: _k, ...pub } = r; io.to(`lbcu:${b.id}:${b.hostKey}`).emit("lbc:cardReq", pub);
  emitState(io, b); return { ok: true, rid: r.rid, pts: w.pts };
}
// 치지직·SOOP·씨미 채팅: !고백 철수 영희 — 채팅 계정마다 지갑 (처음 30점, 투표 +2)
export function lbcChatCard(bcId, voterKey, nick, card, x, y) {
  const b = BC.get(String(bcId || "")); if (!b || b.ended || !IO) return null;
  const w = chatWallet(b, voterKey, nick); return pushCard(IO, b, voterKey, w, nick, card, clean(x, 20), clean(y, 20), true);
}
function chatWallet(b, key, nick) { b.chatW = b.chatW || new Map(); let w = b.chatW.get(key); if (!w) { if (b.chatW.size > 20000) b.chatW.clear(); w = { pts: START_PTS, nick: clean(nick, 16) }; b.chatW.set(key, w); } return w; }

function pubPoll(p) { if (!p) return null; return { id: p.id, kind: p.kind, q: p.q, opts: p.opts, deadline: p.deadline, closed: p.closed, counts: p.counts, total: p.votes.size, result: p.result ?? null }; }
function pubPred(p) { if (!p) return null; return { id: p.id, q: p.q, opts: p.opts, deadline: p.deadline, locked: p.locked, settled: p.settled, answer: p.answer ?? null, counts: p.counts, total: p.picks.size, winners: p.winners ?? null }; }
function board(b) { const arr = [...b.viewers.values()].filter((v) => !v.host).sort((x, y) => y.pts - x.pts || x.no - y.no); return { top: arr.slice(0, 10).map((v) => ({ nick: v.nick, pts: v.pts })), players: arr.length }; }
function pubState(b) {
  return { season: b.season ? { at: b.season.at, pub: b.season.pub } : null, id: b.id, title: b.title, nick: b.nick, lang: b.lang, intensity: b.intensity, viewers: Math.max(0, b.viewers.size - 1), status: b.status, poll: pubPoll(b.poll), pred: pubPred(b.pred), board: board(b), apps: b.apps.length, cast: b.castNicks, notice: b.notice, cardCost: CARD_COST, cardQ: (b.cardQ || []).length, ended: !!b.ended, serverNow: now() };
}
function emitState(io, b, force = false) {
  const t = now();
  if (!force && t - b.emitAt < 500) { if (!b.emitT) b.emitT = setTimeout(() => { b.emitT = null; emitState(io, b, true); }, 500 - (t - b.emitAt)); return; }
  b.emitAt = t; io.to(room(b.id)).emit("lbc:state", pubState(b));
}
function opts(list) { if (!Array.isArray(list)) return null; const out = list.slice(0, 6).map((o, i) => ({ id: clean(o?.id ?? i, 24) || String(i), label: txt(o?.label, 60) })).filter((o) => o.label); return out.length >= 2 ? out : null; }
function closePoll(io, b) {
  const p = b.poll; if (!p || p.closed) return null; clearTimeout(p.timer); p.closed = true;
  let best = null; for (const o of p.opts) if (!best || (p.counts[o.id] || 0) > (p.counts[best.id] || 0)) best = o;
  const tie = p.opts.filter((o) => (p.counts[o.id] || 0) === (p.counts[best.id] || 0));
  p.result = p.votes.size ? (tie.length > 1 ? tie[Math.floor(Math.random() * tie.length)].id : best.id) : null; // 동점은 추첨, 0표면 null(스트리머가 결정)
  emitState(io, b, true); return p.result;
}

export function registerLifeBroadcast(io, sb, app) {
  IO = io;
  setInterval(() => { const t = now(); for (const [id, b] of BC) if (t - (b.lastAt || b.createdAt) > TTL || (b.ended && t - b.endedAt > (b.season ? 7200e3 : 600e3))) { clearTimeout(b.poll?.timer); clearTimeout(b.pred?.timer); BC.delete(id); } }, 10 * 60e3).unref?.();
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    const key = (me.isGuest ? "g:" : "u:") + me.id;
    let win = now(), cnt = 0;
    const limited = () => { const n = now(); if (n - win > 10000) { win = n; cnt = 0; } return ++cnt > Number(process.env.LBC_RL || 80); };
    const on = (ev, fn) => socket.on(ev, async (p, cb) => { const reply = typeof cb === "function" ? cb : () => {}; if (limited()) return reply({ ok: false, error: "RATE_LIMITED" }); try { await fn(p && typeof p === "object" ? p : {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); } });
    const mine = (id) => { const b = BC.get(String(id || "")); if (!b || b.hostKey !== key || b.ended) return null; b.lastAt = now(); return b; };
    const get = (id) => BC.get(String(id || "")) || null;
    const uroom = (id) => `lbcu:${id}:${key}`; // 이 시청자 개인 알림 (강퇴·닉네임 변경)

    on("lbc:create", (p, reply) => {
      const nick = clean(p.nick, 16); if (!nick) return reply({ ok: false, error: "NEED_NICK" }); if (!nickOk(nick)) return reply({ ok: false, error: "BAD_NICK" });
      if (me.isGuest) { const ip = sockIp(socket), arr = (ipMakes.get(ip) || []).filter((t) => now() - t < 600000); if (arr.length >= 5) return reply({ ok: false, error: "RATE_LIMITED" }); arr.push(now()); ipMakes.set(ip, arr); if (ipMakes.size > 5000) ipMakes.clear(); }
      for (const b of BC.values()) if (b.hostKey === key && !b.ended) { b.ended = true; b.endedAt = now(); emitState(io, b, true); } // 한 사람당 방송 1개
      const id = bcId();
      const b = { id, hostKey: key, nick, title: clean(p.title, 40) || nick, lang: ["ko", "ja", "en"].includes(p.lang) ? p.lang : "ko", intensity: INTENSITY.includes(p.intensity) ? p.intensity : "normal",
        hostTok: bcId() + bcId() + bcId(), lastAt: now(), don: !!p.don, donKey: p.don ? bcId() + bcId() : null, viewers: new Map([[key, { nick: `📺 ${nick}`, pts: 0, no: 0, host: true }]]), seq: 0, poll: null, pred: null, apps: [], accepted: new Set(), castNicks: [], status: null, notice: null, createdAt: now(), emitAt: 0, emitT: null, pseq: 0 };
      BC.set(id, b); socket.join(room(id)); socket.join(uroom(id)); reply({ ok: true, id, state: pubState(b), donKey: b.donKey, hostTok: b.hostTok });
      // admin 「📺 스트리머」 목록 — 인생 방송국 (게스트도 기록, 회원이면 host_user_id 남김)
      if (sb) Promise.resolve(sb.from("streamer_chat_log").insert({ platform: "lifebc", channel_id: id, nickname: nick, content_id: null, content_title: b.don ? `💝 후원 방송 모드 · ${b.title}`.slice(0, 120) : b.title, content_mode: b.don ? "donation" : b.intensity, room_code: id, host_user_id: me.isGuest ? null : me.id, host_nick: me.isGuest ? `게스트 ${nick}` : nick })).then((r) => r?.error && console.error("[lbc] streamer log", r.error.message), () => {});
    });
    // 후원 방송 모드: 스트리머가 다시 연결됐을 때 놓친 후원 받기 (방장만)
    on("lbc:donLog", (p, reply) => { const b = mine(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); reply({ ok: true, rows: (b.donLog || []).slice(-60) }); });
    on("lbc:watch", (p, reply) => { const b = get(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); if (b.banned?.has(key)) return reply({ ok: false, error: "KICKED" });
      // 방장 다시 붙기: 로그인·로그아웃이나 재연결로 계정이 바뀌어도, 방송을 만들 때 받은 자격표가 맞으면 지금 계정을 방장으로
      if (!b.ended && b.hostTok && b.hostKey !== key && typeof p.hostTok === "string" && p.hostTok.length === b.hostTok.length && p.hostTok === b.hostTok) {
        const hv = b.viewers.get(b.hostKey); b.viewers.delete(b.hostKey); b.viewers.delete(key); b.viewers.set(key, hv || { nick: `📺 ${b.nick}`, pts: 0, no: 0, host: true });
        b.hostKey = key; b.lastAt = now();
      } socket.join(room(b.id)); socket.join(uroom(b.id)); reply({ ok: true, host: b.hostKey === key, state: pubState(b), donKey: b.hostKey === key ? b.donKey : null }); });
    on("lbc:join", (p, reply) => {
      const b = get(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); if (b.ended) return reply({ ok: false, error: "BC_CLOSED" });
      if (b.banned?.has(key)) return reply({ ok: false, error: "KICKED" });
      let v = b.viewers.get(key);
      if (!v) { if (b.viewers.size >= MAX_VIEWERS) return reply({ ok: false, error: "ROOM_FULL" }); const nick = clean(p.nick, 12); if (!nick) return reply({ ok: false, error: "NEED_NICK" }); if (!nickOk(nick)) return reply({ ok: false, error: "BAD_NICK" }); v = { nick, pts: START_PTS, no: ++b.seq }; b.viewers.set(key, v); emitState(io, b); }
      socket.join(room(b.id)); socket.join(uroom(b.id)); reply({ ok: true, nick: v.nick, pts: v.pts, state: pubState(b) });
    });
    on("lbc:me", (p, reply) => { const b = get(p.id); const v = b?.viewers.get(key); if (!v) return reply({ ok: false, error: "NOT_JOINED" }); const all = [...b.viewers.values()].filter((x) => !x.host).sort((x, y) => y.pts - x.pts); const app_ = b.apps.find((a) => a.key === key); reply({ ok: true, nick: v.nick, pts: v.pts, rank: v.host ? null : all.filter((x) => x.pts > v.pts).length + 1, of: all.length, vote: b.poll ? b.poll.votes.get(key) ?? null : null, pick: b.pred ? b.pred.picks.get(key) ?? null : null, applied: !!app_, accepted: b.accepted.has(key), cardWait: v.cardAt ? Math.max(0, Math.ceil((CARD_CD - (now() - v.cardAt)) / 1000)) : 0 }); });

    // 스트리머 화면이 보내는 게임 상황 (시청자 폰 화면에 표시) — 크기 제한
    on("lbc:status", (p, reply) => { const b = mine(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); sweepCards(b); const s = p.status || {};
      b.status = { day: s.day | 0, time: clean(s.time, 5), money: Math.round(Number(s.money) || 0), rating: Math.round((Number(s.rating) || 0) * 10) / 10, show: txt(s.show, 40), ticker: Array.isArray(s.ticker) ? s.ticker.slice(0, 4).map((x) => txt(x, 120)).filter(Boolean) : [], cast: Array.isArray(s.cast) ? s.cast.slice(0, 16).map((c) => ({ id: clean(c?.id, 24), name: txt(c?.name, 20), mood: clean(c?.mood, 4), doing: txt(c?.doing, 30), me: !!c?.me })) : [],
        soc: s.soc && typeof s.soc === "object" ? { al: Array.isArray(s.soc.al) ? s.soc.al.slice(0, 8).map((x) => ({ a: txt(x?.a, 20), b: txt(x?.b, 20), t: txt(x?.t, 30), on: !!x?.on })) : [], rev: Array.isArray(s.soc.rev) ? s.soc.rev.slice(0, 5).map((x) => txt(x, 120)).filter(Boolean) : [], iv: s.soc.iv && typeof s.soc.iv === "object" ? { who: txt(s.soc.iv.who, 20), lines: Array.isArray(s.soc.iv.lines) ? s.soc.iv.lines.slice(0, 3).map((l) => ({ q: txt(l?.q, 80), a: txt(l?.a, 160), h: ["honest", "partial", "evade", "lie", "hint"].includes(l?.h) ? l.h : null })) : [] } : null } : null };
      emitState(io, b); reply({ ok: true }); });
    on("lbc:intensity", (p, reply) => { const b = mine(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); if (INTENSITY.includes(p.level)) b.intensity = p.level; emitState(io, b, true); reply({ ok: true }); });

    // ----- 투표 -----
    on("lbc:poll", (p, reply) => {
      const b = mine(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); if (b.poll && !b.poll.closed) closePoll(io, b);
      const o = opts(p.opts), q = txt(p.q, 120); if (!o || !q) return reply({ ok: false, error: "BAD_POLL" });
      const sec = Math.max(8, Math.min(90, Number(p.sec) || 20));
      b.poll = { id: "p" + ++b.pseq, kind: clean(p.kind, 16) || "event", q, opts: o, deadline: now() + sec * 1000, closed: false, votes: new Map(), counts: {}, result: undefined };
      b.poll.timer = setTimeout(() => closePoll(io, b), sec * 1000 + 300);
      emitState(io, b, true); reply({ ok: true, pollId: b.poll.id });
    });
    on("lbc:vote", (p, reply) => {
      const b = get(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); const P = b.poll;
      if (!P || P.closed || P.id !== p.pollId) return reply({ ok: false, error: "POLL_CLOSED" }); if (now() > P.deadline + 500) return reply({ ok: false, error: "TIME_UP" });
      if (!b.viewers.has(key)) return reply({ ok: false, error: "NOT_JOINED" }); if (b.viewers.get(key).host) return reply({ ok: false, error: "HOST_NO_VOTE" });
      const opt = String(p.opt); if (!P.opts.some((o) => o.id === opt)) return reply({ ok: false, error: "BAD_OPT" });
      if (P.votes.has(key)) return reply({ ok: true, dup: true, opt: P.votes.get(key) });
      P.votes.set(key, opt); P.counts[opt] = (P.counts[opt] || 0) + 1; b.viewers.get(key).pts += VOTE_PTS; emitState(io, b); reply({ ok: true, pts: b.viewers.get(key).pts });
    });
    on("lbc:pollClose", (p, reply) => { const b = mine(p.id); if (!b || !b.poll) return reply({ ok: false, error: "NOT_HOST" }); const r = b.poll.closed ? b.poll.result : closePoll(io, b); reply({ ok: true, result: r, counts: b.poll.counts, total: b.poll.votes.size }); });

    // ----- 예측 (게임 포인트) -----
    on("lbc:pred", (p, reply) => {
      const b = mine(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" });
      const o = opts(p.opts), q = txt(p.q, 120); if (!o || !q) return reply({ ok: false, error: "BAD_PRED" });
      const sec = Math.max(8, Math.min(120, Number(p.sec) || 30));
      clearTimeout(b.pred?.timer);
      b.pred = { id: "r" + ++b.pseq, q, opts: o, deadline: now() + sec * 1000, locked: false, settled: false, picks: new Map(), counts: {}, pts: Math.max(5, Math.min(50, Number(p.pts) || 10)) };
      b.pred.timer = setTimeout(() => { if (b.pred && !b.pred.locked) { b.pred.locked = true; emitState(io, b, true); } }, sec * 1000 + 300);
      emitState(io, b, true); reply({ ok: true, predId: b.pred.id });
    });
    on("lbc:predict", (p, reply) => {
      const b = get(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); const P = b.pred;
      if (!P || P.locked || P.id !== p.predId || now() > P.deadline + 500) return reply({ ok: false, error: "PRED_LOCKED" });
      const v = b.viewers.get(key); if (!v) return reply({ ok: false, error: "NOT_JOINED" }); if (v.host) return reply({ ok: false, error: "HOST_NO_VOTE" });
      const opt = String(p.opt); if (!P.opts.some((o) => o.id === opt)) return reply({ ok: false, error: "BAD_OPT" });
      if (P.picks.has(key)) return reply({ ok: true, dup: true, opt: P.picks.get(key) });
      P.picks.set(key, opt); P.counts[opt] = (P.counts[opt] || 0) + 1; emitState(io, b); reply({ ok: true });
    });
    on("lbc:predLock", (p, reply) => { const b = mine(p.id); if (!b?.pred) return reply({ ok: false, error: "NOT_HOST" }); clearTimeout(b.pred.timer); b.pred.locked = true; emitState(io, b, true); reply({ ok: true }); });
    on("lbc:predSettle", (p, reply) => {
      const b = mine(p.id); const P = b?.pred; if (!P || P.id !== p.predId) return reply({ ok: false, error: "NOT_HOST" }); if (P.settled) return reply({ ok: true, dup: true, winners: P.winners });
      clearTimeout(P.timer); P.locked = true; P.settled = true; P.answer = p.answer == null ? null : String(p.answer);
      let n = 0; const hit = P.answer == null ? [] : [...P.picks.entries()].filter(([, o]) => o === P.answer).map(([k]) => k);
      const bonus = hit.length && P.picks.size ? Math.round(P.pts * Math.min(3, P.picks.size / hit.length) * 0.5) : 0; // 적게 맞힐수록 보너스
      for (const k of hit) { const v = b.viewers.get(k); if (v) { v.pts += P.pts + bonus; n++; } }
      P.winners = { n, total: P.picks.size, pts: P.pts + bonus };
      emitState(io, b, true); reply({ ok: true, winners: P.winners });
    });

    // ----- 출연 신청 -----
    on("lbc:apply", (p, reply) => {
      const b = get(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); if (b.ended) return reply({ ok: false, error: "BC_CLOSED" });
      if (b.intensity === "off") return reply({ ok: false, error: "APPLY_OFF" });
      const v = b.viewers.get(key); if (!v) return reply({ ok: false, error: "NOT_JOINED" }); if (v.host) return reply({ ok: false, error: "HOST_NO_VOTE" });
      if (b.accepted.has(key)) return reply({ ok: false, error: "ALREADY_CAST" });
      if (b.apps.some((a) => a.key === key)) return reply({ ok: true, dup: true });
      if (b.apps.length >= MAX_APPS) return reply({ ok: false, error: "APPS_FULL" });
      const nick = clean(p.nick || v.nick, 10); if (!nick || !nickOk(nick)) return reply({ ok: false, error: "BAD_NICK" });
      const look = {}; for (const k in LOOK_MAX) look[k] = Math.max(0, Math.min(LOOK_MAX[k], Number(p.look?.[k]) | 0));
      const app = { id: "a" + ++b.pseq, key, nick, look, preset: PRESETS.includes(p.preset) ? p.preset : "free", goal: GOALS.includes(p.goal) ? p.goal : "star", at: now() };
      b.apps.push(app); emitState(io, b); reply({ ok: true, appId: app.id });
    });
    on("lbc:apps", (p, reply) => { const b = mine(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); reply({ ok: true, rows: b.apps.slice(-100).map(({ key: _k, ...a }) => a) }); });
    const take = (b, app) => { b.apps = b.apps.filter((a) => a !== app); b.accepted.add(app.key); (b.castApp = b.castApp || new Map()).set(String(app.id), app.key); b.castNicks.push(app.nick); b.notice = { kind: "cast", nick: app.nick, at: now() }; emitState(io, b, true); const { key: _k, ...pub } = app; return pub; };
    on("lbc:accept", (p, reply) => { const b = mine(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); const app = b.apps.find((a) => a.id === p.appId); if (!app) return reply({ ok: false, error: "APP_NOT_FOUND" }); reply({ ok: true, app: take(b, app) }); });
    on("lbc:draw", (p, reply) => { const b = mine(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); if (!b.apps.length) return reply({ ok: false, error: "NO_APPS" }); reply({ ok: true, app: take(b, b.apps[Math.floor(Math.random() * b.apps.length)]) }); });
    on("lbc:reject", (p, reply) => { const b = mine(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); b.apps = b.apps.filter((a) => a.id !== p.appId); emitState(io, b); reply({ ok: true }); });
    // 시즌 결과: 스트리머가 보낸 시청자 출연자 카드를 '수락한 신청서 → 그 시청자'로만 연결 (다른 사람 것은 못 봄)
    on("lbc:season", (p, reply) => {
      const b = mine(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" });
      const raw = JSON.stringify(p.cards || []).length + JSON.stringify(p.pub || {}).length; if (raw > 300000) return reply({ ok: false, error: "TOO_BIG" });
      const cards = new Map(); let linked = 0;
      for (const c of Array.isArray(p.cards) ? p.cards.slice(0, 20) : []) { const k = b.castApp?.get(String(c?.appId || "")); if (k && c.card && typeof c.card === "object") { cards.set(k, c.card); linked++; } }
      b.season = { at: now(), pub: p.pub && typeof p.pub === "object" ? p.pub : null, cards };
      emitState(io, b, true); reply({ ok: true, linked });
    });
    on("lbc:myResult", (p, reply) => {
      const b = get(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); if (!b.season) return reply({ ok: false, error: "NO_RESULT" });
      reply({ ok: true, pub: b.season.pub, card: b.season.cards.get(key) || null, cast: b.accepted.has(key) });
    });
    // ----- 시청자 관리 (방장 전용): 목록 · 강퇴 · 닉네임 변경 -----
    const appOf = (b, k) => { for (const [aid, kk] of b.castApp || []) if (kk === k) return aid; return null; };
    const byVid = (b, vid) => { for (const [k, v] of b.viewers) if (!v.host && "v" + v.no === String(vid)) return [k, v]; return [null, null]; };
    on("lbc:viewers", (p, reply) => {
      const b = mine(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" });
      const rows = [...b.viewers.entries()].filter(([, v]) => !v.host).sort((x, y) => y[1].no - x[1].no).slice(0, 300)
        .map(([k, v]) => ({ vid: "v" + v.no, nick: v.nick, pts: v.pts, cast: b.accepted.has(k), appId: appOf(b, k), applied: b.apps.some((a) => a.key === k) }));
      reply({ ok: true, rows, kicked: b.banned?.size || 0 });
    });
    on("lbc:kick", (p, reply) => {
      const b = mine(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" });
      const [k, v] = byVid(b, p.vid); if (!k) return reply({ ok: false, error: "VIEWER_NOT_FOUND" });
      b.viewers.delete(k); (b.banned = b.banned || new Set()).add(k);
      b.apps = b.apps.filter((a) => a.key !== k);
      const P = b.poll; if (P && P.votes.has(k)) { const o = P.votes.get(k); P.votes.delete(k); P.counts[o] = Math.max(0, (P.counts[o] || 0) - 1); }
      const R = b.pred; if (R && !R.settled && R.picks.has(k)) { const o = R.picks.get(k); R.picks.delete(k); R.counts[o] = Math.max(0, (R.counts[o] || 0) - 1); }
      const r = `lbcu:${b.id}:${k}`; io.to(r).emit("lbc:kicked", { id: b.id }); io.in(r).socketsLeave(room(b.id));
      emitState(io, b, true); reply({ ok: true, nick: v.nick, appId: appOf(b, k) });
    });
    on("lbc:rename", (p, reply) => {
      const b = mine(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" });
      const [k, v] = byVid(b, p.vid); if (!k) return reply({ ok: false, error: "VIEWER_NOT_FOUND" });
      const nick = clean(p.nick, 12); if (!nick) return reply({ ok: false, error: "NEED_NICK" }); if (!nickOk(nick)) return reply({ ok: false, error: "BAD_NICK" });
      const old = v.nick; v.nick = nick; for (const a of b.apps) if (a.key === k) a.nick = nick.slice(0, 10);
      io.to(`lbcu:${b.id}:${k}`).emit("lbc:renamed", { id: b.id, nick });
      emitState(io, b, true); reply({ ok: true, old, nick, appId: appOf(b, k) });
    });
    // ----- 시청자 사건 카드 -----
    on("lbc:card", (p, reply) => {
      const b = get(p.id); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" });
      const v = b.viewers.get(key); if (!v) return reply({ ok: false, error: "NOT_JOINED" }); if (v.host) return reply({ ok: false, error: "HOST_NO_VOTE" });
      reply(pushCard(io, b, key, v, v.nick, String(p.card || ""), clean(p.a, 24), clean(p.b, 24), false));
    });
    // 스트리머 화면이 카드를 실제로 실행했는지 알려 줌 (못 하면 포인트 돌려줌)
    on("lbc:cardDone", (p, reply) => {
      const b = mine(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" });
      const r = (b.cardQ || []).find((x) => x.rid === p.rid); if (!r) return reply({ ok: false, error: "CARD_NOT_FOUND" });
      b.cardQ = b.cardQ.filter((x) => x !== r);
      if (!p.ok) refund(b, r);
      else b.notice = { kind: "card", nick: r.nick, card: r.card, good: !!p.good, text: txt(p.text, 120), at: now() };
      if (!r.chat) io.to(`lbcu:${b.id}:${r.key}`).emit("lbc:cardResult", { id: b.id, rid: r.rid, ok: !!p.ok, good: !!p.good, text: txt(p.text, 120) });
      emitState(io, b, true); reply({ ok: true });
    });
    on("lbc:end", (p, reply) => { const b = mine(p.id); if (!b) return reply({ ok: false, error: "NOT_HOST" }); if (b.poll && !b.poll.closed) closePoll(io, b); b.ended = true; b.endedAt = now(); emitState(io, b, true); reply({ ok: true, board: board(b) }); });
  });
  if (!app) return;
  app.get("/lifebc/bc/:id", (req, res) => { const b = BC.get(String(req.params.id || "").slice(0, 12)); if (!b) return res.status(404).json({ ok: false, error: "BC_NOT_FOUND" }); res.json({ ok: true, title: b.title, nick: b.nick, ended: !!b.ended, viewers: b.viewers.size - 1 }); });
}
export const _lbcTest = { BC, gap: null };
