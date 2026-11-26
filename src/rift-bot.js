// 운명의 균열 — 시험·자동 진행용 봇 (화면·서버 시험이 같이 씀). 규칙 엔진의 공개 함수만 써서 '보통 사람처럼' 둠
import * as R from "./rift-core.js";
export function botAction(run, pi, rng = Math.random) {
  const D = R.data(), p = run.players[pi];
  switch (run.phase) {
    case "map": { if (run.mode === "coop") return null; const nx = R.nextNodes(run); return { t: "path", node: nx[Math.floor(rng() * nx.length)] }; }
    case "combat": {
      const cp = run.cb.ps[pi]; if (!p.alive || cp.ready || cp.out) return null;
      const al = run.cb.en.map((e, i) => (e.dead ? null : i)).filter((x) => x != null);
      const playable = cp.hand.filter((c) => { const d = R.cardDef(c.id); return !d.unplay && R.costOf(cp, c) <= cp.energy; });
      if (!playable.length || !al.length) return { t: "end" };
      // 공격 위주, 위험하면 방어
      const inc = al.reduce((s, i) => { const x = R.intentInfo(run, i); return s + (x && x.tgt === pi || x?.tgt === -1 ? x.dmg * Math.max(1, x.times) : 0); }, 0);
      const wantDef = inc > cp.block + 4;
      playable.sort((a, b) => score(b) - score(a));
      function score(c) { const d = R.cardDef(c.id); let s = rng() * 2; if (d.t === "pow") s += 6; if (wantDef && d.tags.includes("guard")) s += 5; if (!wantDef && d.t === "atk") s += 4; return s; }
      const c = playable[0], d = R.cardDef(c.id);
      const low = al.slice().sort((a, b) => run.cb.en[a].hp - run.cb.en[b].hp)[0];
      return { t: "play", u: c.u, tgt: d.tgt === "enemy" ? low : d.tgt === "ally" ? pi : null };
    }
    case "reward": { const r = run.room.per[pi]; if (!r || r.done) return null; return { t: "reward", pick: rng() < 0.75 ? Math.floor(rng() * r.cards.length) : -1 }; }
    case "event": { if (run.room.chosen != null) return run.mode === "coop" ? null : { t: "leave" }; const e = D.EVENTS.find((x) => x.id === run.room.ev); const ok = e.opts.map((o, i) => (o.need?.gold && run.players.some((x) => x.gold < o.need.gold) ? -1 : i)).filter((x) => x >= 0); return { t: "event", opt: ok[Math.floor(rng() * ok.length)] }; }
    case "shop": { const s = run.room.per[pi]; if (s.done) return null; const can = s.cards.map((c, i) => (!c.sold && c.price <= p.gold ? i : -1)).filter((x) => x >= 0); if (can.length && rng() < 0.6) return { t: "buy", kind: "card", idx: can[0] }; const rr = s.relics.map((c, i) => (!c.sold && c.price <= p.gold ? i : -1)).filter((x) => x >= 0); if (rr.length && rng() < 0.5) return { t: "buy", kind: "relic", idx: rr[0] }; if (!s.removed && p.gold >= s.removePrice && rng() < 0.4) { const b = p.deck.find((c) => R.cardDef(c.id).r === "basic"); if (b) return { t: "remove", u: b.u }; } return { t: "leave" }; }
    case "rest": { const s = run.room.per[pi]; if (s.done) return null; if (p.hp < p.maxHp * 0.55) return { t: "rest", kind: "heal" }; const ups = p.deck.filter(R.canUpgrade); if (rng() < 0.3) { for (const e of s.engs) { const c = p.deck.find((x) => R.engOk(x, e)); if (c) return { t: "rest", kind: "eng", u: c.u, eng: e }; } } if (ups.length) { const c = ups[Math.floor(rng() * ups.length)], d = R.cardDef(c.id); return { t: "rest", kind: "up", u: c.u, evo: d.evo ? Object.keys(d.evo)[Math.floor(rng() * 3)] : undefined }; } return { t: "rest", kind: "heal" }; }
    case "treasure": { const s = run.room.per[pi]; return s.done ? null : { t: "leave" }; }
  }
  return null;
}
// 협동 공동 결정(경로·이벤트)을 봇이 정할 때
export function botTeam(run, rng = Math.random) {
  if (run.phase === "map") { const nx = R.nextNodes(run); return { t: "path", node: nx[Math.floor(rng() * nx.length)] }; }
  if (run.phase === "event" && run.room.chosen != null) return { t: "leave" };
  if (run.phase === "event" && run.room.chosen == null) { const D = R.data(), e = D.EVENTS.find((x) => x.id === run.room.ev); const ok = e.opts.map((o, i) => (o.need?.gold && run.players.some((x) => x.gold < o.need.gold) ? -1 : i)).filter((x) => x >= 0); return { t: "event", opt: ok[Math.floor(rng() * ok.length)] }; }
  return null;
}
