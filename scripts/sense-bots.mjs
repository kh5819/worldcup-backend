// 게임 센스 시험용 봇 정책: good(규칙대로) · rnd(찍기) · spam(연타·반복) · idle(가만히)
import * as C from "../src/sense-core.js";
export function play(tid, s, pol, r) {
  const L = {}, rnd = () => r();
  switch (tid) {
    case "minimap": {
      L.a = [];
      if (pol === "good") { for (const e of s.ev) if (e.danger) L.a.push([e.t + 700 + rnd() * 500, "p", e.lane]); for (const o of s.ores) L.a.push([o.t + 600, "o", o.id]); }
      if (pol === "rnd") for (let t = 0; t < s.dur; t += 900) L.a.push([t, "p", Math.floor(rnd() * 3)]);
      if (pol === "spam") { for (let t = 0; t < s.dur; t += 520) L.a.push([t, "p", 0]); for (const o of s.ores) L.a.push([o.t + 300, "o", o.id]); }
      break;
    }
    case "engage": L.c = s.sc.map((sc, i) => [i, pol === "good" ? (() => { const v = C.engageValues(sc).v; return v.indexOf(Math.max(...v)); })() : pol === "spam" ? 0 : Math.floor(rnd() * 3), 2500]); if (pol === "idle") L.c = []; break;
    case "target": L.o = s.rounds.map((rd, i) => { let o = [0, 1, 2, 3]; if (pol === "good") { let best = 1e9; const P = []; const go = (a, rest) => { if (!rest.length) return P.push(a); rest.forEach((x, k) => go([...a, x], rest.filter((_, j) => j !== k))); }; go([], [0, 1, 2, 3]); for (const p of P) { const d = C.targetDamage(rd, p); if (d < best) { best = d; o = p; } } } else if (pol === "rnd") o = [0, 1, 2, 3].sort(() => rnd() - 0.5); return [i, o, 3000]; }); if (pol === "idle") L.o = []; break;
    case "cooldown": {
      L.k = [];
      if (pol === "good") { for (const c of s.charges) L.k.push([c + 400, "w"]); for (const w of s.weak) L.k.push([w + 300, "e"]); for (let t = 500; t < s.dur; t += 3100) if (![...s.charges, ...s.weak].some((x) => Math.abs(x - t) < 1800)) L.k.push([t, "q"]); }
      if (pol === "spam") for (let t = 0; t < s.dur; t += 200) L.k.push([t, "q"]);
      if (pol === "rnd") for (let t = 0; t < s.dur; t += 700) L.k.push([t, "qwe"[Math.floor(rnd() * 3)]]);
      break;
    }
    case "boss": {
      L.z = [];
      if (pol === "good") for (const a of s.att) { const z = s.pats[a.p].z; const safe = [0, 1, 2, 3, 4].filter((q) => !z.includes(q)); const cur = L.z.length ? L.z[L.z.length - 1][1] : s.start; const tgt = safe.sort((x, y) => Math.abs(x - cur) - Math.abs(y - cur))[0]; L.z.push([a.t + 250, tgt]); }
      if (pol === "rnd") for (let t = 0; t < s.dur; t += 600) L.z.push([t, Math.floor(rnd() * 5)]);
      if (pol === "spam") for (let t = 0; t < s.dur; t += 300) L.z.push([t, (t / 300) % 2 ? 0 : 4]);
      break;
    }
    case "vision": L.r = s.rounds.map((rd, i) => [i, pol === "good" ? rd.en.map((e) => C.visionEnd(s.n, e, s.steps)) : Array.from({ length: rd.en.length }, () => Math.floor(rnd() * 36)), 4000]); if (pol === "idle") L.r = []; if (pol === "spam") L.r = s.rounds.map((rd, i) => [i, Array.from({ length: 36 }, (_, k) => k), 1000]); break;
    case "resource": { if (pol === "good") { let best = -1, plan = null; for (let k = 0; k < 1024; k++) { const p = [0, 1, 2, 3, 4].map((i) => Math.floor(k / 4 ** i) % 4), v = C.resourceSim(s, p).value; if (v > best) { best = v; plan = p; } } L.c = plan.map((o, i) => [i, o, 3000]); } else if (pol === "spam") L.c = [0, 1, 2, 3, 4].map((i) => [i, 0, 1000]); else if (pol === "rnd") L.c = [0, 1, 2, 3, 4].map((i) => [i, Math.floor(rnd() * 4), 2000]); else L.c = []; break; }
    case "multitask": { L.a = []; if (pol === "good") s.ev.forEach((e, p) => e.forEach((t) => L.a.push([t + s.early[p] + 400 + rnd() * 400, p]))); if (pol === "spam") for (let t = 0; t < s.dur; t += 300) L.a.push([t, (t / 300) % 3]); if (pol === "rnd") for (let t = 0; t < s.dur; t += 800) L.a.push([t, Math.floor(rnd() * 3)]); break; }
    case "path": L.c = s.rounds.map((rd, i) => [i, pol === "good" ? (() => { const v = rd.paths.map((p) => C.pathValue(rd, p)); return v.indexOf(Math.max(...v)); })() : pol === "spam" ? 0 : Math.floor(rnd() * rd.paths.length), 3000]); if (pol === "idle") L.c = []; break;
    case "teamfight": L.c = s.rounds.map((rd, i) => { if (pol === "good") { let b = [0, 0, 0, -1]; for (let t = 0; t <= rd.dur; t += 100) for (let x = 0; x <= s.W; x += 2) for (let y = 0; y <= s.H; y += 2) { const h = C.tfHits(rd, t, x, y); if (h > b[3]) b = [t, x, y, h]; } return [i, b[0], b[1], b[2]]; } return [i, pol === "spam" ? 0 : rnd() * rd.dur, rnd() * s.W, rnd() * s.H]; }); if (pol === "idle") L.c = []; break;
    case "fake": L.b = []; if (pol === "good") for (const w of s.sw) { if (w.real) L.b.push(w.t + w.wind - 200); } if (pol === "spam") for (let t = 0; t < s.dur; t += 700) L.b.push(t); if (pol === "rnd") for (const w of s.sw) if (rnd() < 0.5) L.b.push(w.t + w.wind - 200); break;
    case "overload": L.a = []; if (pol === "good") for (const n of s.n) if (n.type !== "noise") L.a.push([n.t + 900, n.type]); if (pol === "spam") for (let t = 0; t < s.dur; t += 250) L.a.push([t, (t / 250) % 2 ? "crit" : "warn"]); if (pol === "rnd") for (const n of s.n) if (rnd() < 0.6) L.a.push([n.t + 900, rnd() < 0.5 ? "crit" : "warn"]); break;
    case "comeback": L.c = s.rounds.map((rd, i) => [i, pol === "good" ? rd.ops.map((o) => o.p).indexOf(Math.max(...rd.ops.map((o) => o.p))) : pol === "spam" ? 0 : Math.floor(rnd() * 4), 3000]); if (pol === "idle") L.c = []; break;
    case "team": L.c = s.rounds.map((rd, i) => [i, rd.m.map((m) => pol === "good" ? [0, 1, 2, 3].sort((a, b) => C.teamValue(m, b) - C.teamValue(m, a))[0] : pol === "spam" ? 0 : Math.floor(rnd() * 4)), 4000]); if (pol === "idle") L.c = []; break;
    case "final": {
      L.z = []; L.k = [];
      if (pol === "good") { for (const a of s.att) { const z = s.pats[a.p]; const safe = [0, 1, 2, 3, 4].filter((q) => !z.includes(q)); const cur = L.z.length ? L.z[L.z.length - 1][1] : s.start; L.z.push([a.t + 250, safe.sort((x, y) => Math.abs(x - cur) - Math.abs(y - cur))[0]]); if (a.big) { L.k.push([a.t + 100, "t"]); L.k.push([a.t + a.tell + 300, "t"]); } } for (const w of s.weak) L.k.push([w + 300, "e"]); for (let t = 300; t < s.dur; t += 2100) L.k.push([t, "q"]); L.k.push([30000, "f"]); L.k.push([50000, "f"]); L.k.push([62000, "f"]); }
      if (pol === "spam") { for (let t = 0; t < s.dur; t += 150) L.k.push([t, "qeft"[(t / 150) % 4]]); }
      if (pol === "rnd") { for (let t = 0; t < s.dur; t += 700) { L.z.push([t, Math.floor(rnd() * 5)]); L.k.push([t, "qeft"[Math.floor(rnd() * 4)]]); } }
      break;
    }
  }
  return L;
}
