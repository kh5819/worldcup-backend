// =========================
// DUO 증강 알까기 — 서버 물리 엔진 (2026-11-17)
// · 원판(알) 전용 2D 물리. 외부 라이브러리 없음 → 서버·시험·AI가 완전히 같은 계산
// · 고정 시간 간격 DT = 1/120초. 한 번 발사하면 모든 알이 멈출 때까지(최대 12초) 한꺼번에 계산하고
//   1/30초마다 위치를 기록(frames) → 화면은 이 기록을 보간해서 재생만 함 (화면이 결과를 바꿀 수 없음)
// · 요소: 질량·마찰(감속)·탄성(반발 계수)·충돌 충격량·운동량·회전(스핀·휘어짐)·경계 이탈·정지 판정
// · 증강 효과도 전부 여기서 물리로: 받는/주는 충격 배율, 충격파, 자석·블랙홀·중력장, 분열, 보호막, 절대 방어, 반사 충격
// · 무한 반복 방지: 한 번 발사에 충격파 최대 8번, 분열은 알마다 1번, 생성 알 수 제한은 게임 쪽에서
// =========================
export const DT = 1 / 120;
export const REC_EVERY = 4;           // 4스텝 = 1/30초마다 기록
export const VMAX = 1150;             // 최대 발사 속도 (판 단위/초)
export const BASE_R = 21;             // 알 기본 반지름
const DECEL = 690;                    // 기본 마찰 감속 (판 단위/초²)
const STOP_V = 7;                     // 이 속도 밑이면 멈춤
const MAX_T = 12;                     // 한 번 발사 최대 시간(초)
const MAX_WAVES = 8;
const SPEED_CAP = 1900;

export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/** 알 하나 */
export function makeDisc(o) {
  return {
    id: o.id, owner: o.owner, team: o.team ?? null, kind: o.kind || "stone",
    x: o.x, y: o.y, vx: 0, vy: 0, a: o.a || 0, w: 0,
    r: o.r || BASE_R, m: o.m || 1, e: o.e ?? 0.86, mu: o.mu ?? 1,
    recvMul: o.recvMul ?? 1, dealMul: o.dealMul ?? 1,
    shield: o.shield || 0, alive: true, iron: o.iron || 0, golden: !!o.golden,
    split: 0, // 이미 분열한 알은 다시 안 함
  };
}
export const cloneDisc = (d) => ({ ...d });

/**
 * 한 번 발사 계산.
 * w = { L, discs, owners: Map(owner → { recvShieldAug, absDef, reflect, lastSurvival … 반응형 횟수 객체 }) }
 * shot = { id(쏘는 알), vx, vy, curve, tags:{ bomb, megaBlast, split, triple, magnet, chain, ice, whirl, god }, fields:[{kind:'blackhole',x,y,R,acc,dur}|{kind:'gravity',ax,ay,dur}], quake:[{id,vx,vy}] }
 * hooks = { react(ownerId, kind, ctx) → bool 반응형 증강 사용 여부 (게임이 횟수 관리), spawnSplit(disc, n) → [새 알] (게임이 개수 제한), frontal 배율 등은 disc 값 }
 * opt.record=false 면 기록 없이 결과만 (AI 계산용)
 */
export function simulate(w, shot, hooks = {}, opt = {}) {
  const L = w.L, discs = w.discs, record = opt.record !== false;
  // 경기장 규칙 (flick-maps.js) — 없으면 기본 판
  const env = w.env || null, envMu = env?.mu ?? 1, holes = env?.holes || [], blocks = env?.blocks || [], walls = env?.walls || null, wells = env?.wells || [], wind = env?.wind || null;
  const frames = [], events = [];
  let step = 0, waves = 0, t = 0;
  const shooter = discs.find(d => d.id === shot.id && d.alive) || null;
  const tags = shot.tags || {};
  if (shooter) {
    shooter.vx = shot.vx; shooter.vy = shot.vy;
    if (tags.ice) shooter._ice = 1;
    if (tags.whirl) shooter._curve = shot.curve || 0;
    shooter._shot = true;
  }
  for (const q of shot.quake || []) { const d = discs.find(x => x.id === q.id && x.alive); if (d) { d.vx += q.vx; d.vy += q.vy; } }
  const fields = (shot.fields || []).map(f => ({ ...f, t0: 0 }));
  const firstHit = new Set();
  let lastRec = new Map();
  const ev = (e) => { if (record) events.push({ f: frames.length, ...e }); };
  const rec = () => {
    if (!record) return;
    const row = [];
    for (let i = 0; i < discs.length; i++) {
      const d = discs[i]; if (!d.alive && !d._justFell) continue;
      const k = lastRec.get(d.id);
      const x = Math.round(d.x * 10) / 10, y = Math.round(d.y * 10) / 10, a = Math.round(d.a * 100) / 100;
      if (k && k[0] === x && k[1] === y && k[2] === a) continue;
      lastRec.set(d.id, [x, y, a]); row.push(d.id, x, y, a);
      d._justFell = false;
    }
    frames.push(row);
  };
  rec();
  const wave = (cx, cy, R, S, srcId, kind) => {
    if (waves >= MAX_WAVES) return;
    waves++;
    for (const d of discs) {
      if (!d.alive || d.id === srcId) continue;
      const dx = d.x - cx, dy = d.y - cy, dist = Math.hypot(dx, dy);
      if (dist > R + d.r || dist < 1e-6) continue;
      const k = S * Math.max(0.15, 1 - dist / (R + d.r)) * d.recvMul / Math.sqrt(d.m);
      if (d.iron) continue; // 철벽 알은 충격파에 안 밀림
      d.vx += dx / dist * k; d.vy += dy / dist * k;
    }
    ev({ k: "wave", x: Math.round(cx), y: Math.round(cy), R: Math.round(R), kind });
  };
  const moving = () => discs.some(d => d.alive && (d.vx * d.vx + d.vy * d.vy) > STOP_V * STOP_V);
  while (t < MAX_T) {
    // 빠르면 한 스텝을 잘게 나눔 (가장 작은 알 반지름의 절반 이상 한 번에 움직이지 않게 → 고속 관통 방지). 보통 속도는 1번 그대로
    let vmax = 0, rmin = BASE_R;
    for (const d of discs) if (d.alive) { const v = Math.hypot(d.vx, d.vy); if (v > vmax) vmax = v; if (d.r < rmin) rmin = d.r; }
    const subs = Math.max(1, Math.min(8, Math.ceil(vmax * 2 * DT / (rmin * 0.9))));
    const h = DT / subs;
    for (let sub = 0; sub < subs; sub++) {
    const tt = t + sub * h;
      // 1) 힘: 장(블랙홀·중력)·자석·휘어짐
      for (const f of fields) {
        if (tt > f.dur) continue;
        if (f.kind === "blackhole") {
          for (const d of discs) {
            if (!d.alive) continue;
            const dx = f.x - d.x, dy = f.y - d.y, dist = Math.hypot(dx, dy);
            if (dist > f.R || dist < 2) continue;
            const acc = f.acc * (1 - dist / f.R) * (d.iron ? 0.3 : 1);
            d.vx += dx / dist * acc * h; d.vy += dy / dist * acc * h;
            // 가운데 가까이 오면 붙잡아 둠 (빨려 들어가 멈춤)
            if (dist < d.r * 0.7) { d.vx *= 0.9; d.vy *= 0.9; }
          }
        } else if (f.kind === "gravity") {
          for (const d of discs) { if (!d.alive || d.id === shot.id || d.iron) continue; d.vx += f.ax * h; d.vy += f.ay * h; }
        }
      }
      for (const mg of discs) {
        if (!mg.alive || !mg._magnet || tt > 3) continue;
        if (Math.hypot(mg.vx, mg.vy) < 25) continue;
        for (const d of discs) {
          if (!d.alive || d === mg || d.owner === mg.owner || d.iron) continue;
          const dx = mg.x - d.x, dy = mg.y - d.y, dist = Math.hypot(dx, dy), R = mg.r * 5.5;
          if (dist > R || dist < 1) continue;
          const acc = 1900 * (1 - dist / R) + 300; // 바닥 마찰(690)보다 세야 멈춘 알도 끌려옴
          d.vx += dx / dist * acc * h; d.vy += dy / dist * acc * h;
        }
      }
      // 경기장: 바람·중력 소용돌이 — 움직이는 알만 (멈춘 알은 그대로)
      if (wind || wells.length) for (const d of discs) {
        if (!d.alive || d.iron) continue;
        const sp = Math.hypot(d.vx, d.vy); if (sp < 30) continue;
        const fade = Math.min(1, sp / 160);
        if (wind) { d.vx += wind.ax * fade * h / Math.sqrt(d.m); d.vy += wind.ay * fade * h / Math.sqrt(d.m); }
        for (const wl of wells) {
          const dx = wl.x - d.x, dy = wl.y - d.y, dist = Math.hypot(dx, dy);
          if (dist > wl.R || dist < 4) continue;
          const a = wl.acc * (1 - dist / wl.R) * fade / Math.sqrt(d.m);
          // 안쪽으로 당김 + 옆으로 돌림 (소용돌이)
          d.vx += (dx / dist * 0.75 - dy / dist * 0.55 * wl.swirl) * a * h; d.vy += (dy / dist * 0.75 + dx / dist * 0.55 * wl.swirl) * a * h;
        }
      }
      for (const d of discs) {
        if (!d.alive || !d._curve) continue;
        const sp = Math.hypot(d.vx, d.vy); if (sp < 40) continue;
        const k = 300 * d._curve * Math.min(1, sp / 500) * Math.max(0, 1 - tt / 2.2);
        d.vx += -d.vy / sp * k * h; d.vy += d.vx / sp * k * h;
      }
      // 2) 마찰 · 이동 · 회전
      for (const d of discs) {
        if (!d.alive) continue;
        let sp = Math.hypot(d.vx, d.vy);
        if (sp > SPEED_CAP) { d.vx *= SPEED_CAP / sp; d.vy *= SPEED_CAP / sp; sp = SPEED_CAP; }
        if (sp > 0) {
          const dec = DECEL * d.mu * envMu * (d._ice ? 0.45 : 1) * h + sp * 0.0025;
          const ns = Math.max(0, sp - dec);
          d.vx *= ns / sp; d.vy *= ns / sp;
        }
        d.x += d.vx * h; d.y += d.vy * h;
        d.a += d.w * h; d.w *= 0.985;
        if (Math.abs(d.w) < 0.05) d.w = 0;
      }
      // 3) 충돌 (같은 쌍 여러 번 반복해 겹침 줄임)
      for (let i = 0; i < discs.length; i++) {
        const A = discs[i]; if (!A.alive) continue;
        for (let j = i + 1; j < discs.length; j++) {
          const B = discs[j]; if (!B.alive) continue;
          const dx = B.x - A.x, dy = B.y - A.y, rr = A.r + B.r;
          if (Math.abs(dx) > rr || Math.abs(dy) > rr) continue;
          const dist = Math.hypot(dx, dy);
          if (dist >= rr || dist < 1e-6) continue;
          const nx = dx / dist, ny = dy / dist;
          // 겹침 풀기 (질량 반비례)
          const over = rr - dist, ia = 1 / A.m, ib = 1 / B.m, im = ia + ib;
          A.x -= nx * over * ia / im; A.y -= ny * over * ia / im; B.x += nx * over * ib / im; B.y += ny * over * ib / im;
          const vrel = (A.vx - B.vx) * nx + (A.vy - B.vy) * ny;
          if (vrel <= 0) continue;
          const e = Math.max(0.2, Math.min(1, (A.e + B.e) / 2));
          let j0 = (1 + e) * vrel / im;
          // 누가 민 쪽인가 (n 방향 속도가 더 큰 쪽)
          const aN = Math.abs(A.vx * nx + A.vy * ny), bN = Math.abs(B.vx * nx + B.vy * ny);
          const atk = aN >= bN ? A : B, tgt = atk === A ? B : A;
          const sgn = atk === A ? 1 : -1; // 대상이 받는 방향 = n * sgn
          // 정면 충돌 (정확한 타격): 미는 알의 진행 방향과 접촉선이 20도 안
          const asp = Math.hypot(atk.vx, atk.vy) || 1;
          const cosHit = Math.abs(atk.vx * nx + atk.vy * ny) / asp;
          let mulT = atk.dealMul * tgt.recvMul * (tgt.iron ? 0.35 : 1);
          if (cosHit > 0.94 && atk._frontal) mulT *= atk._frontal;
          if (atk._whirl) mulT *= 1.15;
          // 반응형: 절대 방어 (강한 충돌을 통째로 흡수)
          const jT = j0 * mulT, dvT = jT / tgt.m;
          if (dvT > 420 && hooks.react && hooks.react(tgt.owner, "absDef", { id: tgt.id })) {
            tgt.vx = 0; tgt.vy = 0; // 대상은 안 움직이고 미는 알만 튕김
            atk.vx -= sgn * nx * j0 / atk.m * 0.9; atk.vy -= sgn * ny * j0 / atk.m * 0.9;
            ev({ k: "absDef", id: tgt.id, x: Math.round(tgt.x), y: Math.round(tgt.y) });
            continue;
          }
          tgt.vx += sgn * nx * dvT; tgt.vy += sgn * ny * dvT;
          atk.vx -= sgn * nx * j0 / atk.m; atk.vy -= sgn * ny * j0 / atk.m;
          // 반사 충격: 맞은 알 주인이 가진 증강 → 충격 일부를 민 쪽에 되돌림
          if (tgt.owner !== atk.owner && dvT > 160 && hooks.react && hooks.react(tgt.owner, "reflect", { id: tgt.id })) {
            const back = 0.45 * jT / atk.m;
            atk.vx -= sgn * nx * back; atk.vy -= sgn * ny * back;
            ev({ k: "reflect", id: tgt.id, x: Math.round(tgt.x), y: Math.round(tgt.y) });
          }
          // 회전: 접선 방향 상대 속도 → 스핀
          const tx = -ny, ty = nx, vt = (A.vx - B.vx) * tx + (A.vy - B.vy) * ty;
          A.w += vt * 0.02 / A.r * 10; B.w -= vt * 0.02 / B.r * 10;
          const power = Math.round(j0);
          ev({ k: "hit", a: A.id, b: B.id, x: Math.round(A.x + nx * A.r), y: Math.round(A.y + ny * A.r), p: power });
          hooks.onHit?.(atk, tgt, power);
          // 첫 충돌 효과 (쏜 알 또는 효과 붙은 알)
          for (const D of [A, B]) {
            if (firstHit.has(D.id)) continue;
            if (!(D._bomb || D._mega || D._split || D._triple)) continue;
            firstHit.add(D.id);
            const cx = A.x + nx * A.r, cy = A.y + ny * A.r;
            if (D._mega) wave(cx, cy, D.r * 7, 1020, D.id, "mega");
            else if (D._bomb) wave(cx, cy, D.r * 3.6, 600, D.id, "bomb");
            if ((D._split || D._triple) && !D.split && hooks.spawnSplit) {
              const kids = hooks.spawnSplit(D, D._triple ? 3 : 2);
              if (kids.length) {
                D.split = 1;
                const sp = Math.hypot(D.vx, D.vy) || 200, base = Math.atan2(D.vy, D.vx);
                kids.forEach((k, ix) => {
                  const ang = base + (ix - (kids.length - 1) / 2) * 0.7;
                  k.vx = Math.cos(ang) * sp * 0.9; k.vy = Math.sin(ang) * sp * 0.9;
                  discs.push(k);
                });
                ev({ k: "split", id: D.id, kids: kids.map(k => ({ id: k.id, owner: k.owner, kind: k.kind, x: Math.round(k.x), y: Math.round(k.y), r: k.r })) });
              }
            }
          }
          // 연쇄 충격: 효과 붙은 쏜 알이 있으면 강한 충돌마다 작은 충격파
          if (shot.tags?.chain && power > 140) wave(A.x + nx * A.r, A.y + ny * A.r, BASE_R * 2.6, 320, null, "chain");
        }
      }
      // 3-2) 경기장: 움직이지 않는 기둥·범퍼 (무한 질량), 레이저 벽
      for (const b of blocks) {
        for (const d of discs) {
          if (!d.alive) continue;
          const dx = d.x - b.x, dy = d.y - b.y, rr = d.r + b.r;
          if (Math.abs(dx) > rr || Math.abs(dy) > rr) continue;
          const dist = Math.hypot(dx, dy); if (dist >= rr) continue;
          const nx = dist > 1e-6 ? dx / dist : 1, ny = dist > 1e-6 ? dy / dist : 0;
          d.x = b.x + nx * (rr + 0.5); d.y = b.y + ny * (rr + 0.5);
          const vn = d.vx * nx + d.vy * ny;
          if (vn < 0) {
            const e = Math.max(0.3, Math.min(1.05, (d.e + b.e) / 2));
            d.vx -= (1 + e) * vn * nx; d.vy -= (1 + e) * vn * ny;
            if (b.kick) { d.vx += nx * b.kick; d.vy += ny * b.kick; } // 범퍼: 튕기는 힘 추가
            if (-vn > 40) ev({ k: "bump", kind: b.kind, x: Math.round(b.x + nx * b.r), y: Math.round(b.y + ny * b.r), bx: b.x, by: b.y, p: Math.round(-vn) });
          }
        }
      }
      if (walls) for (const d of discs) {
        if (!d.alive) continue;
        let hit = 0;
        if (walls.l && d.x - d.r < 0) { d.x = d.r; if (d.vx < 0) { d.vx = -d.vx * 0.85; hit = 1; } }
        if (walls.r && d.x + d.r > L) { d.x = L - d.r; if (d.vx > 0) { d.vx = -d.vx * 0.85; hit = 1; } }
        if (walls.t && d.y - d.r < 0) { d.y = d.r; if (d.vy < 0) { d.vy = -d.vy * 0.85; hit = 1; } }
        if (walls.b && d.y + d.r > L) { d.y = L - d.r; if (d.vy > 0) { d.vy = -d.vy * 0.85; hit = 1; } }
        if (hit && Math.hypot(d.vx, d.vy) > 60) ev({ k: "wall", x: Math.round(d.x), y: Math.round(d.y) });
      }
      // 4) 경계 이탈 · 용암 구멍
      for (const d of discs) {
        if (!d.alive) continue;
        const out = !(d.x >= 0 && d.x <= L && d.y >= 0 && d.y <= L);
        const hole = out ? null : holes.find(o => Math.hypot(d.x - o.x, d.y - o.y) < o.r - d.r * 0.25);
        if (!out && !hole) continue;
        // 반응 순서: 알 자체 보호막 → 보호막 증강 → 최후의 생존(마지막 알)
        const save = (how) => {
          if (d.kind === "boss" || (hole && how !== "shield" && how !== "stone")) { // 보스: 가운데 근처로 되돌림
            const p = hooks.safeSpot ? hooks.safeSpot(L / 2, L / 2, d.r, d) : { x: L / 2, y: L / 2 };
            d.x = p.x; d.y = p.y; d.vx = 0; d.vy = 0;
          } else if (hole) { // 구멍 밖으로 밀어냄
            let nx = d.x - hole.x, ny = d.y - hole.y, n = Math.hypot(nx, ny);
            if (n < 1e-3) { nx = -d.vx; ny = -d.vy; n = Math.hypot(nx, ny) || 1; if (n < 1e-3) { nx = 1; ny = 0; n = 1; } }
            nx /= n; ny /= n;
            d.x = Math.max(d.r + 2, Math.min(L - d.r - 2, hole.x + nx * (hole.r + d.r + 3))); d.y = Math.max(d.r + 2, Math.min(L - d.r - 2, hole.y + ny * (hole.r + d.r + 3)));
            const vn = d.vx * nx + d.vy * ny; d.vx = (d.vx - 2 * vn * nx) * 0.35; d.vy = (d.vy - 2 * vn * ny) * 0.35;
          } else {
            const ix = Math.max(d.r + 2, Math.min(L - d.r - 2, d.x)), iy = Math.max(d.r + 2, Math.min(L - d.r - 2, d.y));
            if (d.x < 0 || d.x > L) d.vx = -d.vx * 0.35; if (d.y < 0 || d.y > L) d.vy = -d.vy * 0.35;
            d.x = ix; d.y = iy;
          }
          ev({ k: "save", id: d.id, how: d.kind === "boss" && how === "stone" ? "boss" : how, x: Math.round(d.x), y: Math.round(d.y), hp: d.kind === "boss" ? d.shield : undefined });
        };
        if (d.shield > 0) { d.shield--; save("stone"); continue; }
        if (hooks.react && hooks.react(d.owner, "shield", { id: d.id })) { save("shield"); continue; }
        const mine = discs.filter(x => x.alive && x.owner === d.owner && x !== d).length;
        if (!mine && hooks.react && hooks.react(d.owner, "lastSurvival", { id: d.id })) {
          const p = hooks.safeSpot ? hooks.safeSpot(L / 2, L / 2, d.r, d) : { x: L / 2, y: L / 2 };
          d.x = p.x; d.y = p.y; d.vx = 0; d.vy = 0;
          ev({ k: "save", id: d.id, how: "lastSurvival", x: Math.round(d.x), y: Math.round(d.y) });
          continue;
        }
        d.alive = false; d._justFell = true;
        ev({ k: "fall", id: d.id, owner: d.owner, x: Math.round(d.x), y: Math.round(d.y), vx: Math.round(d.vx), vy: Math.round(d.vy), hole: hole ? 1 : undefined, kind: d.kind === "stone" ? undefined : d.kind });
        hooks.onFall?.(d);
      }
    }
    step++; t = step * DT;
    if (step % REC_EVERY === 0) rec();
    const fieldOn = fields.some(f => t <= f.dur && f.kind === "gravity");
    if (!moving() && !fieldOn && t > 0.1) break;
  }
  for (const d of discs) { if (d.alive) { d.vx = 0; d.vy = 0; d.w = 0; } delete d._ice; delete d._curve; delete d._shot; delete d._magnet; delete d._bomb; delete d._mega; delete d._split; delete d._triple; delete d._frontal; delete d._whirl; }
  rec();
  return { frames, events, steps: step, time: t };
}

/** 겹치지 않는 안전한 자리 (가장자리에서 margin 이상 안쪽) — 나선으로 찾음 */
export function findSafe(discs, L, x, y, r, { margin = 0, ignore = null, avoid = null } = {}) {
  const m = Math.max(r + 4, margin);
  const ok = (px, py) => px >= m && px <= L - m && py >= m && py <= L - m && discs.every(d => !d.alive || d === ignore || Math.hypot(d.x - px, d.y - py) >= d.r + r + 2) && (!avoid || avoid.every(o => Math.hypot(o.x - px, o.y - py) >= o.r + r + 2));
  if (ok(x, y)) return { x, y };
  for (let rad = r; rad < L; rad += r * 0.6) {
    const n = Math.max(8, Math.floor(rad / 6));
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad; if (ok(px, py)) return { x: px, y: py }; }
  }
  return null;
}
