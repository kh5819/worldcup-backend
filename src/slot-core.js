// =========================
// DUO 증강 슬롯 타워 — 판 엔진 (2026-11-21, 2차 깊이) · 서버만 돌림 (화면은 결과를 받아 애니메이션만)
// · 사람마다 SlotGame 하나. 난수는 씨앗 고정(mulberry) → 같은 방·같은 날(오늘의 도전)은 같은 씨앗으로 시작
// · 흐름: spin(층마다 정해진 횟수, 아이템 사용) → 층 끝(금고 이자·이자·통행료) → shop(증강·레벨업·아이템·그림 강화·방송 거래·금고) → next … 통행료 못 내면 over
// · 2차: 행운(비싼 그림 확률↑) · 해골 저주(화면에 3개 이상이면 그 스핀 0 + 코인 10%) · 방송 거래 · 금고 · 소모품 · 증강 2단계 · 시너지 10 · 그림 강화 · 기여(효자 증강) 기록
// =========================
import { ROWS, COLS, SPINS, START_COINS, MAX_AUGS, FUSE_MAX, BOOM_LOSS, MULT, tollOf, INTEREST, SYMS, SYM_IDS, LINES, EXTRA_LINES, AUGS, AUG, RARITY_PRICE, RARITY_W, FLOOR_EVENT_IDS,
  NO_LEVEL, MAX_LV, skullW, CURSE_LOSS, LUCK_SYMS, VAULT_RATE, MAX_ITEMS, ITEMS, ITEM_IDS, DEALS, DEAL_IDS, SYNERGIES, SYM_UP_MAX, WIN_TIERS } from "./slot-data.js";

function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const FRUIT = new Set(["cherry", "lemon", "melon"]);
const PAY_SYMS = ["cherry", "lemon", "bell", "melon", "star", "gem", "seven"];
const BLOCK = new Set(["bomb", "skull"]);
const VAL_AUG = { cherry: "a01", lemon: "a02", bell: "a03", melon: "a04", star: "a05", gem: "a06", seven: "a07" };

export class SlotGame {
  constructor(seed, o = {}) {
    this.rng = mulberry((seed ^ 0x51a7) >>> 0); this.seed = seed; this.daily = !!o.daily;
    this.floor = 1; this.coins = START_COINS; this.augs = []; this.lv = {}; this.fuse = 0; this.phase = "spin"; this.chain = 0;
    this.shop = null; this.free = null; this.grid = null; this.last = null; this.deals = null; this.dealDone = false;
    this.vault = 0; this.items = []; this.symUp = {}; this.luckPerm = 0; this.mods = {}; this.nextMods = {};
    this.contrib = {}; this.hist = []; this.bestSpin = null;
    this.st = { won: 0, spins: 0, best: 0, jackpots: 0, booms: 0, bought: 0, lines: 0, five: 0, curses: 0, deals: 0, items: 0, allin: 0, vaultMax: 0, luckMax: 0, lv2: 0 };
    this.startFloor();
  }
  has(id) { return this.augs.includes(id); }
  L(id) { return this.has(id) ? this.lv[id] || 1 : 0; }
  syns() { return SYNERGIES.filter(s => s.req.every(r => this.has(r))).map(s => s.id); }
  hasSyn(id) { const s = SYNERGIES.find(x => x.id === id); return !!s && s.req.every(r => this.has(r)); }
  credit(id, v) { if (v > 0 && id) this.contrib[id] = (this.contrib[id] || 0) + Math.round(v); }
  // ---------- 층 ----------
  startFloor() {
    const f = this.floor;
    this.boss = f % 5 === 0;
    this.event = this.boss ? "boss" : f === 1 ? "calm" : FLOOR_EVENT_IDS[Math.floor(this.rng() * FLOOR_EVENT_IDS.length)];
    this.mods = this.nextMods || {}; this.nextMods = {};
    this.spinsMax = Math.max(1, SPINS + this.L("a35") + (this.event === "bonus" ? 2 : 0) + (this.mods.spin || 0));
    this.spinsLeft = this.spinsMax; this.respinUsed = false; this.wardUsed = false; this.floorWon = 0; this.floorLuck = 0; this.skullFree = 0; this.nextX2 = false; this.nextWild = 0; this.tollDisc = 1; this.lastRespun = true;
    this.fuse = Math.min(this.fuseMax() - 1, Math.max(0, this.fuse - 2)); // 폭탄 해체반을 팔아 칸이 줄어도 가득 찬 채로 남지 않게
    this.toll = this.tollNow(); this.phase = "spin";
  }
  tollNow() { return Math.max(1, Math.round(tollOf(this.floor) * (this.event === "tax" ? 1.2 : 1) * Math.max(0.5, 1 - 0.12 * this.L("a29")) * (this.mods.toll || 1) * (this.tollDisc || 1))); }
  fuseMax() { return FUSE_MAX + 3 * this.L("a31"); }
  luck() { return this.luckPerm + this.floorLuck + 2 * this.L("a41") + 3 * this.L("a42") + (this.hasSyn("y8") ? 4 : 0) + (this.has("a50") ? 6 : 0); }
  itemCap() { return MAX_ITEMS + 2 * this.L("a48"); }
  // ---------- 그림 ----------
  weights(col) {
    const w = {}; for (const id of SYM_IDS) w[id] = SYMS[id].w;
    w.wild += 5 * this.L("a09"); w.cherry += 14 * this.L("a10"); w.star += 9 * this.L("a11"); w.gem += 6 * this.L("a12");
    w.lemon = Math.max(4, w.lemon - 22 * this.L("a13")); w.bell = Math.max(4, w.bell - 16 * this.L("a14")); w.bomb = Math.max(1, w.bomb - 3 * this.L("a34"));
    if (this.event === "bombs") w.bomb += 7; if (this.event === "lucky") w.wild += 4; if (this.event === "broken" && col === COLS - 1) w.wild = 0;
    if (this.boss) w.bomb += 2;
    w.skull = skullW(this.floor) * (this.mods.skull || 1) * Math.pow(0.6, this.L("a42"));
    const lk = this.luck(); if (lk > 0) { for (const s of LUCK_SYMS) w[s] *= 1 + 0.09 * lk; w.bomb /= 1 + 0.05 * lk; w.skull /= 1 + 0.05 * lk; }
    if (this.mods.peace) { w.bomb = 0; w.skull = 0; } if (this.skullFree > 0) w.skull = 0;
    return w;
  }
  roll(col) { const w = this.weights(col); let sum = 0; for (const k in w) sum += w[k]; let r = this.rng() * sum; for (const k in w) { r -= w[k]; if (r <= 0) return k; } return "cherry"; }
  baseVal(sym) { return SYMS[sym]?.v || 0; }
  value(sym) {
    if (!PAY_SYMS.includes(sym)) return 0;
    let v = SYMS[sym].v + Math.round(SYMS[sym].v * 0.5 * (this.symUp[sym] || 0));
    v += 4 * this.L("a01") * (sym === "cherry") + 4 * this.L("a02") * (sym === "lemon") + 6 * this.L("a03") * (sym === "bell") + 10 * this.L("a05") * (sym === "star");
    if (sym === "melon") v *= 1 + this.L("a04"); if (sym === "gem") v *= 1 + this.L("a06") + (this.hasSyn("y2") ? 1 : 0); if (sym === "seven") v *= 1 + this.L("a07");
    if (sym === "cherry" && this.hasSyn("y6")) v *= 2;
    if (this.event === "fruit" && FRUIT.has(sym)) v *= 2; if (this.event === "gold") v += 3; v += this.augs.length * 2 * this.L("a39");
    return v;
  }
  same(a, b) { if (a === b) return true; return this.has("a08") && FRUIT.has(a) && FRUIT.has(b); }
  // ---------- 판정 ----------
  lines() { const L = { ...LINES }; if (this.has("a17")) Object.assign(L, EXTRA_LINES); return L; }
  countLine(cells, g) {
    let sym = null, n = 0;
    for (const [r, c] of cells) {
      const s = g[r][c]; if (BLOCK.has(s)) break;
      if (s === "wild") { n++; continue; }
      if (!sym) { sym = s; n++; continue; }
      if (this.same(sym, s)) { if (this.value(s) > this.value(sym)) sym = s; n++; } else break;
    }
    return { n, sym: sym || "seven" };
  }
  /** 해골이 한 줄에 왼쪽부터 3개 이상 → 저주 */
  /** 화면 어디든 해골 3개 이상 → 저주 */
  cursed(g) { const cells = []; for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (g[r][c] === "skull") cells.push([r, c]); return cells.length >= 3 ? cells : null; }
  evaluate(g) {
    const wins = []; const L = this.lines();
    for (const [id, cells] of Object.entries(L)) {
      const dirs = [cells]; if (this.has("a18")) dirs.push(cells.slice().reverse());
      let done5 = false;
      dirs.forEach((cs, di) => {
        if (done5) return; const { n, sym } = this.countLine(cs, g); if (n < 3) return; if (n === 5) done5 = true;
        const val = this.value(sym); let pay = val * MULT[n], base = this.baseVal(sym) * MULT[n];
        this.credit(VAL_AUG[sym] && this.has(VAL_AUG[sym]) ? VAL_AUG[sym] : this.has("a39") ? "a39" : null, pay - base);
        if (id === "mid" && this.has("a15")) { this.credit("a15", pay * this.L("a15")); pay *= 1 + this.L("a15"); }
        if ((id === "v" || id === "up") && this.has("a16")) { this.credit("a16", pay * this.L("a16")); pay *= 1 + this.L("a16"); }
        if (n === 5 && this.has("a20")) { this.credit("a20", pay * this.L("a20")); pay *= 1 + this.L("a20"); }
        if (n === 4 && this.has("a21")) { pay += 15 * this.L("a21"); this.credit("a21", 15 * this.L("a21")); }
        if (this.hasSyn("y3")) pay *= 1.25;
        if (di === 1) this.credit("a18", pay); if (id === "w" || id === "m") this.credit("a17", pay);
        wins.push({ line: id, rev: di === 1 ? 1 : 0, cells: cs.slice(0, n), sym, n, pay: Math.round(pay) });
      });
    }
    if (this.has("a19")) for (let c = 0; c < COLS; c++) { const col = [g[0][c], g[1][c], g[2][c]]; if (col.some(s => BLOCK.has(s))) continue; const base = col.find(s => s !== "wild") || "seven"; if (col.every(s => s === "wild" || this.same(base, s))) { const pay = this.value(base) * 3; this.credit("a19", pay); wins.push({ line: "col" + c, cells: [[0, c], [1, c], [2, c]], sym: base, n: 3, pay }); } }
    return wins;
  }
  // ---------- 돌리기 ----------
  makeGrid() {
    const g = []; for (let r = 0; r < ROWS; r++) { g.push([]); for (let c = 0; c < COLS; c++) g[r].push(this.roll(c)); }
    const wilds = this.L("a37") + (this.nextWild || 0); this.nextWild = 0;
    for (let k = 0; k < wilds; k++) { const r = Math.floor(this.rng() * ROWS), c = Math.floor(this.rng() * COLS); g[r][c] = "wild"; }
    return g;
  }
  /** 그림판 하나를 점수로 (돌리기·릴 다시 돌리기 공용). 상태는 안 바꿈 (기여 기록만) */
  score(g) {
    const wins = this.evaluate(g), fx = []; let base = wins.reduce((s, w) => s + w.pay, 0), mul = 1;
    if (wins.length >= 3 && this.has("a23")) { mul *= 1 + 0.5 * this.L("a23"); fx.push("combo"); }
    if (wins.length && this.has("a22")) { const per = this.hasSyn("y7") ? 0.4 : 0.25 * this.L("a22"); mul *= 1 + per * this.chain; if (this.chain) fx.push("chain"); }
    if (this.spinsLeft === 1 && this.has("a40") && base) { mul *= this.hasSyn("y9") ? 5 : 2 + this.L("a40"); fx.push("final"); }
    if (wins.some(w => w.n === 5) && this.has("a38")) { mul *= this.L("a38") >= 2 ? 8 : 5; fx.push("jackpot"); }
    const flat = g.flat(), first = flat.find(s => s !== "wild"); if (first && !BLOCK.has(first) && flat.every(s => s === "wild" || this.same(first, s))) { mul *= 5; fx.push("fullscreen"); }
    if (this.mods.win) mul *= this.mods.win;
    if (this.nextX2) { mul *= 2; fx.push("x2"); }
    return { wins, base, mul, fx, gain: Math.round(base * mul) };
  }
  spin() {
    if (this.phase !== "spin") return { ok: false, error: "NOT_SPIN" };
    let g = this.makeGrid(), sc = this.score(g), respun = null;
    if (!sc.wins.length && this.has("a36") && !this.respinUsed) { this.respinUsed = true; respun = g; g = this.makeGrid(); sc = this.score(g); this.credit("a36", sc.gain); }
    let { wins, base, mul, fx, gain } = sc, extra = 0; this.nextX2 = false;
    // 배수 기여 (늘어난 만큼을 그 증강에게)
    if (fx.includes("jackpot")) this.credit("a38", gain - gain / (this.L("a38") >= 2 ? 8 : 5)); if (fx.includes("final")) this.credit("a40", gain * 2 / 3); if (fx.includes("chain")) this.credit("a22", gain * 0.2); if (fx.includes("combo")) this.credit("a23", gain / 3);
    const flat = g.flat();
    // 저주
    let curse = null; const cc = this.cursed(g);
    if (cc) {
      if (this.has("a50")) { fx.push("immune"); }
      else if (this.has("a43") && !this.wardUsed) { this.wardUsed = true; fx.push("ward"); }
      else if (this.hasSyn("y10")) { extra += 40; fx.push("priest"); }
      else { const lost = Math.max(5, Math.floor(this.coins * CURSE_LOSS)); curse = { cells: cc, lost: Math.min(this.coins, lost), cancelled: gain }; gain = 0; wins = []; this.st.curses++; }
    }
    if (curse) this.coins -= curse.lost;
    this.chain = wins.length ? this.chain + 1 : 0;
    if (!wins.length && this.has("a25")) { extra += 8 * this.L("a25"); this.credit("a25", 8 * this.L("a25")); fx.push("insure"); }
    if (this.has("a26") && this.rng() < 0.25 * this.L("a26")) { extra += 15; this.credit("a26", 15); fx.push("penny"); }
    const skulls = flat.filter(s => s === "skull").length, wildN = flat.filter(s => s === "wild").length;
    if (skulls && this.has("a44")) { extra += skulls * 12 * this.L("a44"); this.credit("a44", skulls * 12 * this.L("a44")); fx.push("skullc"); }
    if (wildN && this.hasSyn("y1")) { extra += wildN * 5; fx.push("storm"); }
    if (wins.length && this.has("a46")) { this.floorLuck += this.L("a46"); fx.push("luckup"); }
    if (this.skullFree > 0) this.skullFree--;
    // 폭탄
    const bombs = flat.filter(s => s === "bomb").length; let boom = null;
    if (bombs) { if (this.has("a32")) { extra += bombs * 10 * this.L("a32"); this.credit("a32", bombs * 10 * this.L("a32")); fx.push("collector"); } this.fuse += bombs; }
    this.coins += gain + extra; this.floorWon += gain + extra; this.st.won += gain + extra; this.st.spins++; this.st.lines += wins.length;
    if (fx.includes("jackpot") || fx.includes("fullscreen")) this.st.jackpots++; if (wins.some(w => w.n === 5)) this.st.five++;
    if (gain + extra > this.st.best) { this.st.best = gain + extra; this.bestSpin = { grid: g, wins, gain: gain + extra, floor: this.floor, fx }; }
    if (this.fuse >= this.fuseMax()) { this.fuse = 0; this.st.booms++; if (this.has("a33")) { const b = this.floor * (this.hasSyn("y4") ? 40 : 20) * this.L("a33"); this.coins += b; this.credit("a33", b); boom = { gain: b }; } else { const lost = Math.floor(this.coins * BOOM_LOSS); this.coins -= lost; boom = { lost }; } }
    this.st.luckMax = Math.max(this.st.luckMax, this.luck());
    this.spinsLeft--; this.grid = g; this.lastRespun = false;
    const tier = this.tierOf(gain + extra);
    const out = { ok: true, grid: g, respun, wins, base, mul: +mul.toFixed(2), gain, extra, fx, bombs, skulls, curse, boom, tier, fuse: this.fuse, coins: this.coins, spinsLeft: this.spinsLeft };
    if (this.spinsLeft <= 0) out.end = this.floorEnd();
    this.last = out; return out;
  }
  tierOf(v) { let t = -1; WIN_TIERS.forEach((x, i) => { if (v >= Math.max(20, this.toll * x.at)) t = i; }); return t; }
  floorEnd() {
    let per = INTEREST.per, cap = INTEREST.cap; if (this.has("a24")) { per = 8; cap += 5 * this.L("a24"); } if (this.hasSyn("y5")) cap *= 2;
    const interest = Math.min(cap, Math.floor(this.coins / per)), comp = this.has("a30") ? Math.floor(this.coins * 0.1 * this.L("a30")) : 0;
    const vaultGain = this.vault ? Math.floor(this.vault * (VAULT_RATE + 0.1 * this.L("a45"))) : 0; this.vault += vaultGain; this.st.vaultMax = Math.max(this.st.vaultMax, this.vault);
    if (comp) this.credit("a30", comp); if (interest && this.has("a24")) this.credit("a24", interest); if (vaultGain && this.has("a45")) this.credit("a45", Math.floor(this.vault * 0.1 * this.L("a45")));
    this.coins += interest + comp; const toll = this.toll, ok = this.coins >= toll;
    const res = { floor: this.floor, interest, comp, vaultGain, vault: this.vault, toll, ok, won: this.floorWon };
    this.hist.push({ f: this.floor, won: this.floorWon, coins: this.coins, toll, vault: this.vault });
    if (!ok) { this.phase = "over"; res.coins = this.coins; return res; }
    this.coins -= toll; res.coins = this.coins; this.phase = "shop"; this.rerolls = 0; this.freeRerolls = this.L("a28"); this.freeItems = this.L("a49"); this.noReroll = false; this.freeCard = false; this.dealDone = false;
    this.shop = this.makeShop(); this.deals = this.makeDeals(); if (this.boss) { this.free = this.legendChoices(); res.free = this.free; }
    return res;
  }
  // ---------- 상점 ----------
  priceOf(id) { const r = AUG[id].r; return Math.round(RARITY_PRICE[r] * (1 + (this.floor - 1) * 0.12) * Math.max(0.5, 1 - 0.25 * this.L("a27")) * (this.has(id) ? 1.2 : 1)); }
  canLevel(id) { return this.has(id) && !NO_LEVEL.has(id) && (this.lv[id] || 1) < MAX_LV; }
  pickAug(exclude = []) {
    const pool = AUGS.filter(a => !exclude.includes(a.id) && (!this.has(a.id) || this.canLevel(a.id))); if (!pool.length) return null;
    const w = (a) => RARITY_W[a.r] * (a.r !== "common" ? 1 + this.floor * 0.06 : 1) * (this.has(a.id) ? 0.6 : 1);
    let sum = 0; for (const a of pool) sum += w(a); let r = this.rng() * sum; for (const a of pool) { r -= w(a); if (r <= 0) return a.id; } return pool[0].id;
  }
  makeShop() {
    const ids = []; for (let i = 0; i < 3; i++) { const id = this.pickAug(ids); if (id) ids.push(id); }
    const cards = ids.map(id => ({ k: "aug", id, price: this.priceOf(id), lvUp: this.has(id), sold: false }));
    const it = ITEM_IDS[Math.floor(this.rng() * ITEM_IDS.length)]; cards.push({ k: "item", id: it, price: this.freeItems > 0 ? 0 : Math.round(ITEMS[it].p * (1 + this.floor * 0.08)), sold: false });
    const ups = Object.keys(SYMS).filter(s => ["cherry", "lemon", "bell", "melon", "star", "gem", "seven"].includes(s) && (this.symUp[s] || 0) < SYM_UP_MAX);
    if (ups.length) { const s = ups[Math.floor(this.rng() * ups.length)]; cards.push({ k: "sym", id: s, price: Math.round(10 * (1 + this.floor * 0.1) * (1 + (this.symUp[s] || 0))), sold: false }); }
    return cards;
  }
  makeDeals() {
    const pool = DEAL_IDS.filter(d => (d !== "d4" || this.augs.length) && (d !== "d9" || this.vault > 0)), out = [], n = 2 + (this.has("a47") ? 1 : 0);
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(this.rng() * pool.length), 1)[0]);
    return out;
  }
  legendChoices(pool0) { const pool = (pool0 || AUGS.filter(a => a.r === "legend" && !this.has(a.id))).map(a => a.id || a); const out = []; while (out.length < 2 && pool.length) out.push(pool.splice(Math.floor(this.rng() * pool.length), 1)[0]); return out.length ? out : null; }
  rerollCost() { return this.freeRerolls > 0 ? 0 : 2 + this.rerolls; }
  addAug(id) { if (this.has(id)) { this.lv[id] = Math.min(MAX_LV, (this.lv[id] || 1) + 1); if (this.lv[id] >= 2) this.st.lv2 = Object.values(this.lv).filter(v => v >= 2).length; } else { this.augs.push(id); this.lv[id] = 1; } }
  addItem(id) { if (this.items.length >= this.itemCap()) return false; this.items.push(id); return true; }
  buy(i) {
    if (this.phase !== "shop") return { ok: false, error: "NOT_SHOP" };
    const c = this.shop?.[i | 0]; if (!c || c.sold) return { ok: false, error: "BAD_CARD" };
    const price = this.freeCard ? 0 : c.price;
    if (c.k === "aug" && !this.has(c.id) && this.augs.length >= MAX_AUGS) return { ok: false, error: "FULL" };
    if (c.k === "aug" && this.has(c.id) && !this.canLevel(c.id)) return { ok: false, error: "BAD_CARD" };
    if (c.k === "item" && this.items.length >= this.itemCap()) return { ok: false, error: "BAG_FULL" };
    if (this.coins < price) return { ok: false, error: "NO_COINS" };
    this.coins -= price; c.sold = true; if (this.freeCard && c.k !== "item") this.freeCard = false;
    if (c.k === "aug") { this.addAug(c.id); this.st.bought++; } else if (c.k === "item") { this.addItem(c.id); if (c.price === 0 && this.freeItems > 0) this.freeItems--; } else { this.symUp[c.id] = (this.symUp[c.id] || 0) + 1; }
    return { ok: true };
  }
  sell(id) { if (this.phase !== "shop") return { ok: false, error: "NOT_SHOP" }; const i = this.augs.indexOf(String(id)); if (i < 0) return { ok: false, error: "BAD_CARD" };
    if (id === "a48" && this.items.length > this.itemCap() - 2 * this.L("a48")) return { ok: false, error: "ITEMS_FIRST" }; /* 큰 가방을 팔면 넘치는 아이템이 생김 → 먼저 써야 함 */
    const lv = this.lv[id] || 1; this.augs.splice(i, 1); delete this.lv[id]; this.coins += Math.floor(this.priceOf(id) / 2 * lv); this.fuse = Math.min(this.fuse, this.fuseMax() - 1); return { ok: true }; }
  reroll() { if (this.phase !== "shop") return { ok: false, error: "NOT_SHOP" }; if (this.noReroll) return { ok: false, error: "NO_REROLL" }; const cost = this.rerollCost(); if (this.coins < cost) return { ok: false, error: "NO_COINS" }; this.coins -= cost; if (this.freeRerolls > 0) this.freeRerolls--; else this.rerolls++; this.shop = this.makeShop(); return { ok: true }; }
  pickFree(id) { if (this.phase !== "shop" || !this.free?.includes(id)) return { ok: false, error: "BAD_CARD" }; if (!this.has(id) && this.augs.length >= MAX_AUGS) return { ok: false, error: "FULL" }; this.addAug(id); this.free = null; return { ok: true }; }
  skipFree() { this.free = null; return { ok: true }; }
  // ---------- 방송 거래 ----------
  deal(id) {
    if (this.phase !== "shop" || this.dealDone || !this.deals?.includes(id)) return { ok: false, error: "BAD_DEAL" };
    const f = this.floor, nm = this.nextMods; let note = null;
    switch (id) {
      case "d1": this.coins += f * 25; nm.toll = (nm.toll || 1) * 1.4; break;
      case "d2": this.coins += f * 15; this.fuse = Math.min(this.fuseMax() - 1, this.fuse + 4); break;
      case "d3": this.luckPerm += 2; nm.toll = (nm.toll || 1) * 1.2; break;
      case "d4": { const lost = this.augs[Math.floor(this.rng() * this.augs.length)]; this.augs.splice(this.augs.indexOf(lost), 1); delete this.lv[lost]; this.free = this.legendChoices(AUGS.filter(a => (a.r === "epic" || a.r === "legend") && !this.has(a.id))); note = lost; break; }
      case "d5": nm.skull = (nm.skull || 1) * 2; nm.win = (nm.win || 1) * 1.5; break;
      case "d6": { const win = this.rng() < 0.5; if (win) { this.coins *= 2; this.st.allin++; } else this.coins = Math.floor(this.coins * 0.6); note = win ? "win" : "lose"; break; }
      case "d7": this.freeCard = true; nm.spin = (nm.spin || 0) - 1; break;
      case "d8": this.coins += f * 20; nm.spin = (nm.spin || 0) - 1; break;
      case "d9": this.vault = Math.floor(this.vault * 1.5); this.noReroll = true; break;
      case "d10": { const s = ["cherry", "lemon", "bell", "melon", "star", "gem", "seven"][Math.floor(this.rng() * 7)]; this.symUp[s] = (this.symUp[s] || 0) + 4 / Math.max(1, SYMS[s].v * 0.5); note = s; break; }
      case "d11": { for (let k = 0; k < 2; k++) this.addItem(ITEM_IDS[Math.floor(this.rng() * ITEM_IDS.length)]); nm.toll = (nm.toll || 1) * 1.15; break; }
      case "d12": nm.peace = true; nm.win = (nm.win || 1) * 0.8; break;
    }
    this.dealDone = true; this.st.deals++; this.st.vaultMax = Math.max(this.st.vaultMax, this.vault);
    return { ok: true, note };
  }
  // ---------- 금고 ----------
  deposit(n) { if (this.phase !== "shop") return { ok: false, error: "NOT_SHOP" }; n = Math.floor(Number(n)); if (!(n >= 1) || n > this.coins) return { ok: false, error: "BAD_VALUE" }; this.coins -= n; this.vault += n; this.st.vaultMax = Math.max(this.st.vaultMax, this.vault); return { ok: true }; }
  withdraw(n) { if (this.phase !== "shop") return { ok: false, error: "NOT_SHOP" }; n = Math.floor(Number(n)); if (!(n >= 1) || n > this.vault) return { ok: false, error: "BAD_VALUE" }; this.vault -= n; this.coins += n; return { ok: true }; }
  // ---------- 아이템 ----------
  useItem(i) {
    if (this.phase !== "spin") return { ok: false, error: "NOT_SPIN" };
    const id = this.items[i | 0]; if (!id) return { ok: false, error: "BAD_CARD" };
    let res = { ok: true, id };
    switch (id) {
      case "i1": if (this.nextX2) return { ok: false, error: "ALREADY" }; this.nextX2 = true; break;
      case "i2": this.fuse = 0; break;
      case "i3": this.floorLuck += 4; break;
      case "i4": this.nextWild = (this.nextWild || 0) + 3; break;
      case "i5": this.spinsLeft++; this.spinsMax++; break;
      case "i6": this.skullFree = 3; break;
      case "i7": if (this.tollDisc < 1) return { ok: false, error: "ALREADY" }; this.tollDisc = 0.75; this.toll = this.tollNow(); break;
      case "i8": this.coins += this.floor * 10; break;
      case "i9": { const r9 = this.respinColumn(); if (!r9) return { ok: false, error: "NO_TARGET" }; res = { ...res, ...r9 }; break; }
    }
    this.items.splice(i | 0, 1); this.st.items++;
    return res;
  }
  /** 방금 결과에서 한 열만 다시 돌려 더 좋아지면 그 차이만큼 코인 (나빠지면 그대로) */
  respinColumn() {
    const L = this.last; if (!L || this.lastRespun || !L.grid || this.spinsLeft === this.spinsMax) return null;
    let best = null;
    for (let c = 0; c < COLS; c++) { const g = L.grid.map(row => row.slice()); for (let r = 0; r < ROWS; r++) g[r][c] = this.roll(c); const s = this.score(g); if (!best || s.gain > best.s.gain) best = { c, g, s }; }
    this.lastRespun = true; const diff = Math.max(0, best.s.gain - (L.curse ? 0 : L.gain)); this.coins += diff; this.floorWon += diff; this.st.won += diff; this.grid = best.g;
    return { col: best.c, grid: best.g, wins: best.s.wins, gain: diff, coins: this.coins };
  }
  next() { if (this.phase !== "shop") return { ok: false, error: "NOT_SHOP" }; this.free = null; this.shop = null; this.deals = null; this.floor++; this.startFloor(); return { ok: true }; }
  /** 랭킹 점수: 도달한 층이 먼저, 같으면 번 코인 */
  rankScore() { return (this.floor - 1) * 100000 + Math.min(99999, this.st.won); }
  /** 판 끝 요약 */
  summary() { const mvp = Object.entries(this.contrib).sort((a, b) => b[1] - a[1]).slice(0, 3); return { hist: this.hist, best: this.bestSpin, mvp, syns: this.syns(), luck: this.st.luckMax }; }
  pub() {
    return { floor: this.floor, coins: this.coins, augs: this.augs, lv: this.lv, fuse: this.fuse, fuseMax: this.fuseMax(), phase: this.phase, spinsLeft: this.spinsLeft, spinsMax: this.spinsMax, toll: this.toll, event: this.event, boss: this.boss, chain: this.chain,
      shop: this.phase === "shop" ? this.shop : null, free: this.phase === "shop" ? this.free : null, reroll: this.phase === "shop" ? this.rerollCost() : 0, noReroll: !!this.noReroll, freeCard: !!this.freeCard,
      deals: this.phase === "shop" && !this.dealDone ? this.deals : null, vault: this.vault, items: this.items, itemCap: this.itemCap(), luck: this.luck(), skullW: +this.weights(0).skull.toFixed(1), symUp: this.symUp, syns: this.syns(), mods: this.mods, nextMods: this.nextMods,
      x2: this.nextX2, skullFree: this.skullFree, grid: this.grid, st: this.st, lines: Object.keys(this.lines()), vals: Object.fromEntries(SYM_IDS.map(s => [s, this.value(s)])), daily: this.daily };
  }
}
