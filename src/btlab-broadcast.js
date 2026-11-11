// =========================
// 플듀 비밀 진단소 — 방송 진단소 (bb:*)
// 스트리머가 방송 진단소를 열면 QR·링크가 나옴 → 시청자는 자기 폰으로 같은 진단실을 혼자 진행 → 결과가 방송 현황판에 모임
// 현황판: 참여 수·완료 수·평균 점수·유형 분포·점수 TOP 10·스트리머 순위 (시청자 vs 스트리머)
// 새 DB 테이블 없음: 방송 상태는 메모리에만(서버 재시작 시 사라짐). 방송을 열 때 기존 streamer_chat_log에 한 줄 → admin 「📺 스트리머」 목록에 표시
// =========================
import { createFlight } from "./create-flight.js";

const BC = new Map(), OWNER = new Map();
const LABS = { perv: "변태력 진단실", psycho: "사이코패스 진단실" };   // 진단실 열릴 때 여기 추가
const TTL_MS = 12 * 3600 * 1000, MAX_VIEWERS = 5000, EMIT_GAP = 800;
const now = () => Date.now();
const cleanTxt = (s, n) => String(s ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const clampN = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
const newId = () => { for (let i = 0; i < 50; i++) { const id = Math.random().toString(36).slice(2, 8); if (!BC.has(id)) return id; } return now().toString(36); };
const room = (id) => `bb:${id}`;
setInterval(() => { const t = now(); for (const [id, b] of BC) if (t - b.at > TTL_MS) { BC.delete(id); if (OWNER.get(b.owner) === id) OWNER.delete(b.owner); } }, 10 * 60 * 1000).unref?.();

function stats(b) {
  const done = [...b.viewers.values()].filter((v) => v.main != null), viewers = done.filter((v) => !v.streamer);
  const avg = viewers.length ? Math.round(viewers.reduce((s, v) => s + v.main, 0) / viewers.length) : null;
  const types = {}; for (const v of viewers) types[v.title] = (types[v.title] || 0) + 1;
  const sorted = [...done].sort((a, b) => b.main - a.main || a.t - b.t);
  const st = done.find((v) => v.streamer) || null;
  const names = (viewers[0] || st)?.bars?.map((x) => x[0]) || [];
  const barAvg = names.map((nm, i) => [nm, viewers.length ? Math.round(viewers.reduce((s, v) => s + (v.bars[i]?.[1] || 0), 0) / viewers.length) : null]);
  return { id: b.id, lab: b.lab, labName: LABS[b.lab], title: b.title, host: b.hostNick, open: b.open, joined: b.viewers.size, done: done.length, avg,
    types: Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t, n]) => ({ t, n })),
    top: sorted.slice(0, 10).map((v) => ({ nick: v.nick, main: v.main, title: v.title, streamer: !!v.streamer })),
    streamer: st ? { main: st.main, title: st.title, rank: sorted.indexOf(st) + 1 } : null, barAvg };
}
function mine(b, uid) { const v = b.viewers.get(uid); if (!v || v.main == null) return null; const sorted = [...b.viewers.values()].filter((x) => x.main != null).sort((a, c) => c.main - a.main || a.t - c.t); return { main: v.main, title: v.title, rank: sorted.indexOf(v) + 1, of: sorted.length }; }

export function registerBtlabBroadcast(io, SB) {
  const emitStats = (b) => { if (b.timer) return; const wait = Math.max(0, EMIT_GAP - (now() - (b.lastEmit || 0))); b.timer = setTimeout(() => { b.timer = null; b.lastEmit = now(); io.to(room(b.id)).emit("bb:stats", stats(b)); }, wait); };
  io.on("connection", (socket) => {
    const me = socket.user; if (!me) return;
    let win = now(), cnt = 0;
    const on = (ev, fn) => socket.on(ev, async (p, cb) => { const reply = typeof cb === "function" ? cb : () => {}; const n = now(); if (n - win > 10000) { win = n; cnt = 0; } if (++cnt > 30) return reply({ ok: false, error: "RATE_LIMITED" }); try { await fn(p || {}, reply); } catch (e) { console.error(`[${ev}]`, e); reply({ ok: false, error: "INTERNAL" }); } });
    on("bb:create", async (p, reply) => {
      { const _f = createFlight("bb", me?.id, reply); if (!_f) return; reply = _f; }
      if (!LABS[p.lab]) return reply({ ok: false, error: "BAD_LAB" });
      const old = OWNER.get(me.id); if (old && BC.get(old)) { BC.get(old).open = false; emitStats(BC.get(old)); }
      const nick = cleanTxt(p.nick, 16) || "스트리머", id = newId();
      const b = { id, lab: p.lab, title: `${LABS[p.lab]} 방송 진단소`, owner: me.id, hostNick: nick, open: true, at: now(), viewers: new Map(), timer: null, lastEmit: 0 };
      BC.set(id, b); OWNER.set(me.id, id); socket.join(room(id));
      // admin 「📺 스트리머」 목록 — 비밀 진단소 (방송 진단소: content_mode "bc")
      SB?.from("streamer_chat_log").insert({ platform: "btlab", channel_id: id, nickname: nick, content_id: null, content_title: b.title, content_mode: "bc", room_code: id, host_user_id: me.isGuest ? null : me.id, host_nick: me.isGuest ? null : nick })
        .then(({ error }) => { if (error) console.error("[btlab bc] streamer log", error.message); }, () => {});
      reply({ ok: true, stats: stats(b) });
    });
    on("bb:watch", (p, reply) => {
      const b = BC.get(String(p.id || "")); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" });
      socket.join(room(b.id)); const owner = b.owner === me.id;
      if (!owner && p.join && b.open && !b.viewers.has(me.id) && b.viewers.size < MAX_VIEWERS) { b.viewers.set(me.id, { nick: cleanTxt(p.nick, 12) || "시청자", main: null, t: now() }); emitStats(b); }
      reply({ ok: true, owner, stats: stats(b), mine: mine(b, me.id) });
    });
    on("bb:submit", (p, reply) => {
      const b = BC.get(String(p.id || "")); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); if (!b.open) return reply({ ok: false, error: "BC_CLOSED" });
      if (p.lab !== b.lab) return reply({ ok: false, error: "BAD_LAB" });
      const owner = b.owner === me.id; let v = b.viewers.get(me.id);
      if (!v) { if (b.viewers.size >= MAX_VIEWERS) return reply({ ok: false, error: "FULL" }); v = { nick: owner ? b.hostNick : cleanTxt(p.nick, 12) || "시청자", t: now() }; b.viewers.set(me.id, v); }
      Object.assign(v, { main: clampN(p.main), title: cleanTxt(p.title, 30), bars: (Array.isArray(p.bars) ? p.bars : []).slice(0, 6).map((x) => [cleanTxt(x?.[0], 10), clampN(x?.[1])]), streamer: owner, t: now() });
      if (p.nick && !owner) v.nick = cleanTxt(p.nick, 12) || v.nick;
      emitStats(b); reply({ ok: true, mine: mine(b, me.id), stats: stats(b) });
    });
    on("bb:close", (p, reply) => { const b = BC.get(String(p.id || "")); if (!b) return reply({ ok: false, error: "BC_NOT_FOUND" }); if (b.owner !== me.id) return reply({ ok: false, error: "NOT_OWNER" }); b.open = !!p.reopen; emitStats(b); reply({ ok: true }); });
  });
}
export const _bbTest = { BC, OWNER, LABS, stats };
