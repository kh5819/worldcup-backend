// =========================
// DUO 증강 알까기 — 경기장마다 다른 판 (2026-11-25)
// · 그림만 다르던 8개 경기장에 진짜 규칙을 붙임. 서버 물리(flick-physics.js)가 env로 받아 계산
//   classic 기본 판(규칙 없음) · ice 얼음(마찰 -45%, 더 튕김) · volcano 용암 구멍(빠지면 떨어짐)
//   space 중력 소용돌이(움직이는 알만 휘어짐) · toy 튕기는 범퍼(맞으면 더 세게 튕김)
//   cloud 바람(차례마다 방향이 바뀌고 움직이는 알만 밀림) · ruins 기둥 장애물(안 움직임)
//   neon 레이저 벽(왼쪽·오른쪽 가장자리는 튕겨 나옴, 위·아래만 떨어짐)
// · 장애물·구멍은 시작 알과 겹치지 않는 후보 자리만 씀 (같은 씨앗이면 같은 판)
// · 정지한 알은 바람·소용돌이에 안 밀림 (힘 < 바닥 마찰, 게다가 움직일 때만 적용) → 차례 사이 판이 저절로 안 바뀜
// =========================
export const MAP_RULE = {
  classic: { name: "기본 판", desc: "특별한 규칙 없는 기본 나무판" },
  ice: { name: "미끄러운 얼음", desc: "마찰이 거의 절반 — 알이 훨씬 멀리 미끄러지고 더 튕겨요" },
  volcano: { name: "용암 구멍", desc: "판 위 용암 구멍에 알의 중심이 빠지면 떨어져요" },
  space: { name: "중력 소용돌이", desc: "소용돌이 근처를 지나는 알은 끌려가며 휘어요 (멈춘 알은 그대로)" },
  toy: { name: "튕기는 범퍼", desc: "범퍼에 부딪힌 알은 더 세게 튕겨 나가요" },
  cloud: { name: "바람", desc: "차례마다 바람 방향이 바뀌어요. 움직이는 알이 바람 쪽으로 밀려요" },
  ruins: { name: "기둥 장애물", desc: "움직이지 않는 돌기둥 — 알이 부딪혀 튕겨요. 기둥 뒤에 숨을 수 있어요" },
  neon: { name: "레이저 벽", desc: "왼쪽·오른쪽 가장자리는 레이저 벽이라 튕겨 나와요. 위·아래로만 떨어져요" },
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
/** 후보 자리(판 비율) 중 알과 안 겹치는 곳만 */
function placeFree(cands, L, r, discs, max, rng, { keepFirst = true } = {}) {
  const out = [];
  const list = cands.map(([x, y]) => ({ x: x * L, y: y * L }));
  // 첫 후보(대개 가운데)는 먼저, 나머지는 섞어서
  const head = keepFirst ? list.slice(0, 1) : [], tail = (keepFirst ? list.slice(1) : list).map(p => ({ p, k: rng() })).sort((a, b) => a.k - b.k).map(o => o.p);
  for (const p of [...head, ...tail]) {
    if (out.length >= max) break;
    if (discs.some(d => d.alive && dist(d, p) < d.r + r + 18)) continue;
    if (out.some(o => dist(o, p) < o.r + r + 50)) continue;
    out.push({ x: Math.round(p.x), y: Math.round(p.y), r });
  }
  return out;
}

/** 경기장 규칙 만들기. 반환 env = { map, mu, eAdd, holes, blocks, walls, wells, wind } */
export function buildEnv(map, L, discs, rng) {
  const env = { map, mu: 1, eAdd: 0, holes: [], blocks: [], walls: null, wells: [], wind: null };
  const k = L / 700; // 판 크기에 맞춰
  const ring5 = [[0.5, 0.5], [0.3, 0.5], [0.7, 0.5], [0.5, 0.3], [0.5, 0.7], [0.32, 0.32], [0.68, 0.32], [0.32, 0.68], [0.68, 0.68]];
  switch (map) {
    case "ice": env.mu = 0.55; env.eAdd = 0.05; break;
    case "volcano": env.holes = placeFree(ring5, L, Math.round(36 * k), discs, 3, rng); break;
    case "ruins": env.blocks = placeFree([[0.5, 0.5], [0.34, 0.34], [0.66, 0.34], [0.34, 0.66], [0.66, 0.66], [0.5, 0.28], [0.5, 0.72]], L, Math.round(27 * k), discs, 4, rng).map(b => ({ ...b, kind: "pillar", e: 0.7, kick: 0 })); break;
    case "toy": env.blocks = placeFree(ring5, L, Math.round(22 * k), discs, 4, rng).map(b => ({ ...b, kind: "bumper", e: 1, kick: 260 })); break;
    case "space": {
      const w = placeFree([[0.5, 0.5], [0.3, 0.3], [0.7, 0.7], [0.7, 0.3], [0.3, 0.7]], L, 10, discs, 2, rng, { keepFirst: false });
      env.wells = w.map((p, i) => ({ x: p.x, y: p.y, R: Math.round(L * 0.26), acc: 430, swirl: i % 2 ? -1 : 1 }));
      break;
    }
    case "cloud": env.wind = newWind(rng); break;
    case "neon": env.walls = { l: true, r: true, t: false, b: false }; break;
  }
  return env;
}
/** 바람: 방향은 아무 쪽, 세기는 약~강 (판 단위/초²) */
export function newWind(rng) { const a = rng() * Math.PI * 2, s = 170 + Math.round(rng() * 130); return { ax: Math.round(Math.cos(a) * s), ay: Math.round(Math.sin(a) * s), s }; }
/** 화면에 보낼 모양 (작게) */
export const envView = (env) => env ? { map: env.map, holes: env.holes, blocks: env.blocks, walls: env.walls, wells: env.wells, wind: env.wind, mu: env.mu } : null;
/** 순간이동·부활 등 빈 자리 찾을 때 피할 것 (구멍은 넉넉히) */
export const envObstacles = (env) => env ? [...env.holes.map(h => ({ x: h.x, y: h.y, r: h.r + 14, alive: true })), ...env.blocks.map(b => ({ x: b.x, y: b.y, r: b.r + 2, alive: true }))] : [];
