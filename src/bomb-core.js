// =========================
// DUO BOMB ARENA — 경기 시뮬레이션 (서버 권한, 20Hz) 2026-11-16
// · 15×13 한 화면 경기장. 좌표: 칸 i의 가운데 = i (칸 범위 i-0.5 ~ i+0.5)
// · 폭탄·불길·상자·아이템·특수 바닥·증강 40종·서든데스·봇 AI
// · 화면에 보이는 효과(파티클 등)는 클라이언트 몫, 여기선 판정만
// =========================
export const W = 15, H = 13, TICK = 0.05;
export const T_FLOOR = 0, T_WALL = 1, T_BOX = 2;
// 특수 바닥: 1 얼음 · 2~5 컨베이어(위·오른·아래·왼) · 6 화산 분출구 · 7/8 순간이동 패드 · 9 덤불
export const SP = { ICE: 1, CV_U: 2, CV_R: 3, CV_D: 4, CV_L: 5, VENT: 6, TP_A: 7, TP_B: 8, BUSH: 9 };
export const THEMES = ["classic", "ice", "jungle", "toy", "volcano"]; // 우주(순간이동 패드)는 11-16 삭제
export const ITEMS = ["bomb", "fire", "speed", "kick", "glove", "shield", "dash", "special"];
export const SPECIAL_KINDS = ["pierce", "ice", "giant", "mine", "split", "moving", "chain"];
const DIRS = [[0, 0], [0, -1], [1, 0], [0, 1], [-1, 0]]; // 0 없음 1 위 2 오른 3 아래 4 왼
const SPAWNS = [[1, 1], [13, 11], [13, 1], [1, 11], [7, 1], [7, 11], [1, 6], [13, 6]];
const BASE_SPEED = 3.3, SPEED_STEP = 0.45, MAX_SPEED = 6.4, FUSE = 2.0, FLAME_T = 0.5, SLIDE_SPEED = 9;
export const MATCH_SEC = 180, SD_AT = 120, PICK_EVERY = 45, PICK_SEC = 15, MAX_AUGS = 5;
const idx = (x, y) => y * W + x;
const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

// ---------------- 증강 40종 ----------------
export const RARITY = { common: { label: "일반", order: 0 }, rare: { label: "희귀", order: 1 }, epic: { label: "영웅", order: 2 }, legendary: { label: "전설", order: 3 } };
const A = (id, rarity, icon, name, kind, effect, extra = {}) => ({ id, rarity, icon, name, kind, effect, cd: 0, ...extra });
export const AUGS = [
  // 일반
  A("bombExpert", "common", "bomb+", "폭탄 전문가", "passive", "폭탄 동시 설치 +1"),
  A("firePower", "common", "fire+", "화력 강화", "passive", "폭발 범위 +1"),
  A("swift", "common", "boot", "신속 이동", "passive", "이동 속도 증가"),
  A("quickPlant", "common", "boot-bomb", "빠른 설치", "passive", "폭탄을 놓은 뒤 1초 동안 크게 빨라짐"),
  A("dangerSense", "common", "eye", "폭발 감지", "passive", "곧 터질 폭발 범위가 미리 보임"),
  A("boxHunter", "common", "box-star", "상자 사냥꾼", "passive", "상자 4개를 부술 때마다 능력 아이템 1개"),
  A("kicker", "common", "kick", "폭탄 밀기", "passive", "폭탄을 발로 차서 밀어냄"),
  A("luckyBox", "common", "clover", "행운의 상자", "passive", "내가 부순 상자에서 아이템이 더 잘 나옴"),
  A("emergencyDodge", "common", "dodge", "긴급 회피", "passive", "불길에 닿는 순간 옆 칸으로 피함 (재사용 20초)", { cd: 20 }),
  A("survivalInstinct", "common", "heart-boot", "생존 본능", "passive", "폭발 범위 안에 있으면 빨라짐"),
  // 희귀
  A("chainBoost", "rare", "chain", "연쇄 폭발", "passive", "다른 폭발에 휘말려 터지는 내 폭탄은 범위 +2"),
  A("bombClone", "rare", "twin", "폭탄 복제", "passive", "폭탄을 놓을 때 25% 확률로 옆에 하나 더"),
  A("barrier", "rare", "shield", "방어막", "passive", "고르는 순간 보호막 1 (폭발 1회 무효)"),
  A("remote", "rare", "remote", "원격 기폭", "active", "내 폭탄이 저절로 안 터짐 — 버튼으로 한꺼번에 기폭", { cd: 0.5 }),
  A("thrower", "rare", "glove", "폭탄 투척", "passive", "폭탄을 3칸 앞으로 던질 수 있음"),
  A("iceBomb", "rare", "snow", "얼음 폭탄", "passive", "내 폭발 자리에 3초 동안 상대 감속 지대"),
  A("ghostWalk", "rare", "ghost", "유령 걸음", "active", "3초 동안 상자·폭탄을 통과 (재사용 20초)", { cd: 20 }),
  A("afterFlame", "rare", "flame", "폭발 잔상", "passive", "내 불길이 1.3초 동안 남음"),
  A("fastFuse", "rare", "fuse", "가속 폭탄", "passive", "내 폭탄이 1.3초 만에 터짐"),
  A("recall", "rare", "magnet-in", "폭탄 회수", "active", "1칸 안의 내 폭탄을 다시 주움 (재사용 6초)", { cd: 6 }),
  // 영웅
  A("tripleBomb", "epic", "triple", "삼중 폭탄", "active", "앞으로 폭탄 3개를 한 줄로 설치 (재사용 18초)", { cd: 18 }),
  A("giantBomb", "epic", "giant", "거대 폭탄", "active", "다음 폭탄이 범위 +3·가운데 3×3 폭발 (재사용 14초)", { cd: 14 }),
  A("flameLord", "epic", "crown-fire", "화염 지배자", "passive", "폭발 범위 +2 · 불길이 1초 남음"),
  A("splitBomb", "epic", "split", "분열 폭탄", "passive", "내 폭탄이 터진 뒤 대각선에 작은 폭탄 4개"),
  A("absorb", "epic", "absorb", "폭발 흡수", "passive", "불길에 맞으면 대신 보호막으로 바꿔 버팀 (재사용 30초)", { cd: 30 }),
  A("teleport", "epic", "portal", "순간이동", "active", "4칸 안의 가장 안전한 칸으로 순간이동 (재사용 15초)", { cd: 15 }),
  A("magnet", "epic", "magnet", "폭탄 자석", "active", "4칸 안 폭탄을 내 쪽으로 끌어당김 (재사용 12초)", { cd: 12 }),
  A("trapMaster", "epic", "mine", "함정 전문가", "active", "상대에게 안 보이는 지뢰 설치, 최대 2개 (재사용 8초)", { cd: 8 }),
  A("chainSprint", "epic", "box-boot", "연쇄 질주", "passive", "상자를 부술 때마다 1.5초 동안 빨라짐"),
  A("reflect", "epic", "mirror", "폭발 반사", "passive", "상대 불길에 맞으면 버티고 그 자리에 내 폭발 (재사용 25초)", { cd: 25 }),
  // 전설
  A("nuke", "legendary", "nuke", "핵폭탄", "active", "3초 경고 후 거의 판 끝까지 닿는 관통 폭발 (재사용 60초)", { cd: 60 }),
  A("timeStop", "legendary", "clock", "시간 정지", "active", "4칸 안 폭탄 타이머를 3초 멈춤 (재사용 30초)", { cd: 30 }),
  A("bombStorm", "legendary", "storm", "폭탄 폭풍", "active", "1초 경고 뒤 상대 주변 5곳에 폭탄 (재사용 45초)", { cd: 45 }),
  A("immortalShield", "legendary", "star-shield", "불사의 방패", "active", "2초 동안 폭발 무적 (재사용 35초)", { cd: 35 }),
  A("spaceWarp", "legendary", "warp", "공간 왜곡", "active", "한 번 누르면 표시, 다시 누르면 그 자리로 순간이동 (재사용 20초)", { cd: 20 }),
  A("detonate", "legendary", "detonator", "폭발 지배", "active", "내 폭탄 전부 즉시 기폭 (재사용 6초)", { cd: 6 }),
  A("lastStand", "legendary", "phoenix", "최후의 생존자", "passive", "탈락하는 순간 한 번 살아남아 안전한 칸으로 (1회)"),
  A("fateSwap", "legendary", "swap", "운명 역전", "active", "6칸 안 가장 가까운 상대와 자리 교환 (재사용 40초)", { cd: 40 }),
  A("blackHole", "legendary", "hole", "블랙홀 폭탄", "active", "다음 폭탄이 터지기 전 주변 상대를 끌어당김 (재사용 30초)", { cd: 30 }),
  A("doomBomb", "legendary", "skull", "종말의 폭탄", "active", "4초 경고 뒤 9×9 대폭발 (재사용 90초)", { cd: 90 }),
];
export const AUG = Object.fromEntries(AUGS.map(a => [a.id, a]));
const WEIGHTS = [{ common: 64, rare: 28, epic: 7, legendary: 1 }, { common: 44, rare: 36, epic: 16, legendary: 4 }, { common: 28, rare: 38, epic: 26, legendary: 8 }, { common: 18, rare: 34, epic: 34, legendary: 14 }, { common: 12, rare: 30, epic: 38, legendary: 20 }];
export function rollOffer(i, owned, rng = Math.random, n = 3, exclude = []) {
  const w = WEIGHTS[Math.min(i, WEIGHTS.length - 1)], pool = AUGS.filter(a => !owned.includes(a.id) && !exclude.includes(a.id)), out = [];
  for (let k = 0; k < n && pool.length; k++) { let tot = 0; for (const a of pool) tot += w[a.rarity]; let x = rng() * tot, j = 0; for (; j < pool.length - 1; j++) { x -= w[pool[j].rarity]; if (x <= 0) break; } out.push(pool[j].id); pool.splice(j, 1); }
  return out;
}

// ---------------- 경기 ----------------
export class BombGame {
  /** players: [{ id, name, team, isBot, color }] · opts: { mode, theme, teamMode } */
  constructor(players, opts = {}, rng = Math.random) {
    this.rng = rng;
    this.mode = opts.mode === "augment" ? "augment" : "classic";
    this.theme = THEMES.includes(opts.theme) ? opts.theme : THEMES[Math.floor(rng() * THEMES.length)];
    this.teamMode = !!opts.teamMode;
    this.t = 0; this.phase = "init"; this.events = []; this.seq = 0; this.tilesVer = 1;
    this.tiles = new Uint8Array(W * H); this.sp = new Uint8Array(W * H);
    this.items = new Map(); this.bombs = []; this.flames = new Map(); this.zones = []; this.mines = []; this.warns = [];
    this.recent = []; this.bombSeq = 0; this.pickIdx = -1; this.nextPick = 0; this.pickUntil = 0; this.sdIdx = 0; this.sdNext = SD_AT; this.sdOrder = spiral();
    this.endAt = 0; this.result = null; this.ventNext = 4;
    this.genMap();
    this.players = new Map();
    players.forEach((p, i) => {
      const [sx, sy] = SPAWNS[i % SPAWNS.length];
      this.players.set(p.id, {
        id: p.id, name: p.name, team: p.team ?? i, color: p.color ?? i, isBot: !!p.isBot, slot: i,
        x: sx, y: sy, dir: 3, mv: 0, moving: false, alive: true, speed: BASE_SPEED, maxBombs: 1, range: 2,
        kick: false, glove: false, shield: 0, dash: 0, special: null, specialN: 0,
        augs: [], offer: null, picked: true, refresh: 1,
        inv: 0, ghost: 0, slow: 0, boost: 0, warp: null, nextGiant: false, nextHole: false, boxCount: 0, lastStandUsed: false,
        stats: { kills: 0, boxes: 0, items: 0, bombs: 0, deathAt: null, killer: null, augUses: {} }, act: 0, bot: { next: 0, path: null },
      });
    });
    this.clearSpawns();
  }
  emit(type, d = {}) { this.events.push({ type, ...d }); if (this.events.length > 400) this.events.splice(0, 100); }
  drain() { const e = this.events; this.events = []; return e; }

  // ---------------- 맵 ----------------
  genMap() {
    const t = this.tiles, sp = this.sp, r = this.rng;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1 || (x % 2 === 0 && y % 2 === 0)) t[i] = T_WALL;
      else t[i] = r() < 0.72 ? T_BOX : T_FLOOR;
    }
    // 테마별 특수 바닥
    const free = () => { for (let k = 0; k < 200; k++) { const x = 1 + Math.floor(r() * (W - 2)), y = 1 + Math.floor(r() * (H - 2)); if (t[idx(x, y)] !== T_WALL && !nearSpawn(x, y)) return [x, y]; } return null; };
    if (this.theme === "ice") for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (t[idx(x, y)] !== T_WALL && (x + y) % 3 !== 0 && Math.abs(x - 7) + Math.abs(y - 6) < 8) sp[idx(x, y)] = SP.ICE;
    if (this.theme === "jungle") for (let k = 0; k < 14; k++) { const c = free(); if (c) { sp[idx(c[0], c[1])] = SP.BUSH; } }
    if (this.theme === "toy") { for (let x = 3; x <= 11; x++) if (t[idx(x, 3)] !== T_WALL) sp[idx(x, 3)] = SP.CV_R; for (let x = 3; x <= 11; x++) if (t[idx(x, 9)] !== T_WALL) sp[idx(x, 9)] = SP.CV_L; }
    if (this.theme === "volcano") for (const [x, y] of [[5, 5], [9, 7], [5, 7], [9, 5], [7, 3], [7, 9]]) if (t[idx(x, y)] !== T_WALL) { sp[idx(x, y)] = SP.VENT; t[idx(x, y)] = T_FLOOR; }
    if (this.theme === "space") { const pads = [[3, 3, SP.TP_A], [11, 9, SP.TP_A], [11, 3, SP.TP_B], [3, 9, SP.TP_B]]; for (const [x, y, v] of pads) { sp[idx(x, y)] = v; t[idx(x, y)] = T_FLOOR; } }
  }
  clearSpawns() {
    for (const p of this.players.values()) {
      const [sx, sy] = [Math.round(p.x), Math.round(p.y)];
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = sx + dx, y = sy + dy; if (inb(x, y) && this.tiles[idx(x, y)] === T_BOX) this.tiles[idx(x, y)] = T_FLOOR; }
      // 출발점 바로 옆 2칸도 비워 첫 폭탄을 피할 수 있게
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) { const x = sx + dx, y = sy + dy; if (inb(x, y) && this.tiles[idx(x, y)] === T_BOX && this.rng() < 0.5) this.tiles[idx(x, y)] = T_FLOOR; }
      this.sp[idx(sx, sy)] = 0;
    }
  }

  // ---------------- 진행 ----------------
  start() { if (this.mode === "augment") this.startPick(); else { this.phase = "play"; this.emit("go"); } }
  startPick() {
    this.pickIdx++; this.phase = "pick"; this.pickUntil = PICK_SEC;
    for (const p of this.players.values()) {
      if (!p.alive || p.augs.length >= MAX_AUGS) { p.offer = null; p.picked = true; continue; }
      p.offer = rollOffer(this.pickIdx, p.augs.map(a => a.id), this.rng); p.picked = !p.offer.length; p.refresh = 1;
    }
    this.emit("pick", { idx: this.pickIdx });
    if ([...this.players.values()].every(p => p.picked)) this.endPick();
  }
  pick(uid, id, auto = false) {
    const p = this.players.get(uid);
    if (this.phase !== "pick" || !p || p.picked) return { ok: false, error: "NOT_PICKING" };
    if (!p.offer.includes(id)) return { ok: false, error: "NOT_OFFERED" };
    p.augs.push({ id, cdUntil: 0, used: 0 }); p.picked = true; p.offer = null;
    this.applyPassive(p, id);
    this.emit("picked", { uid, id, auto });
    if ([...this.players.values()].every(q => q.picked)) this.endPick();
    return { ok: true };
  }
  refreshOffer(uid) { const p = this.players.get(uid); if (this.phase !== "pick" || !p || p.picked) return { ok: false, error: "NOT_PICKING" }; if (p.refresh <= 0) return { ok: false, error: "NO_REFRESH" }; p.refresh--; p.offer = rollOffer(this.pickIdx, p.augs.map(a => a.id), this.rng, 3, p.offer); return { ok: true }; }
  autoPick() { for (const p of this.players.values()) if (!p.picked && p.offer?.length) this.pick(p.id, botPick(p.offer, this.rng), true); }
  endPick() { if (this.phase !== "pick") return; this.phase = "play"; this.nextPick = this.t + PICK_EVERY; this.emit("go", { after: this.pickIdx }); }
  applyPassive(p, id) {
    if (id === "bombExpert") p.maxBombs++;
    if (id === "firePower") p.range++;
    if (id === "flameLord") p.range += 2;
    if (id === "swift") p.speed = Math.min(MAX_SPEED, p.speed + 0.6);
    if (id === "kicker") p.kick = true;
    if (id === "thrower") p.glove = true;
    if (id === "barrier") p.shield++;
  }
  has(p, id) { return this.mode === "augment" && p.augs.some(a => a.id === id); }
  aug(p, id) { return p.augs.find(a => a.id === id); }
  ready(p, id) { const a = this.aug(p, id); return a && a.cdUntil <= this.t; }
  cool(p, id) { const a = this.aug(p, id); if (a) { a.cdUntil = this.t + (AUG[id].cd || 0); a.used++; p.stats.augUses[id] = (p.stats.augUses[id] || 0) + 1; } }

  // ---------------- 입력 ----------------
  input(uid, mv) { const p = this.players.get(uid); if (p && Number.isInteger(mv) && mv >= 0 && mv <= 4) p.mv = mv; }
  placeBomb(uid, opts = {}) {
    const p = this.players.get(uid);
    if (!p || !p.alive || this.phase !== "play") return { ok: false, error: "CANT" };
    const x = opts.x ?? Math.round(p.x), y = opts.y ?? Math.round(p.y);
    if (!inb(x, y) || this.tiles[idx(x, y)] !== T_FLOOR || this.bombAt(x, y)) return { ok: false, error: "OCCUPIED" };
    if (this.bombs.some(b => b.x === x && b.y === y && b.kind === "mine" && (b.owner === uid || (this.teamMode && b.team === p.team)))) return { ok: false, error: "OCCUPIED" }; // 내(우리 팀) 지뢰 위엔 못 놓음
    if (!opts.free && this.bombs.filter(b => b.owner === uid && !b.free).length >= p.maxBombs) return { ok: false, error: "MAX_BOMBS" };
    let kind = opts.kind || "normal", range = opts.range ?? p.range;
    if (!opts.kind && !opts.free) {
      if (p.nextGiant) { kind = "giant"; p.nextGiant = false; }
      else if (p.nextHole) { kind = "hole"; p.nextHole = false; }
      else if (p.special && p.specialN > 0) { kind = p.special; if (--p.specialN <= 0) p.special = null; }
    }
    if (kind === "giant") range += 3;
    let fuse = opts.fuse ?? (this.has(p, "fastFuse") ? 1.3 : FUSE);
    if (this.has(p, "remote") && !opts.fuse && kind !== "mine") fuse = 12;
    if (kind === "mine") fuse = 25;
    const b = { id: ++this.bombSeq, x, y, fx: x, fy: y, owner: uid, team: p.team, range, kind, at: this.t + fuse, born: this.t, pass: new Set(), slide: null, frozen: 0, free: !!opts.free, hidden: kind === "mine" };
    for (const q of this.players.values()) if (q.alive && Math.abs(q.x - x) < 0.95 && Math.abs(q.y - y) < 0.95) b.pass.add(q.id);
    if (kind === "moving") b.slide = DIRS[p.dir] ? [...DIRS[p.dir]] : null;
    this.bombs.push(b); this.recent.push({ owner: uid, team: p.team, x, y, born: this.t });
    if (this.recent.length > 80) this.recent.splice(0, 20);
    p.stats.bombs++;
    this.emit("bomb", { x, y, kind, uid: p.id, id: b.id });
    if (!opts.free) {
      if (this.has(p, "quickPlant")) p.boost = Math.max(p.boost, this.t + 1);
      if (this.has(p, "bombClone") && this.rng() < 0.25) { const c = this.freeNeighbor(x, y); if (c) this.placeBomb(uid, { x: c[0], y: c[1], free: true, kind: kind === "giant" || kind === "hole" || kind === "mine" ? "normal" : kind }); }
    }
    return { ok: true };
  }
  /** 보조 행동: dash · throw · det(원격 기폭) · 증강 id */
  action(uid, k) {
    const p = this.players.get(uid);
    if (!p || !p.alive || this.phase !== "play") return { ok: false, error: "CANT" };
    if (p.act > this.t) return { ok: false, error: "TOO_FAST" };
    p.act = this.t + 0.15;
    if (k === "dash") {
      if (p.dash <= 0) return { ok: false, error: "NO_DASH" };
      const [dx, dy] = DIRS[p.dir]; let n = 0;
      for (let s = 1; s <= 3; s++) { const x = Math.round(p.x) + dx * s, y = Math.round(p.y) + dy * s; if (this.solidFor(p, x, y)) break; n = s; }
      if (!n) return { ok: false, error: "BLOCKED" };
      p.dash--; const fx = p.x, fy = p.y; p.x = Math.round(p.x) + dx * n; p.y = Math.round(p.y) + dy * n;
      this.emit("dash", { uid, fx, fy, x: p.x, y: p.y }); return { ok: true };
    }
    if (k === "throw") {
      if (!p.glove) return { ok: false, error: "NO_GLOVE" };
      const cx = Math.round(p.x), cy = Math.round(p.y), [dx, dy] = DIRS[p.dir];
      const b = this.bombAt(cx, cy) || this.bombAt(cx + dx, cy + dy);
      if (!b || b.owner !== uid) return this.placeThrow(p);
      return this.throwBomb(b, dx, dy);
    }
    if (k === "det") { if (!this.has(p, "remote")) return { ok: false, error: "NO_AUG" }; return this.detonateOwn(p, "remote"); }
    const a = this.aug(p, k), def = AUG[k];
    if (!a || !def || def.kind !== "active") return { ok: false, error: "NO_AUG" };
    if (a.cdUntil > this.t) return { ok: false, error: "COOLDOWN" };
    const r = this.useAug(p, k);
    if (r.ok) { if (!r.noCd) this.cool(p, k); this.emit("aug", { uid, id: k, x: p.x, y: p.y, ...(r.fx || {}) }); }
    return r;
  }
  placeThrow(p) { // 손에 든 폭탄 없이 던지기 → 지금 칸에 놓고 바로 던짐
    const r = this.placeBomb(p.id); if (!r.ok) return r;
    const b = this.bombs[this.bombs.length - 1]; const [dx, dy] = DIRS[p.dir];
    return this.throwBomb(b, dx, dy);
  }
  throwBomb(b, dx, dy) {
    if (!dx && !dy) return { ok: false, error: "NO_DIR" };
    let tx = b.x + dx * 3, ty = b.y + dy * 3;
    for (let k = 0; k < 8; k++) { if (inb(tx, ty) && this.tiles[idx(tx, ty)] === T_FLOOR && !this.bombAt(tx, ty)) break; tx += dx; ty += dy; if (!inb(tx, ty)) { tx = Math.max(1, Math.min(W - 2, tx)); ty = Math.max(1, Math.min(H - 2, ty)); break; } }
    if (!inb(tx, ty) || this.tiles[idx(tx, ty)] !== T_FLOOR || this.bombAt(tx, ty)) return { ok: false, error: "BLOCKED" };
    const fx = b.x, fy = b.y; b.x = tx; b.y = ty; b.fx = tx; b.fy = ty; b.slide = null; b.pass.clear(); b.at = Math.max(b.at, this.t + 0.6);
    for (const q of this.players.values()) if (q.alive && Math.abs(q.x - tx) < 0.95 && Math.abs(q.y - ty) < 0.95) b.pass.add(q.id);
    this.landed(b);
    this.emit("throw", { id: b.id, fx, fy, x: tx, y: ty }); return { ok: true };
  }
  detonateOwn(p, why) {
    const mine = this.bombs.filter(b => b.owner === p.id && b.kind !== "mine");
    if (!mine.length) return { ok: false, error: "NO_BOMBS" };
    for (const b of mine) b.at = Math.min(b.at, this.t);
    this.emit("detonate", { uid: p.id, why }); return { ok: true };
  }
  useAug(p, id) {
    const cx = Math.round(p.x), cy = Math.round(p.y), [dx, dy] = DIRS[p.dir];
    switch (id) {
      case "remote": return this.detonateOwn(p, "remote");
      case "detonate": return this.detonateOwn(p, "detonate");
      case "ghostWalk": p.ghost = this.t + 3; return { ok: true };
      case "immortalShield": p.inv = Math.max(p.inv, this.t + 2); return { ok: true };
      case "recall": { const b = this.bombs.find(b => b.owner === p.id && Math.abs(b.x - cx) + Math.abs(b.y - cy) <= 1 && b.kind !== "mine"); if (!b) return { ok: false, error: "NO_BOMBS" }; this.bombs.splice(this.bombs.indexOf(b), 1); this.emit("recall", { id: b.id }); return { ok: true }; }
      case "tripleBomb": {
        let n = 0; for (let s = 0; s < 3; s++) { const x = cx + dx * s, y = cy + dy * s; if (!inb(x, y) || this.tiles[idx(x, y)] !== T_FLOOR || this.bombAt(x, y)) break; this.placeBomb(p.id, { x, y, free: true }); n++; }
        return n ? { ok: true } : { ok: false, error: "BLOCKED" };
      }
      case "giantBomb": p.nextGiant = true; return { ok: true };
      case "blackHole": p.nextHole = true; return { ok: true };
      case "teleport": { const c = this.safestNear(p, 4); if (!c) return { ok: false, error: "NO_SPOT" }; const fx = p.x, fy = p.y; p.x = c[0]; p.y = c[1]; return { ok: true, fx: { fx, fy, tx: c[0], ty: c[1] } }; }
      case "magnet": {
        let n = 0;
        for (const b of this.bombs) { const d = Math.abs(b.x - cx) + Math.abs(b.y - cy); if (d === 0 || d > 4 || b.kind === "mine") continue; const sx = Math.sign(cx - b.x), sy = Math.sign(cy - b.y); if (sx && !sy) { b.slide = [sx, 0]; n++; } else if (sy && !sx) { b.slide = [0, sy]; n++; } }
        return n ? { ok: true } : { ok: false, error: "NO_BOMBS" };
      }
      case "trapMaster": {
        if (this.bombs.filter(b => b.owner === p.id && b.kind === "mine").length >= 2) return { ok: false, error: "MAX_MINES" };
        return this.placeBomb(p.id, { kind: "mine", free: true, range: 2 });
      }
      case "nuke": return this.placeBomb(p.id, { kind: "nuke", free: true, range: 12, fuse: 3 });
      case "doomBomb": return this.placeBomb(p.id, { kind: "doom", free: true, range: 4, fuse: 4 });
      case "timeStop": { let n = 0; for (const b of this.bombs) if (Math.abs(b.x - cx) <= 4 && Math.abs(b.y - cy) <= 4) { b.frozen = this.t + 3; b.at += 3; n++; } return n ? { ok: true } : { ok: false, error: "NO_BOMBS" }; }
      case "bombStorm": {
        const foes = [...this.players.values()].filter(q => q.alive && q.team !== p.team); if (!foes.length) return { ok: false, error: "NO_TARGET" };
        const spots = [];
        for (const f of foes) for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [0, 2]]) { const x = Math.round(f.x) + ox, y = Math.round(f.y) + oy; if (inb(x, y) && this.tiles[idx(x, y)] === T_FLOOR && !this.bombAt(x, y)) spots.push([x, y]); }
        shuffle(spots, this.rng); const pick = spots.slice(0, 5);
        for (const [x, y] of pick) this.warns.push({ x, y, at: this.t + 1, kind: "storm", owner: p.id });
        return pick.length ? { ok: true, fx: { spots: pick } } : { ok: false, error: "NO_SPOT" };
      }
      case "spaceWarp": {
        if (!p.warp) { p.warp = { x: cx, y: cy, until: this.t + 20 }; const a = this.aug(p, id); a.cdUntil = this.t; this.emit("warpMark", { uid: p.id, x: cx, y: cy }); return { ok: true, noCd: true }; }
        const w = p.warp; p.warp = null;
        if (this.tiles[idx(w.x, w.y)] !== T_FLOOR) return { ok: false, error: "BLOCKED" };
        const fx = p.x, fy = p.y; p.x = w.x; p.y = w.y; return { ok: true, fx: { fx, fy, tx: w.x, ty: w.y } };
      }
      case "fateSwap": {
        let best = null, bd = 99;
        for (const q of this.players.values()) { if (!q.alive || q.team === p.team) continue; const d = Math.abs(q.x - p.x) + Math.abs(q.y - p.y); if (d <= 6 && d < bd) { bd = d; best = q; } }
        if (!best) return { ok: false, error: "NO_TARGET" };
        const tx = best.x, ty = best.y; best.x = p.x; best.y = p.y; p.x = tx; p.y = ty;
        // 유령 걸음 중인 사람과 바꾸면 상자·벽 속에 들어갈 수 있음 → 가까운 빈칸으로
        for (const q of [p, best]) { const cx = Math.round(q.x), cy = Math.round(q.y); if (!q.ghost && this.tiles[idx(cx, cy)] !== T_FLOOR) { const c = this.nearestFree(cx, cy); if (c) { q.x = c[0]; q.y = c[1]; } } }
        return { ok: true, fx: { other: best.id } };
      }
    }
    return { ok: false, error: "NO_AUG" };
  }

  // ---------------- 이동 ----------------
  bombAt(x, y) { return this.bombs.find(b => b.x === x && b.y === y && !(b.hidden && b.kind === "mine")) || null; }
  bombAtAny(x, y) { return this.bombs.find(b => b.x === x && b.y === y) || null; }
  solidFor(p, x, y) {
    if (!inb(x, y)) return true;
    const t = this.tiles[idx(x, y)];
    if (t === T_WALL) return true;
    const ghost = p && p.ghost > this.t;
    if (t === T_BOX) return !ghost;
    const b = this.bombAt(x, y);
    if (b && !ghost && !(p && b.pass.has(p.id))) return true;
    return false;
  }
  speedOf(p) {
    let s = p.speed;
    if (p.boost > this.t) s *= 1.45;
    if (p.slow > this.t) s *= 0.55;
    const i = idx(Math.round(p.x), Math.round(p.y));
    if (this.sp[i] === SP.ICE) s *= 1.3;
    if (this.has(p, "survivalInstinct") && this.dangerAt(Math.round(p.x), Math.round(p.y)) < 3) s *= 1.3;
    return Math.min(s, 8.5);
  }
  movePlayer(p, dt) {
    const mv = p.mv;
    p.moving = false;
    if (mv) p.dir = mv;
    const conv = this.sp[idx(Math.round(p.x), Math.round(p.y))];
    if (!mv && conv >= SP.CV_U && conv <= SP.CV_L) this.step(p, conv - 1, 1.6 * dt);
    if (!mv) return;
    this.step(p, mv, this.speedOf(p) * dt, true);
  }
  /** 한 방향으로 길이만큼 이동 (모서리 걸리면 줄 가운데로 밀어 줌) */
  step(p, mv, len, user = false) {
    const [dx, dy] = DIRS[mv];
    const horiz = dx !== 0;
    let left = len;
    const lane = horiz ? Math.round(p.y) : Math.round(p.x);
    const off = horiz ? p.y - lane : p.x - lane;
    const cx = Math.round(p.x), cy = Math.round(p.y);
    const ahead = horiz ? this.solidFor(p, cx + dx, lane) : this.solidFor(p, lane, cy + dy);
    // 줄 맞추기
    if (Math.abs(off) > 0.001) {
      if (!ahead || (horiz ? (dx > 0 ? p.x < cx : p.x > cx) : (dy > 0 ? p.y < cy : p.y > cy))) {
        const m = Math.min(Math.abs(off), left); if (horiz) p.y -= Math.sign(off) * m; else p.x -= Math.sign(off) * m; left -= m * 0.6; p.moving = true;
      } else if (user && Math.abs(off) > 0.08) {
        // 옆 줄로 비켜 가기 (모서리 보정)
        const alt = lane + Math.sign(off);
        const altFree = horiz ? !this.solidFor(p, cx + dx, alt) && !this.solidFor(p, cx, alt) : !this.solidFor(p, alt, cy + dy) && !this.solidFor(p, alt, cy);
        if (altFree) { const m = Math.min(1 - Math.abs(off), left); if (horiz) p.y += Math.sign(off) * m; else p.x += Math.sign(off) * m; p.moving = true; return; }
      }
    }
    if (left <= 0) return;
    if (horiz) {
      let nx = p.x + dx * left;
      const c = Math.round(p.x);
      if (this.solidFor(p, c + dx, lane)) { nx = dx > 0 ? Math.min(nx, c) : Math.max(nx, c); }
      else { const c2 = Math.round(nx); if (c2 !== c && this.solidFor(p, c2 + dx, lane)) nx = dx > 0 ? Math.min(nx, c2) : Math.max(nx, c2); }
      // 폭탄 차기
      if (user && p.kick && Math.abs(nx - c) < 0.02) { const b = this.bombAt(c + dx, lane); if (b && !b.pass.has(p.id) && !b.slide && b.kind !== "mine") this.kick(b, dx, 0); }
      if (Math.abs(nx - p.x) > 1e-4) p.moving = true;
      p.x = nx;
    } else {
      let ny = p.y + dy * left;
      const c = Math.round(p.y);
      if (this.solidFor(p, lane, c + dy)) { ny = dy > 0 ? Math.min(ny, c) : Math.max(ny, c); }
      else { const c2 = Math.round(ny); if (c2 !== c && this.solidFor(p, lane, c2 + dy)) ny = dy > 0 ? Math.min(ny, c2) : Math.max(ny, c2); }
      if (user && p.kick && Math.abs(ny - c) < 0.02) { const b = this.bombAt(lane, c + dy); if (b && !b.pass.has(p.id) && !b.slide && b.kind !== "mine") this.kick(b, 0, dy); }
      if (Math.abs(ny - p.y) > 1e-4) p.moving = true;
      p.y = ny;
    }
  }
  /** 미끄러지거나 던져진 폭탄이 불길 위에 멈추면 바로 터짐 */
  landed(b) { if (this.flames.has(idx(b.x, b.y)) && b.at > this.t) { b.at = this.t; b.chained = true; b.hidden = false; } }
  kick(b, dx, dy) { b.slide = [dx, dy]; this.emit("kick", { id: b.id }); }
  slideBomb(b, dt) {
    const [dx, dy] = b.slide;
    const nx = b.x + dx, ny = b.y + dy;
    const blocked = !inb(nx, ny) || this.tiles[idx(nx, ny)] !== T_FLOOR || this.bombAtAny(nx, ny) || [...this.players.values()].some(q => q.alive && Math.round(q.x) === nx && Math.round(q.y) === ny);
    if (blocked) { b.fx = b.x; b.fy = b.y; b.slide = null; return; }
    b.fx += dx * SLIDE_SPEED * dt; b.fy += dy * SLIDE_SPEED * dt;
    if ((dx && Math.abs(b.fx - b.x) >= 1) || (dy && Math.abs(b.fy - b.y) >= 1)) { b.x = nx; b.y = ny; b.fx = nx; b.fy = ny; b.pass.clear(); if (b.kind === "moving" && this.rng() < 0.15) b.slide = null; this.landed(b); }
  }

  // ---------------- 한 틱 ----------------
  tick(dt = TICK) {
    if (this.phase === "pick") {
      this.pickUntil -= dt;
      // AI는 1.5초쯤 뒤에 고름 (사람을 오래 기다리게 하지 않음)
      if (this.pickUntil < PICK_SEC - 1.5) for (const p of this.players.values()) if (p.isBot && !p.picked && p.offer?.length && this.phase === "pick") this.pick(p.id, botPick(p.offer, this.rng), true);
      if (this.phase === "pick" && this.pickUntil <= 0) this.autoPick();
      return;
    }
    if (this.phase !== "play") return;
    this.t += dt; this.seq++;
    // 증강 고르기
    if (this.mode === "augment" && this.t >= this.nextPick && this.nextPick > 0 && [...this.players.values()].some(p => p.alive && p.augs.length < MAX_AUGS)) { this.startPick(); return; }
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      if (p.isBot) botThink(this, p);
      this.movePlayer(p, dt);
      // 지나간 폭탄은 다시 막힘
      for (const b of this.bombs) if (b.pass.has(p.id) && (Math.abs(p.x - b.x) >= 0.98 || Math.abs(p.y - b.y) >= 0.98)) b.pass.delete(p.id);
      // 유령 걸음이 끝났는데 상자 안이면 밀어냄
      if (p.ghost && p.ghost <= this.t) { p.ghost = 0; const cx = Math.round(p.x), cy = Math.round(p.y); if (this.tiles[idx(cx, cy)] !== T_FLOOR) { const c = this.nearestFree(cx, cy); if (c) { p.x = c[0]; p.y = c[1]; } } }
      // 순간이동 패드
      const si = this.sp[idx(Math.round(p.x), Math.round(p.y))];
      // 패드 가운데쯤 올라서야 타고, 한 번 타면 2초 동안은 다시 안 탐(왔다 갔다 무한 반복 방지)
      if ((si === SP.TP_A || si === SP.TP_B) && !p.tpLock && !(p.tpAt > this.t - 2) && Math.abs(p.x - Math.round(p.x)) < 0.3 && Math.abs(p.y - Math.round(p.y)) < 0.3) { let o = this.otherPad(Math.round(p.x), Math.round(p.y), si); if (o) { o = this.padExit(o, p.dir); const fx = p.x, fy = p.y; p.x = o[0]; p.y = o[1]; p.tpLock = true; p.tpAt = this.t; if (p.bot) p.bot.path = null; this.emit("tp", { uid: p.id, fx, fy, x: o[0], y: o[1] }); } }
      else if (si !== SP.TP_A && si !== SP.TP_B) p.tpLock = false;
      else if (p.tpAt > this.t - 2) p.tpLock = true; // 다시 탈 수 없는 동안 밟은 패드는 한 번 내려와야 탐
      // 아이템
      const ii = idx(Math.round(p.x), Math.round(p.y)), it = this.items.get(ii);
      if (it && Math.abs(p.x - Math.round(p.x)) < 0.45 && Math.abs(p.y - Math.round(p.y)) < 0.45) { this.items.delete(ii); this.giveItem(p, it); this.emit("item", { uid: p.id, it, x: Math.round(p.x), y: Math.round(p.y) }); }
      // 지뢰
      for (const b of this.bombs) if (b.kind === "mine" && b.team !== p.team && Math.round(p.x) === b.x && Math.round(p.y) === b.y && b.at > this.t + 0.3) { b.at = this.t + 0.25; b.hidden = false; this.emit("mineHit", { x: b.x, y: b.y }); }
    }
    // 폭탄
    for (const b of this.bombs) {
      if (b.slide) this.slideBomb(b, dt);
      if (b.kind === "hole" && b.at - this.t < 0.6 && !b.pulled) { b.pulled = true; this.pullPlayers(b); }
    }
    // 경고 → 폭탄 폭풍
    for (const w of this.warns.splice(0)) { if (w.at <= this.t) { if (w.kind === "storm") this.placeBomb(w.owner, { x: w.x, y: w.y, free: true, fuse: 0.9, range: 2 }); else if (w.kind === "vent") this.blast(w.x, w.y, 2, null, null, { vent: true }); } else this.warns.push(w); }
    // 터짐 (연쇄는 같은 틱 안에서)
    let guard = 0;
    while (guard++ < 60) { const b = this.bombs.find(x => x.at <= this.t); if (!b) break; this.explode(b); }
    // 불길·지대 정리
    for (const [i, f] of this.flames) if (f.until <= this.t) { this.flames.delete(i); }
    this.zones = this.zones.filter(z => z.until > this.t);
    // 화산 분출
    if (this.theme === "volcano" && this.t >= this.ventNext) { this.ventNext = this.t + 9; for (let i = 0; i < W * H; i++) if (this.sp[i] === SP.VENT) this.warns.push({ x: i % W, y: (i / W) | 0, at: this.t + 1.2, kind: "vent" }); this.emit("ventWarn", {}); }
    // 감속 지대
    for (const z of this.zones) for (const p of this.players.values()) if (p.alive && p.team !== z.team && Math.round(p.x) === z.x && Math.round(p.y) === z.y) p.slow = Math.max(p.slow, this.t + 0.4);
    // 피격
    for (const p of this.players.values()) if (p.alive) { const f = this.flames.get(idx(Math.round(p.x), Math.round(p.y))); if (f) this.hit(p, f); }
    // 서든데스
    this.suddenDeath();
    this.checkEnd();
  }
  pullPlayers(b) {
    for (const q of this.players.values()) {
      if (!q.alive || q.team === b.team) continue;
      const dx = b.x - Math.round(q.x), dy = b.y - Math.round(q.y);
      if (Math.abs(dx) + Math.abs(dy) > 3 || (dx && dy)) continue;
      const sx = Math.sign(dx), sy = Math.sign(dy), nx = Math.round(q.x) + sx, ny = Math.round(q.y) + sy;
      if (!this.solidFor(q, nx, ny) || (nx === b.x && ny === b.y)) { q.x = nx; q.y = ny; this.emit("pulled", { uid: q.id }); }
    }
  }
  explode(b) {
    const i = this.bombs.indexOf(b); if (i < 0) return; this.bombs.splice(i, 1);
    const p = this.players.get(b.owner);
    let range = b.range;
    if (b.chained && p && this.has(p, "chainBoost")) range += 2;
    const opt = { pierce: b.kind === "pierce" || b.kind === "nuke", ice: b.kind === "ice" || (p && this.has(p, "iceBomb")), chain: b.kind === "chain" };
    this.emit("boom", { x: b.x, y: b.y, kind: b.kind, range, uid: b.owner });
    if (b.kind === "giant") for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) this.burnCell(b.x + ox, b.y + oy, b, opt);
    if (b.kind === "doom") { for (let oy = -4; oy <= 4; oy++) for (let ox = -4; ox <= 4; ox++) this.burnCell(b.x + ox, b.y + oy, b, { ...opt, pierce: true, wallStop: true }); }
    else this.blast(b.x, b.y, range, b, p, opt);
    if (b.kind === "split" || (p && this.has(p, "splitBomb") && b.kind !== "mini")) { let n = 0; for (const [ox, oy] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) { if (n >= 4) break; const x = b.x + ox, y = b.y + oy; if (inb(x, y) && this.tiles[idx(x, y)] === T_FLOOR && !this.bombAtAny(x, y) && ++n) this.bombs.push({ id: ++this.bombSeq, x, y, fx: x, fy: y, owner: b.owner, team: b.team, range: 1, kind: "mini", at: this.t + 0.9, born: this.t, pass: new Set(), slide: null, frozen: 0, free: true }); } }
  }
  /** 십자 폭발 */
  blast(x, y, range, b, p, opt = {}) {
    this.burnCell(x, y, b, opt);
    for (let d = 1; d <= 4; d++) {
      const [dx, dy] = DIRS[d];
      for (let s = 1; s <= range; s++) {
        const cx = x + dx * s, cy = y + dy * s;
        if (!inb(cx, cy)) break;
        const t = this.tiles[idx(cx, cy)];
        if (t === T_WALL) break;
        const stop = this.burnCell(cx, cy, b, opt);
        if (stop && !opt.pierce) break;
      }
    }
  }
  /** 한 칸 태우기 → true 면 불길이 여기서 멈춤 */
  burnCell(x, y, b, opt = {}) {
    if (!inb(x, y)) return true;
    const i = idx(x, y), t = this.tiles[i];
    if (t === T_WALL) return true;
    const owner = b ? b.owner : null, p = owner ? this.players.get(owner) : null;
    let dur = FLAME_T; if (p && this.has(p, "afterFlame")) dur = 1.3; if (p && this.has(p, "flameLord")) dur = Math.max(dur, 1.0);
    if (t === T_BOX) {
      this.tiles[i] = T_FLOOR; this.tilesVer++;
      if (p) { p.stats.boxes++; if (this.has(p, "chainSprint")) p.boost = Math.max(p.boost, this.t + 1.5); if (this.has(p, "boxHunter") && ++p.boxCount % 4 === 0) { const it = ["bomb", "fire", "speed"][Math.floor(this.rng() * 3)]; this.giveItem(p, it); this.emit("item", { uid: p.id, it, x: Math.round(p.x), y: Math.round(p.y), bonus: true }); } }
      const chance = 0.36 + (p && this.has(p, "luckyBox") ? 0.22 : 0);
      if (this.rng() < chance) this.items.set(i, this.rollItem()), this.itemBornAt = this.t;
      this.flames.set(i, { until: this.t + dur, owner, team: b?.team ?? null, born: this.t, box: true });
      this.emit("box", { x, y });
      return true;
    }
    // 아이템은 불에 타 사라짐 (이번 틱에 상자에서 나온 건 빼고)
    if (this.items.has(i) && !(this.flames.get(i)?.box && this.flames.get(i)?.born === this.t)) { this.items.delete(i); this.emit("itemBurn", { x, y }); }
    const nb = this.bombAtAny(x, y);
    if (nb && nb !== b) { nb.at = Math.min(nb.at, this.t); nb.chained = true; nb.hidden = false; if (opt.chain) nb.range += 1; }
    const prev = this.flames.get(i);
    this.flames.set(i, { until: Math.max(prev?.until || 0, this.t + dur), owner: owner ?? prev?.owner ?? null, team: b?.team ?? prev?.team ?? null, born: this.t });
    if (opt.ice && b) this.zones.push({ x, y, until: this.t + 3, team: b.team, kind: "ice" });
    return false;
  }
  hit(p, f) {
    if (p.inv > this.t) return;
    if (this.teamMode && f.team !== null && f.team === p.team && f.owner !== p.id) return; // 팀원 불길은 안 아픔
    const enemy = f.owner && f.owner !== p.id;
    if (p.shield > 0) { p.shield--; p.inv = this.t + 1; this.emit("shield", { uid: p.id }); return; }
    if (this.has(p, "emergencyDodge") && this.ready(p, "emergencyDodge")) { const c = this.safestNear(p, 2); if (c) { this.cool(p, "emergencyDodge"); const fx = p.x, fy = p.y; p.x = c[0]; p.y = c[1]; p.inv = this.t + 0.5; this.emit("aug", { uid: p.id, id: "emergencyDodge", fx, fy, tx: c[0], ty: c[1], auto: true }); return; } }
    if (this.has(p, "absorb") && this.ready(p, "absorb")) { this.cool(p, "absorb"); p.inv = this.t + 1; this.emit("aug", { uid: p.id, id: "absorb", auto: true, x: p.x, y: p.y }); return; }
    if (enemy && this.has(p, "reflect") && this.ready(p, "reflect")) { this.cool(p, "reflect"); p.inv = this.t + 1; this.emit("aug", { uid: p.id, id: "reflect", auto: true, x: p.x, y: p.y }); this.blast(Math.round(p.x), Math.round(p.y), 2, { owner: p.id, team: p.team }, p, {}); return; }
    if (this.has(p, "lastStand") && !p.lastStandUsed) { p.lastStandUsed = true; this.cool(p, "lastStand"); const c = this.safestNear(p, 6) || [Math.round(p.x), Math.round(p.y)]; const fx = p.x, fy = p.y; p.x = c[0]; p.y = c[1]; p.inv = this.t + 1.5; this.emit("aug", { uid: p.id, id: "lastStand", auto: true, fx, fy, tx: c[0], ty: c[1] }); return; }
    this.kill(p, f.owner === p.id ? (this.trapper(p) || p.id) : f.owner, f.owner === p.id && this.trapper(p) ? "trap" : undefined);
  }
  /** 내 폭탄에 맞았지만 직전에 상대가 옆에 폭탄을 놓아 가뒀으면 그 상대 */
  trapper(p) {
    const px = Math.round(p.x), py = Math.round(p.y);
    const mine = this.recent.filter(r => r.owner === p.id && this.t - r.born < 4).sort((a, b) => b.born - a.born)[0];
    const since = mine ? mine.born - 0.3 : this.t - 3;
    const foe = this.recent.filter(r => r.owner !== p.id && r.team !== p.team && r.born >= since && this.t - r.born < 4 && Math.abs(r.x - px) + Math.abs(r.y - py) <= 3).sort((a, b) => b.born - a.born)[0];
    return foe && this.players.has(foe.owner) ? foe.owner : null;
  }
  kill(p, by, how) {
    p.alive = false; p.stats.deathAt = this.t; p.stats.killer = by;
    const k = by && by !== p.id ? this.players.get(by) : null;
    if (k && k.team !== p.team) k.stats.kills++;
    this.emit("death", { uid: p.id, by: by || null, x: p.x, y: p.y, ...(how ? { how } : {}) });
    // 떨어뜨린 능력 일부를 판에 흩뿌림
    const drop = []; if (p.maxBombs > 1) drop.push("bomb"); if (p.range > 2) drop.push("fire"); if (p.kick) drop.push("kick");
    for (const it of drop) { const c = this.randomFree(); if (c) this.items.set(idx(c[0], c[1]), it); }
  }
  giveItem(p, it) {
    p.stats.items++;
    if (it === "bomb") p.maxBombs = Math.min(9, p.maxBombs + 1);
    else if (it === "fire") p.range = Math.min(10, p.range + 1);
    else if (it === "speed") p.speed = Math.min(MAX_SPEED, p.speed + SPEED_STEP);
    else if (it === "kick") p.kick = true;
    else if (it === "glove") p.glove = true;
    else if (it === "shield") p.shield = Math.min(2, p.shield + 1);
    else if (it === "dash") p.dash = Math.min(3, p.dash + 2);
    else if (it === "special") { p.special = SPECIAL_KINDS[Math.floor(this.rng() * SPECIAL_KINDS.length)]; p.specialN = 3; }
  }
  rollItem() { const r = this.rng(); return r < 0.24 ? "bomb" : r < 0.48 ? "fire" : r < 0.64 ? "speed" : r < 0.72 ? "kick" : r < 0.79 ? "glove" : r < 0.86 ? "shield" : r < 0.93 ? "dash" : "special"; }
  suddenDeath() {
    if (this.t < SD_AT) return;
    if (!this.sdStarted) { this.sdStarted = true; this.emit("sudden"); }
    while (this.t >= this.sdNext && this.sdIdx < this.sdOrder.length) {
      const [x, y] = this.sdOrder[this.sdIdx];
      const i = idx(x, y);
      // 1초 전에 경고 (다음 칸들)
      this.sdIdx++; this.sdNext += 0.28;
      for (let k = this.sdIdx; k < Math.min(this.sdOrder.length, this.sdIdx + 4); k++) this.sdWarnIdx = k;
      if (this.tiles[i] === T_WALL) continue;
      this.tiles[i] = T_WALL; this.tilesVer++; this.items.delete(i); this.flames.delete(i);
      const b = this.bombAtAny(x, y); if (b) this.bombs.splice(this.bombs.indexOf(b), 1);
      for (const p of this.players.values()) if (p.alive && Math.round(p.x) === x && Math.round(p.y) === y) { p.inv = 0; p.shield = 0; p.lastStandUsed = true; this.kill(p, null); }
      this.emit("wall", { x, y });
    }
  }
  sdWarnList() { if (!this.sdStarted) return []; return this.sdOrder.slice(this.sdIdx, this.sdIdx + 4).map(([x, y]) => idx(x, y)); }
  checkEnd() {
    if (this.phase !== "play") return;
    const alive = [...this.players.values()].filter(p => p.alive);
    const teams = new Set(alive.map(p => p.team));
    const over = teams.size <= 1 || this.t >= MATCH_SEC;
    if (!over) { this.endAt = 0; return; }
    if (!this.endAt) { this.endAt = this.t + 0.6; return; } // 동시 탈락을 기다림
    if (this.t < this.endAt) return;
    this.finish();
  }
  finish() {
    const alive = [...this.players.values()].filter(p => p.alive);
    const teams = [...new Set(alive.map(p => p.team))];
    let winner = teams.length === 1 ? teams[0] : null;
    if (teams.length > 1) { // 시간 끝: 킬 많은 팀
      const score = (t) => [...this.players.values()].filter(p => p.team === t).reduce((s, p) => s + p.stats.kills * 10 + (p.alive ? 5 : 0), 0);
      const ranked = teams.sort((a, b) => score(b) - score(a)); winner = score(ranked[0]) > score(ranked[1]) ? ranked[0] : null;
    }
    this.phase = "over";
    const rows = [...this.players.values()].map(p => ({ id: p.id, name: p.name, team: p.team, color: p.color, alive: p.alive, kills: p.stats.kills, boxes: p.stats.boxes, items: p.stats.items, survive: Math.round((p.stats.deathAt ?? this.t) * 10) / 10, augs: p.augs.map(a => a.id), augUses: p.stats.augUses, killer: p.stats.killer }));
    rows.sort((a, b) => (b.team === winner) - (a.team === winner) || b.alive - a.alive || b.survive - a.survive || b.kills - a.kills);
    this.result = { winner, draw: winner === null, rows, time: Math.round(this.t) };
    this.emit("over", { winner, draw: winner === null });
  }

  // ---------------- 도우미 ----------------
  freeNeighbor(x, y) { for (const [dx, dy] of shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]], this.rng)) { const nx = x + dx, ny = y + dy; if (inb(nx, ny) && this.tiles[idx(nx, ny)] === T_FLOOR && !this.bombAtAny(nx, ny)) return [nx, ny]; } return null; }
  // 도착 패드 바로 앞 빈칸 (가던 방향 먼저) — 패드 위에 서지 않아 다시 타지는 일이 없음
  padExit(o, dir) { const order = [dir, 1, 2, 3, 4].filter((d, i, a) => d >= 1 && d <= 4 && a.indexOf(d) === i);
    for (const d of order) { const x = o[0] + DIRS[d][0], y = o[1] + DIRS[d][1]; const v = this.sp[idx(x, y)]; if (inb(x, y) && this.tiles[idx(x, y)] === T_FLOOR && !this.bombAtAny(x, y) && v !== SP.TP_A && v !== SP.TP_B) return [x, y]; }
    return o; }
  nearestFree(x, y) { for (let r = 1; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const nx = x + dx, ny = y + dy; if (inb(nx, ny) && this.tiles[idx(nx, ny)] === T_FLOOR && !this.bombAtAny(nx, ny)) return [nx, ny]; } return null; }
  randomFree() { for (let k = 0; k < 80; k++) { const x = 1 + Math.floor(this.rng() * (W - 2)), y = 1 + Math.floor(this.rng() * (H - 2)); const i = idx(x, y); if (this.tiles[i] === T_FLOOR && !this.items.has(i) && !this.bombAtAny(x, y)) return [x, y]; } return null; }
  otherPad(x, y, v) { for (let i = 0; i < W * H; i++) if (this.sp[i] === v && i !== idx(x, y) && this.tiles[i] === T_FLOOR && !this.bombAtAny(i % W, (i / W) | 0)) return [i % W, (i / W) | 0]; return null; }
  /** 칸이 터지기까지 남은 시간 (불길이면 0, 안전하면 99) */
  dangerMap() {
    const m = new Float32Array(W * H).fill(99);
    for (const i of this.flames.keys()) m[i] = 0;
    // 폭탄은 연쇄까지 대략 계산
    const bs = this.bombs.map(b => ({ b, at: Math.max(0, b.at - this.t) }));
    for (let pass = 0; pass < 3; pass++) for (const o of bs) for (const c of this.blastCells(o.b)) { const j = idx(c[0], c[1]); if (o.at < m[j]) m[j] = o.at; const ob = bs.find(q => q.b.x === c[0] && q.b.y === c[1]); if (ob && ob.at > o.at) ob.at = o.at; }
    for (const w of this.warns) { const j = idx(w.x, w.y); m[j] = Math.min(m[j], Math.max(0, w.at - this.t + (w.kind === "storm" ? 0.9 : 0))); if (w.kind === "vent") for (const c of crossCells(this, w.x, w.y, 2)) m[idx(c[0], c[1])] = Math.min(m[idx(c[0], c[1])], Math.max(0, w.at - this.t)); }
    for (const j of this.sdWarnList()) m[j] = Math.min(m[j], 0.8);
    return m;
  }
  dangerAt(x, y) { if (!this._dm || this._dmT !== this.seq) { this._dm = this.dangerMap(); this._dmT = this.seq; } return this._dm[idx(x, y)]; }
  blastCells(b) {
    if (b.kind === "doom") { const out = []; for (let oy = -4; oy <= 4; oy++) for (let ox = -4; ox <= 4; ox++) if (inb(b.x + ox, b.y + oy)) out.push([b.x + ox, b.y + oy]); return out; }
    const out = crossCells(this, b.x, b.y, b.range, b.kind === "pierce" || b.kind === "nuke");
    if (b.kind === "giant") for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (inb(b.x + ox, b.y + oy)) out.push([b.x + ox, b.y + oy]);
    return out;
  }
  safestNear(p, r) {
    const dm = this.dangerMap(), cx = Math.round(p.x), cy = Math.round(p.y);
    let best = null, bv = -1;
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (!inb(x, y) || this.tiles[idx(x, y)] !== T_FLOOR || this.bombAtAny(x, y) || (x === cx && y === cy)) continue;
      const v = dm[idx(x, y)] * 10 - (Math.abs(x - cx) + Math.abs(y - cy));
      if (v > bv) { bv = v; best = [x, y]; }
    }
    return best && dm[idx(best[0], best[1])] > 1.2 ? best : best;
  }

  // ---------------- 보내기 ----------------
  snapshot(viewer) {
    const me = viewer ? this.players.get(viewer) : null;
    return {
      t: Math.round(this.t * 100) / 100, seq: this.seq, phase: this.phase,
      p: [...this.players.values()].map(p => [p.slot, Math.round(p.x * 100), Math.round(p.y * 100), p.dir, (p.alive ? 1 : 0) | (p.moving ? 2 : 0) | (p.inv > this.t ? 4 : 0) | (p.ghost > this.t ? 8 : 0) | (p.shield > 0 ? 16 : 0) | (p.slow > this.t ? 32 : 0) | (p.boost > this.t ? 64 : 0)]),
      b: this.bombs.filter(b => !b.hidden || b.owner === viewer || (me && b.team === me.team && this.teamMode)).map(b => [b.id, Math.round(b.fx * 100), Math.round(b.fy * 100), b.kind, Math.max(0, Math.round((b.at - this.t) * 10)), this.players.get(b.owner)?.slot ?? -1, b.frozen > this.t ? 1 : 0, b.range]),
      f: [...this.flames.keys()],
      z: this.zones.map(z => idx(z.x, z.y)),
      w: [...this.warns.filter(w => w.kind !== "vent" || true).map(w => idx(w.x, w.y)), ...this.sdWarnList()],
      tv: this.tilesVer,
    };
  }
  tilesStr() { return Array.from(this.tiles).join(""); }
  itemsArr() { return [...this.items.entries()].map(([i, it]) => [i, ITEMS.indexOf(it)]); }
  meState(uid) {
    const p = this.players.get(uid); if (!p) return null;
    return { maxBombs: p.maxBombs, range: p.range, speed: Math.round(p.speed * 10) / 10, kick: p.kick, glove: p.glove, shield: p.shield, dash: p.dash, special: p.special, specialN: p.specialN, alive: p.alive,
      augs: p.augs.map(a => ({ id: a.id, cd: Math.max(0, Math.round((a.cdUntil - this.t) * 10) / 10), used: a.used })), warp: p.warp ? [p.warp.x, p.warp.y] : null, nextGiant: p.nextGiant, nextHole: p.nextHole,
      offer: this.phase === "pick" && !p.picked ? p.offer : null, refresh: p.refresh, sense: this.has(p, "dangerSense"), bombsLeft: p.maxBombs - this.bombs.filter(b => b.owner === uid && !b.free).length };
  }
}

// ---------------- 봇 ----------------
function crossCells(g, x, y, r, pierce = false) {
  const out = [[x, y]];
  for (let d = 1; d <= 4; d++) { const [dx, dy] = DIRS[d]; for (let s = 1; s <= r; s++) { const cx = x + dx * s, cy = y + dy * s; if (!inb(cx, cy)) break; const t = g.tiles[idx(cx, cy)]; if (t === T_WALL) break; out.push([cx, cy]); if (t === T_BOX && !pierce) break; } }
  return out;
}
function botPick(offer, rng) {
  const ord = { common: 0, rare: 1, epic: 2, legendary: 3 };
  const like = { bombExpert: 2, firePower: 2, swift: 1.5, kicker: 1, barrier: 2, emergencyDodge: 1.5, lastStand: 3, immortalShield: 2, flameLord: 2, teleport: 1.5, absorb: 2 };
  return [...offer].sort((a, b) => (ord[AUG[b].rarity] + (like[b] || 0) + rng()) - (ord[AUG[a].rarity] + (like[a] || 0) + rng()))[0];
}
function bfs(g, p, sx, sy, dm, okCell, maxD = 30) {
  // 걸어서 갈 수 있는 칸 (불길이 오기 전에 도착할 수 있는지 시간 고려)
  const sp = g.speedOf(p), prev = new Int16Array(W * H).fill(-1), dist = new Int16Array(W * H).fill(-1);
  const q = [idx(sx, sy)]; dist[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const c = q[h], x = c % W, y = (c / W) | 0, d = dist[c];
    if (okCell(x, y, d) && d > 0) { const path = []; let k = c; while (k !== q[0]) { path.push(k); k = prev[k]; } return { cell: c, path: path.reverse(), d }; }
    if (d >= maxD) continue;
    for (let dd = 1; dd <= 4; dd++) {
      const nx = x + DIRS[dd][0], ny = y + DIRS[dd][1]; if (!inb(nx, ny)) continue;
      const n = idx(nx, ny); if (dist[n] >= 0) continue;
      if (g.solidFor(p, nx, ny)) continue;
      if (g.sp[n] === SP.TP_A || g.sp[n] === SP.TP_B) continue; // 봇은 순간이동 패드를 밟지 않음
      const arrive = (d + 1) / sp;
      if (dm[n] < arrive + 0.35 && dm[n] > arrive - 0.6) continue; // 그때 불길이면 못 감
      if (dm[n] === 0) continue;
      dist[n] = d + 1; prev[n] = c; q.push(n);
    }
  }
  return null;
}
function botThink(g, p) {
  const B = p.bot;
  if (g.t < B.next) { followPath(g, p); return; }
  B.next = g.t + 0.12 + g.rng() * 0.08;
  const cx = Math.round(p.x), cy = Math.round(p.y), dm = g.dangerMap();
  const here = dm[idx(cx, cy)];
  // 1) 위험하면 피하기
  if (here < 99) {
    const r = bfs(g, p, cx, cy, dm, (x, y) => dm[idx(x, y)] >= 99 && g.tiles[idx(x, y)] === T_FLOOR);
    if (r) { B.path = r.path; followPath(g, p); return; }
    // 피할 곳이 없으면 증강·대시
    for (const id of ["immortalShield", "teleport", "spaceWarp", "fateSwap"]) if (g.has(p, id) && g.ready(p, id) && (id !== "spaceWarp" || p.warp)) { if (g.action(p.id, id).ok) return; }
    if (p.dash > 0) g.action(p.id, "dash");
    B.path = null; p.mv = 0; return;
  }
  // 2) 공격 증강 가끔
  if (g.mode === "augment" && g.rng() < 0.08) {
    const foeNear = [...g.players.values()].some(q => q.alive && q.team !== p.team && Math.abs(q.x - p.x) + Math.abs(q.y - p.y) <= 5);
    for (const a of p.augs) { const d = AUG[a.id]; if (d.kind !== "active" || a.cdUntil > g.t) continue;
      if (["bombStorm", "fateSwap", "blackHole", "giantBomb", "tripleBomb"].includes(a.id) && foeNear) { g.action(p.id, a.id); break; }
      if (a.id === "trapMaster" && g.rng() < 0.3) { g.action(p.id, a.id); break; }
      if (["remote", "detonate"].includes(a.id) && g.bombs.some(b => b.owner === p.id && g.t - b.born > 1.2)) {
        // 내 폭탄 폭발 범위 밖에 있을 때만 기폭
        const mineCells = g.bombs.filter(b => b.owner === p.id).flatMap(b => g.blastCells(b));
        if (!mineCells.some(c => c[0] === cx && c[1] === cy)) { g.action(p.id, a.id); break; }
      }
    }
  }
  // 3) 폭탄 놓기: 옆에 상자나 상대가 사정거리 안이고, 놓은 뒤 도망칠 곳이 있으면
  const foes = [...g.players.values()].filter(q => q.alive && q.team !== p.team);
  const cells = crossCells(g, cx, cy, p.range);
  const boxNear = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inb(cx + dx, cy + dy) && g.tiles[idx(cx + dx, cy + dy)] === T_BOX);
  const foeInLine = foes.some(q => cells.some(c => c[0] === Math.round(q.x) && c[1] === Math.round(q.y)));
  const canPlace = !g.bombAtAny(cx, cy) && g.bombs.filter(b => b.owner === p.id && !b.free).length < p.maxBombs;
  if (canPlace && (boxNear || foeInLine) && g.rng() < (foeInLine ? 0.9 : 0.55)) {
    // 놓았다고 치고 도망길 확인
    const fake = { id: -1, x: cx, y: cy, range: p.range + (p.nextGiant ? 3 : 0), kind: p.nextGiant ? "giant" : p.special && p.specialN > 0 ? p.special : "normal", at: g.t + (g.has(p, "fastFuse") ? 1.3 : g.has(p, "remote") ? 1.6 : FUSE) };
    if (fake.kind === "mine") fake.kind = "normal";
    const dm2 = dm.slice(); for (const c of g.blastCells(fake)) { const j = idx(c[0], c[1]); dm2[j] = Math.min(dm2[j], fake.at - g.t); }
    const esc = bfs(g, p, cx, cy, dm2, (x, y) => dm2[idx(x, y)] >= 99 && g.tiles[idx(x, y)] === T_FLOOR, 8);
    if (esc && esc.d <= Math.max(2, Math.floor(g.speedOf(p) * (fake.at - g.t) * 0.65))) { if (g.placeBomb(p.id).ok) { B.path = esc.path; followPath(g, p); return; } }
  }
  // 4) 목표: 아이템 > 상대 쪽 상자 > 상대
  if (!B.path || !B.path.length || g.rng() < 0.15) {
    let r = bfs(g, p, cx, cy, dm, (x, y) => g.items.has(idx(x, y)), 12);
    if (!r) r = bfs(g, p, cx, cy, dm, (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inb(x + dx, y + dy) && g.tiles[idx(x + dx, y + dy)] === T_BOX) && dm[idx(x, y)] >= 99, 14);
    if (!r && foes.length) { const f = foes[0]; r = bfs(g, p, cx, cy, dm, (x, y) => Math.abs(x - Math.round(f.x)) + Math.abs(y - Math.round(f.y)) <= 2 && dm[idx(x, y)] >= 99, 30); }
    B.path = r ? r.path : null;
  }
  followPath(g, p);
}
function followPath(g, p) {
  const B = p.bot;
  if (!B.path || !B.path.length) { p.mv = 0; return; }
  const n = B.path[0], tx = n % W, ty = (n / W) | 0;
  const dx = tx - p.x, dy = ty - p.y;
  if (Math.abs(dx) < 0.08 && Math.abs(dy) < 0.08) { B.path.shift(); if (!B.path.length) { p.mv = 0; p.x = tx; p.y = ty; } return followPath(g, p); }
  if (g.solidFor(p, tx, ty) && !(Math.round(p.x) === tx && Math.round(p.y) === ty)) { B.path = null; p.mv = 0; return; }
  // 가려는 칸이 곧 터지면 멈춰서 다시 생각 (지금 칸이 안전할 때만)
  const cx = Math.round(p.x), cy = Math.round(p.y);
  if (!(tx === cx && ty === cy)) { const dn = g.dangerAt(tx, ty), dh = g.dangerAt(cx, cy); if (dh >= 99 && dn < 99 && dn < 1.4 + B.path.length / g.speedOf(p)) { B.path = null; p.mv = 0; B.next = Math.min(B.next, g.t + 0.05); return; } }
  p.mv = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 4) : (dy > 0 ? 3 : 1);
}
function spiral() {
  const out = []; let x0 = 1, y0 = 1, x1 = W - 2, y1 = H - 2;
  while (x0 <= x1 && y0 <= y1 && (x1 - x0 > 2 || y1 - y0 > 2)) {
    for (let x = x0; x <= x1; x++) out.push([x, y0]);
    for (let y = y0 + 1; y <= y1; y++) out.push([x1, y]);
    for (let x = x1 - 1; x >= x0; x--) out.push([x, y1]);
    for (let y = y1 - 1; y > y0; y--) out.push([x0, y]);
    x0++; y0++; x1--; y1--;
  }
  return out;
}
function nearSpawn(x, y) { return SPAWNS.some(([sx, sy]) => Math.abs(sx - x) + Math.abs(sy - y) <= 2); }
function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export { idx, DIRS, SPAWNS, crossCells, spiral };
