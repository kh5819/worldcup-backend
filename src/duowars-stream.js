// =========================================================
// 플듀 대전쟁 — 스트리머 모드 (서버)
// · 후원: 정확한 금액(정수 원)으로만 규칙을 찾음 → 반올림·근사 없음
//   수신 → 금액 검증 → 중복 확인(메모리 + DB 고유키) → 규칙 찾기 → 대기열 → 쿨타임·보스 수·후원 몬스터 수 확인 → 실행 → 모두에게 알림
// · 테스트 후원은 is_test=true 로 실제 후원과 따로 기록
// · 시청자 투표·시청자 지원 유닛·혼돈 이벤트·OBS 오버레이 요약도 여기서 처리
// · 후원 플랫폼이 끊겨도 게임은 그대로 진행 (이 모듈은 게임 진행을 막지 않음)
// =========================================================
import crypto from "crypto";

export const KINDS = ["svs", "raid", "team", "chaos"];
const KIND_NAME = { svs: "시청자 vs 스트리머", raid: "협동 보스 레이드", team: "4vs4 후원 대전", chaos: "혼돈의 전장" };
const STATS = ["atk", "def", "spd", "aspd"];
const EFFECTS = ["buff", "spawn", "boss", "healUnits", "healBase", "damageBase", "energy", "giant", "transform", "knock", "stun", "meteor", "random", "bossRush"];
const TARGETS = ["ally", "enemy", "all"];
const MAX_RULES = 60, MAX_EFFECTS = 4, WAIT_LIMIT_SEC = 90, LOG_KEEP = 200;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const num = (v, a, b, d) => { const n = Number(v); return Number.isFinite(n) ? clamp(n, a, b) : d; };

// 후원자 이름: 위험 문자 제거, 16자까지, 없으면 익명
export function cleanDonor(s) {
  const t = String(s ?? "").normalize("NFC").replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿<>]/g, "").replace(/\s+/g, " ").trim();
  return t ? [...t].slice(0, 16).join("") : "익명 후원자";
}
// 정확한 금액: 정수만, 1원 ~ 1천만 원
export function parseAmount(v) {
  if (typeof v === "string") { if (!/^\s*\d{1,9}\s*$/.test(v)) return null; v = Number(v); }
  if (!Number.isSafeInteger(v) || v <= 0 || v > 10_000_000) return null;
  return v;
}

export function sanitizeRules(rules, data) {
  const out = [];
  for (const r of Array.isArray(rules) ? rules.slice(0, MAX_RULES) : []) {
    const amount = parseAmount(r?.amount); if (!amount) continue;
    const effects = [];
    for (const e of Array.isArray(r.effects) ? r.effects.slice(0, MAX_EFFECTS) : []) {
      if (!EFFECTS.includes(e?.type)) continue;
      const x = { type: e.type, target: TARGETS.includes(e.target) ? e.target : "ally" };
      if (e.type === "buff") { x.stat = STATS.includes(e.stat) ? e.stat : "atk"; x.value = num(e.value, -0.7, 2, 0.3); x.dur = num(e.dur, 1, 120, 20); }
      if (e.type === "spawn") { const u = String(e.unit || "slime"); x.unit = data.units[u] || data.enemies[u] ? u : "slime"; x.count = Math.round(num(e.count, 1, 20, 5)); }
      if (e.type === "boss") { const u = String(e.unit || "kingslime"); x.unit = data.bosses[u] ? u : "kingslime"; }
      if (["healUnits", "healBase", "damageBase"].includes(e.type)) x.value = num(e.value, 0.01, 0.6, 0.2);
      if (e.type === "energy") x.value = Math.round(num(e.value, -1000, 1000, 200));
      if (e.type === "giant") { x.value = num(e.value, 1.1, 1.8, 1.3); x.dur = num(e.dur, 3, 60, 20); }
      if (e.type === "transform") x.count = Math.round(num(e.count, 1, 15, 5));
      if (e.type === "stun") x.dur = num(e.dur, 0.5, 5, 2);
      if (e.type === "meteor") { x.count = Math.round(num(e.count, 1, 8, 3)); x.value = Math.round(num(e.value, 50, 2000, 300)); }
      if (e.type === "bossRush") x.dur = num(e.dur, 5, 30, 30);
      effects.push(x);
    }
    let donor = null;
    if (r.donor && (data.donor?.[r.donor.def] || data.units[r.donor.def] || data.enemies[r.donor.def] || data.bosses[r.donor.def])) donor = { def: r.donor.def, side: r.donor.side === "enemy" ? "enemy" : "ally" };
    if (!effects.length && !donor) continue;
    out.push({ id: r.id && /^[a-z0-9_-]{1,24}$/i.test(r.id) ? r.id : "r" + amount + "_" + out.length, amount, name: String(r.name || "후원 이벤트").slice(0, 24), enabled: r.enabled !== false, cooldown: num(r.cooldown, 0, 600, 0), stack: !!r.stack, combo: !!r.combo, anim: ["portal", "boss", "flash", "none"].includes(r.anim) ? r.anim : "portal", sound: ["fanfare", "boss", "coin", "none"].includes(r.sound) ? r.sound : "fanfare", effects, donor });
  }
  return out;
}
export function sanitizeSettings(s, def) {
  const d = def || {};
  return {
    showDonorNames: s?.showDonorNames !== false,
    donorHpMul: num(s?.donorHpMul, 0.2, 5, d.donorHpMul ?? 1), donorAtkMul: num(s?.donorAtkMul, 0.2, 5, d.donorAtkMul ?? 1), donorScale: num(s?.donorScale, 0.6, 1.6, d.donorScale ?? 1),
    maxDonorMonsters: Math.round(num(s?.maxDonorMonsters, 1, 60, d.maxDonorMonsters ?? 24)), queueMax: Math.round(num(s?.queueMax, 5, 200, d.queueMax ?? 40)),
    execGap: num(s?.execGap, 0.3, 10, d.execGap ?? 1.2), maxBosses: Math.round(num(s?.maxBosses, 1, 6, d.maxBosses ?? 2)),
    cimeBeamKrw: num(s?.cimeBeamKrw, 0.01, 1000, d.cimeBeamKrw ?? 1), overflow: s?.overflow === "skip" ? "skip" : "skip",
    bossLevel: ["easy", "normal", "hard"].includes(s?.bossLevel) ? s.bossLevel : "normal",
    voteEvery: Math.round(num(s?.voteEvery, 0, 300, d.voteEvery ?? 35)), voteDur: Math.round(num(s?.voteDur, 5, 60, d.voteDur ?? 15)),
    viewerUnits: s?.viewerUnits !== false, viewerUnitCd: Math.round(num(s?.viewerUnitCd, 10, 600, d.viewerUnitCd ?? 90)), viewerUnitCap: Math.round(num(s?.viewerUnitCap, 0, 40, d.viewerUnitCap ?? 12)),
    svsTime: Math.round(num(s?.svsTime, 60, 900, 240)), viewOnly: !!s?.viewOnly, donation: s?.donation !== false, viewerJoin: s?.viewerJoin !== false,
  };
}

export function createStream(payload, data) {
  const D = data.streamDefaults;
  const st = {
    kind: KINDS.includes(payload?.kind) ? payload.kind : "svs",
    title: String(payload?.title || "").replace(/[<>\u0000-\u001f]/g, "").slice(0, 40) || "플듀 대전쟁 방송",
    platform: ["chzzk", "cime", "soop", "none"].includes(payload?.platform) ? payload.platform : "none",
    settings: sanitizeSettings(payload?.settings || {}, D.settings),
    rules: sanitizeRules(payload?.rules?.length ? payload.rules : D.rules, data),
    ovKey: crypto.randomBytes(12).toString("hex"),
    queue: [], log: [], seen: new Set(), seq: 0, nextAt: 0, lastFire: {}, donors: new Map(),
    vote: null, nextVoteAt: 0, viewerTeams: new Map(), chatTeams: new Map(), viewerCd: new Map(), timers: [], chaosAt: 0,
    link: { status: "off", platform: null, nickname: null, donation: false, error: null },
  };
  return st;
}

// ---------- 규칙 찾기 (정확히 같은 금액만) ----------
export function matchRules(st, amount) {
  const list = st.rules.filter((r) => r.enabled && r.amount === amount);
  if (!list.length) return [];
  // 같은 금액 여러 규칙은 스트리머가 "복합"으로 표시한 것만 함께 실행, 아니면 첫 규칙만
  return list[0].combo ? list.filter((r, i) => i === 0 || r.combo) : [list[0]];
}

export function attachStream(ctx) {
  const { io, supabaseAdmin, DATA, sr, toAll } = ctx;
  const db = supabaseAdmin;
  const dbOk = { v: !!db };

  const ovRoom = (r) => sr(r.id) + ":ov";
  const pushLog = (r, rec) => { const st = r.stream; if (!rec._logged) { rec._logged = true; st.log.push(rec); if (st.log.length > LOG_KEEP) st.log.shift(); } io.to(sr(r.id)).emit("dw:donLog", logRow(rec)); };
  const logRow = (x) => ({ id: x.id, at: x.at, donor: x.donor, amount: x.amount, test: x.test, platform: x.platform, status: x.status, rule: x.ruleName || null, note: x.note || null });

  async function dbInsert(r, rec) {
    if (!dbOk.v) return true;
    if (rec.test) { if (!/^[0-9a-f-]{36}$/i.test(String(r.hostUserId)) || (r.stream.testDb = (r.stream.testDb || 0) + 1) > 200) { rec.noDb = true; return true; } }
    try {
      const { error } = await db.from("duowars_donations").insert({ room_code: r.code, platform: rec.platform, event_key: rec.key, donor: rec.donor, amount: rec.amount, is_test: rec.test, status: rec.status, host_user_id: /^[0-9a-f-]{36}$/i.test(String(r.hostUserId)) ? r.hostUserId : null, channel_id: rec.channel || null });
      if (error) {
        if (error.code === "23505") return false; // 이미 받은 후원 (중복)
        if (/relation .* does not exist|duowars_donations/.test(error.message || "")) { dbOk.v = false; console.warn("[dw-stream] 후원 기록 표가 없어 메모리에만 기록"); return true; }
        console.warn("[dw-stream] 기록 실패(무시):", error.message);
      }
      return true;
    } catch (e) { console.warn("[dw-stream] 기록 예외(무시):", e.message); return true; }
  }
  function dbStatus(rec) {
    if (!dbOk.v || rec.noDb) return;
    db.from("duowars_donations").update({ status: rec.status, rule_name: rec.ruleName || null, applied_at: rec.status === "applied" ? new Date().toISOString() : null }).eq("event_key", rec.key).then(() => {}, () => {});
  }

  /**
   * 후원 수신 (플랫폼 연동·테스트 공통)
   * ev: { platform, key, donor, amount(정수 원), test, channel }
   */
  async function receive(r, ev) {
    const st = r.stream; if (!st) return { ok: false, error: "NOT_STREAM" };
    const amount = parseAmount(ev.amount);
    const rec = { id: ++st.seq, key: String(ev.key || "").slice(0, 200), at: Date.now(), donor: cleanDonor(ev.donor), amount: amount || 0, test: !!ev.test, platform: ev.platform || "test", channel: ev.channel || null, status: "received" };
    if (!rec.key) rec.key = (rec.test ? "test:" : "x:") + crypto.randomUUID();
    if (!amount) { rec.status = "invalid"; rec.note = "금액이 올바르지 않음"; pushLog(r, rec); return { ok: false, error: "BAD_AMOUNT" }; }
    if (st.seen.has(rec.key)) return { ok: false, error: "DUPLICATE" };
    st.seen.add(rec.key); if (st.seen.size > 5000) st.seen = new Set([...st.seen].slice(-2500));
    if (!(await dbInsert(r, rec))) { rec.status = "duplicate"; pushLog(r, rec); return { ok: false, error: "DUPLICATE" }; }
    // 후원자 기록 (횟수·누적액)
    const dk = rec.donor; const d = st.donors.get(dk) || { name: dk, count: 0, total: 0 }; d.count++; d.total += amount; st.donors.set(dk, d);
    if (!st.settings.donation && !rec.test) { rec.status = "disabled"; rec.note = "후원 연동 꺼짐"; pushLog(r, rec); dbStatus(rec); return { ok: true, status: rec.status }; }
    if (r.status !== "playing" || !r.game) { rec.status = "not_playing"; rec.note = "게임 중이 아니라 적용 안 함"; pushLog(r, rec); dbStatus(rec); return { ok: true, status: rec.status }; }
    const rules = matchRules(st, amount);
    if (!rules.length) { rec.status = "no_match"; rec.note = "등록되지 않은 금액"; pushLog(r, rec); dbStatus(rec); return { ok: true, status: rec.status }; }
    rec.ruleName = rules.map((x) => x.name).join(" + ");
    if (st.queue.length >= st.settings.queueMax) { rec.status = "queue_full"; rec.note = "대기열이 꽉 차서 효과 생략"; pushLog(r, rec); dbStatus(rec); return { ok: true, status: rec.status }; }
    rec.status = "queued"; st.queue.push({ rec, rules, at: r.game.time, gameId: r.gameId }); pushLog(r, rec); dbStatus(rec);
    return { ok: true, status: "queued", queue: st.queue.length };
  }

  const teamName = (t) => (t === 0 ? "블루" : "레드");
  // 이 후원자(시청자)가 응원하는 팀 → "아군"
  function allyTeam(r, donor) {
    const st = r.stream;
    if (st.kind !== "team") return 0;
    const t = st.chatTeams.get(donor);
    return t === 1 ? 1 : 0;
  }
  function teamsFor(r, target, donor) {
    if (target === "all") return [0, 1];
    const a = allyTeam(r, donor);
    return [target === "enemy" ? 1 - a : a];
  }
  const bossCount = (g) => g.units.filter((u) => u.alive && u.boss).length;
  const donorCount = (g) => g.units.filter((u) => u.alive && u.donationId).length;

  // 실행 가능 여부 (쿨타임·보스 수·후원 몬스터 수)
  function blocked(r, item) {
    const st = r.stream, g = r.game;
    for (const rule of item.rules) {
      if (rule.cooldown && st.lastFire[rule.id] && g.time - st.lastFire[rule.id] < rule.cooldown) return "쿨타임";
      const def = rule.donor && g._defOf(rule.donor.def);
      if (def && donorCount(g) >= st.settings.maxDonorMonsters) return "후원 몬스터 최대";
      if ((def && def.isBoss) || rule.effects.some((e) => e.type === "boss")) if (bossCount(g) >= st.settings.maxBosses) return "보스 최대";
    }
    return null;
  }

  function applyEffect(r, e, rule, rec, ally) {
    const g = r.game, st = r.stream, rng = () => g.rng();
    const teams = teamsFor(r, e.target, rec.donor);
    const keyBase = rule.stack ? `r${rule.amount}:${rec.id}` : `r${rule.amount}`;
    switch (e.type) {
      case "buff": for (const t of teams) {
        if (rule.stack) { const n = (g.teamBuffs.get(t) || []).filter((b) => b.key.startsWith(`r${rule.amount}:`) && b.until > g.time).length; if (n >= 3) break; }
        g.addTeamBuff(t, e.stat, 1 + e.value, e.dur, `${keyBase}:${e.stat}`);
      } break;
      case "spawn": for (const t of teams) g.spawnWave(e.unit, t, e.count, { owner: "donation" }); break;
      case "boss": for (const t of teams) g.spawnSpecial(e.unit, t, { owner: "donation", hpMul: { easy: 0.7, normal: 1, hard: 1.4 }[st.settings.bossLevel] }); break;
      case "healUnits": for (const t of teams) g.healTeam(t, e.value); break;
      case "healBase": for (const t of teams) g.healBase(t, e.value); break;
      case "damageBase": for (const t of teams) g.damageBase(t, e.value); break;
      case "energy": for (const t of teams) g.energyTeam(t, e.value); break;
      case "giant": for (const t of teams) g.giantTeam(t, e.value, e.dur); break;
      case "transform": for (const t of teams) g.transformTeam(t, e.count); break;
      case "knock": for (const t of teams) g.knockTeam(t); break;
      case "stun": for (const t of teams) g.stunTeam(t, e.dur); break;
      case "meteor": for (let i = 0; i < e.count; i++) { const tt = teams.length === 1 ? teams[0] : null; const tu = g.aliveOf(tt); const x = tu.length ? tu[Math.floor(rng() * tu.length)].x : 200 + rng() * (g.L - 400); g.meteor(x, e.value, 90, tt); } break;
      case "bossRush": for (const t of teams) st.timers.push({ until: g.time + e.dur, next: g.time, every: 6, unit: "kingslime", team: t }); break;
      case "random": {
        const pick = ["meteor", "giant", "transform", "stun", "spawn", "bossRush"][Math.floor(rng() * 6)];
        const ex = { meteor: { type: "meteor", target: "all", count: 3, value: 300 }, giant: { type: "giant", target: "all", value: 1.3, dur: 15 }, transform: { type: "transform", target: "all", count: 6 }, stun: { type: "stun", target: "all", dur: 2 }, spawn: { type: "spawn", target: "all", unit: "malang", count: 8 }, bossRush: { type: "bossRush", target: "enemy", dur: 12 } }[pick];
        if (pick === "spawn") { g.spawnWave("malang", 0, 8, { owner: "donation" }); g.spawnWave("slime", 1, 8, { owner: "donation" }); }
        else applyEffect(r, ex, rule, rec, ally);
        rec.note = (rec.note ? rec.note + ", " : "") + "랜덤: " + DATA.streamEffects[pick];
      } break;
    }
  }

  function execute(r, item) {
    const st = r.stream, g = r.game, rec = item.rec;
    const ally = allyTeam(r, rec.donor);
    const spawned = [];
    for (const rule of item.rules) {
      st.lastFire[rule.id] = g.time;
      for (const e of rule.effects) { try { applyEffect(r, e, rule, rec, ally); } catch (err) { console.warn("[dw-stream] 효과 실패", e.type, err.message); } }
      if (rule.donor) {
        const def = g._defOf(rule.donor.def);
        const team = rule.donor.side === "enemy" ? 1 - ally : ally;
        const bossMul = def?.isBoss ? { easy: 0.7, normal: 1, hard: 1.4 }[st.settings.bossLevel] : 1;
        const u = g.spawnSpecial(rule.donor.def, team, { owner: "donation", label: st.settings.showDonorNames ? rec.donor : null, donationId: rec.id, hpMul: st.settings.donorHpMul * bossMul, atkMul: st.settings.donorAtkMul, scale: st.settings.donorScale * (def?.rig?.scale ? 1 : 1), tier: def?.grade || null });
        if (u) spawned.push({ id: u.id, def: rule.donor.def, team, name: def?.name || "" });
      }
    }
    rec.status = "applied"; rec.units = spawned.map((x) => x.id); dbStatus(rec);
    const d = st.donors.get(rec.donor);
    const alert = { id: rec.id, donor: rec.donor, amount: rec.amount, test: rec.test, platform: rec.platform, rule: rec.ruleName, anim: item.rules[0].anim, sound: item.rules[0].sound, monsters: spawned, side: spawned[0] ? (spawned[0].team === ally ? "ally" : "enemy") : null, team: st.kind === "team" ? ally : null, count: d?.count || 1, total: d?.total || rec.amount, note: rec.note || null };
    toAll(r).emit("dw:donation", alert);
    io.to(ovRoom(r)).emit("dw:ovAlert", { k: "donation", ...alert });
    pushLog(r, rec);
  }

  // ---------- 투표 ----------
  const VOTES = {
    svs: [["슬라임 떼 8마리", { type: "spawn", unit: "slime", count: 8, target: "enemy" }], ["침쏘는벌 5마리", { type: "spawn", unit: "bee", count: 5, target: "enemy" }], ["강철달팽이 2마리", { type: "spawn", unit: "snail", count: 2, target: "enemy" }], ["가시돌이 4마리", { type: "spawn", unit: "spikeman", count: 4, target: "enemy" }], ["킹 슬라임 소환!", { type: "boss", unit: "kingslime", target: "enemy" }, 60], ["운석 3개 (스트리머 쪽)", { type: "meteor", count: 3, value: 250, target: "ally" }], ["스트리머 유닛 기절 2초", { type: "stun", dur: 2, target: "ally" }]],
    raid: [["아군 공격력 +30% (20초)", { type: "buff", stat: "atk", value: 0.3, dur: 20, target: "ally" }], ["아군 기지 회복 15%", { type: "healBase", value: 0.15, target: "ally" }], ["적 이동속도 -30% (20초)", { type: "buff", stat: "spd", value: -0.3, dur: 20, target: "enemy" }], ["적 공격속도 +30% (20초)", { type: "buff", stat: "aspd", value: 0.3, dur: 20, target: "enemy" }], ["적 대량 소환", { type: "spawn", unit: "ghostfly", count: 8, target: "enemy" }], ["에너지 +250", { type: "energy", value: 250, target: "ally" }]],
    team: [["블루팀 공격력 +20%", { type: "buff", stat: "atk", value: 0.2, dur: 20, target: "team0" }], ["레드팀 공격력 +20%", { type: "buff", stat: "atk", value: 0.2, dur: 20, target: "team1" }], ["운석: 블루팀에", { type: "meteor", count: 3, value: 250, target: "team0" }], ["운석: 레드팀에", { type: "meteor", count: 3, value: 250, target: "team1" }], ["양 팀 거대화", { type: "giant", value: 1.3, dur: 15, target: "all" }]],
    chaos: [["유닛 거대화 (전체)", { type: "giant", value: 1.35, dur: 15, target: "all" }], ["유닛 변신 (전체)", { type: "transform", count: 6, target: "all" }], ["운석 낙하", { type: "meteor", count: 4, value: 300, target: "all" }], ["모두 기절 2초", { type: "stun", dur: 2, target: "all" }], ["양 팀 대량 소환", { type: "random2" }], ["보스 러시 15초", { type: "bossRush", dur: 15, target: "enemy" }], ["모두 넉백", { type: "knock", target: "all" }]],
  };
  function openVote(r) {
    const st = r.stream, g = r.game;
    const pool = VOTES[st.kind].filter((v) => !v[2] || g.time >= v[2]);
    const opts = []; const p = pool.slice();
    while (opts.length < 3 && p.length) opts.push(p.splice(Math.floor(g.rng() * p.length), 1)[0]);
    st.vote = { id: (st.vote?.id || 0) + 1, opts: opts.map((o) => ({ label: o[0], fx: o[1], n: 0 })), voters: new Map(), endsAt: g.time + st.settings.voteDur };
    emitVote(r);
  }
  function emitVote(r, result) {
    const v = r.stream.vote; const g = r.game;
    const pub = v ? { id: v.id, opts: v.opts.map((o) => ({ label: o.label, n: o.n })), left: Math.max(0, +(v.endsAt - g.time).toFixed(1)), result: result ?? null } : null;
    toAll(r).emit("dw:vote", pub); io.to(ovRoom(r)).emit("dw:ovVote", pub);
  }
  function castVote(r, voterKey, idx) {
    const v = r.stream?.vote; if (!v || !r.game || r.game.time > v.endsAt) return false;
    if (!(idx >= 0 && idx < v.opts.length)) return false;
    const prev = v.voters.get(voterKey); if (prev === idx) return true;
    if (prev != null) v.opts[prev].n--;
    v.voters.set(voterKey, idx); v.opts[idx].n++;
    return true;
  }
  function closeVote(r) {
    const st = r.stream, v = st.vote, g = r.game;
    const max = Math.max(...v.opts.map((o) => o.n));
    const top = v.opts.map((o, i) => [o, i]).filter(([o]) => o.n === max);
    const [win, wi] = top[Math.floor(g.rng() * top.length)];
    if (max > 0) {
      const fx = win.fx;
      if (fx.type === "random2") { g.spawnWave("malang", 0, 8, { owner: "vote" }); g.spawnWave("slime", 1, 8, { owner: "vote" }); }
      else if (/^team[01]$/.test(fx.target)) applyEffectTeam(r, fx, { amount: 0, id: "vote", stack: false }, { donor: "", id: 0 }, 0, +fx.target.slice(4));
      else applyEffect(r, fx, { amount: 0, id: "vote", stack: false }, { donor: "", id: 0 }, 0);
    }
    emitVote(r, { idx: wi, label: win.label, n: max });
    io.to(ovRoom(r)).emit("dw:ovAlert", { k: "vote", label: max > 0 ? win.label : "투표 없음" });
    st.vote = null; st.nextVoteAt = g.time + st.settings.voteEvery;
  }
  // 팀 지정 효과(투표용): target "all" + 강제 팀
  const _apply = applyEffect;
  function applyEffectTeam(r, e, rule, rec, ally, forceTeam) {
    if (forceTeam == null) return _apply(r, e, rule, rec, ally);
    const g = r.game;
    if (e.type === "buff") g.addTeamBuff(forceTeam, e.stat, 1 + e.value, e.dur, `vote:${e.stat}:${forceTeam}`);
    else if (e.type === "meteor") { for (let i = 0; i < e.count; i++) { const tu = g.aliveOf(forceTeam); const x = tu.length ? tu[Math.floor(g.rng() * tu.length)].x : g.L / 2; g.meteor(x, e.value, 90, forceTeam); } }
    else _apply(r, { ...e, target: "all" }, rule, rec, ally);
  }

  // ---------- 매 틱 (게임 진행 후) ----------
  function onTick(r) {
    const st = r.stream, g = r.game; if (!st || !g) return;
    // 대기열: 실행 가능한 맨 앞 항목부터, 간격 두고 하나씩
    if (st.queue.length && g.time >= st.nextAt) {
      for (let i = 0; i < st.queue.length; i++) {
        const it = st.queue[i];
        const why = blocked(r, it);
        if (!why) { st.queue.splice(i, 1); execute(r, it); st.nextAt = g.time + st.settings.execGap; break; }
        if (g.time - it.at > WAIT_LIMIT_SEC) { st.queue.splice(i, 1); it.rec.status = "expired"; it.rec.note = `${WAIT_LIMIT_SEC}초 동안 실행 못 함 (${why})`; dbStatus(it.rec); pushLog(r, it.rec); break; }
      }
    }
    // 보스 러시 타이머
    if (st.timers.length) {
      for (const t of st.timers) if (g.time >= t.next && g.time <= t.until) { if (bossCount(g) < st.settings.maxBosses + 1) g.spawnSpecial(t.unit, t.team, { owner: "donation", hpMul: 0.5, scale: 0.75 }); t.next = g.time + t.every; }
      st.timers = st.timers.filter((t) => g.time <= t.until);
    }
    // 투표
    if (st.settings.voteEvery > 0 && st.settings.viewerJoin && !st.settings.viewOnly) {
      if (!st.vote && g.time >= Math.max(15, st.nextVoteAt)) openVote(r);
      else if (st.vote && g.time >= st.vote.endsAt) closeVote(r);
      else if (st.vote && g.tick % 10 === 0) emitVote(r);
    }
    // 혼돈의 전장: 25초마다 자동 랜덤 이벤트 (겹침 막기: 대기열이 많으면 쉼)
    if (st.kind === "chaos" && g.time >= st.chaosAt + 25 && g.time > 20) {
      st.chaosAt = g.time;
      if (st.queue.length < 5) { const o = VOTES.chaos[Math.floor(g.rng() * VOTES.chaos.length)]; if (o[1].type === "random2") { g.spawnWave("malang", 0, 6, { owner: "vote" }); g.spawnWave("slime", 1, 6, { owner: "vote" }); } else applyEffect(r, o[1], { amount: 0, stack: false }, { donor: "", id: 0 }, 0); toAll(r).emit("dw:chaos", { label: o[0] }); io.to(ovRoom(r)).emit("dw:ovAlert", { k: "chaos", label: o[0] }); }
    }
    // 오버레이 요약 (0.5초마다)
    if (g.tick % 10 === 0) io.to(ovRoom(r)).emit("dw:ov", ovSummary(r));
  }
  function ovSummary(r) {
    const st = r.stream, g = r.game;
    const boss = g ? g.units.filter((u) => u.alive && u.boss).sort((a, b) => b.maxHp - a.maxHp)[0] : null;
    const bd = boss && g._defOf(boss.def);
    return {
      status: r.status, kind: st.kind, kindName: KIND_NAME[st.kind], title: st.title, code: r.code, time: g ? Math.round(g.time) : 0, timeLimit: g?.cfg.timeLimit || null,
      bases: g ? g.bases.map((b) => [Math.round(b.hp), b.maxHp]) : null,
      boss: boss ? { name: boss.label ? `${boss.label}의 ${bd?.name || "보스"}` : bd?.name || "보스", hp: Math.round(boss.hp), max: boss.maxHp } : null,
      queue: st.queue.length, viewers: [...r.players.values()].filter((p) => p.spec).length,
      units: g ? [g.units.filter((u) => u.alive && u.team === 0).length, g.units.filter((u) => u.alive && u.team === 1).length] : [0, 0],
    };
  }
  function onEnd(r, winner) {
    const st = r.stream; if (!st) return;
    // 게임 끝난 뒤 대기열은 다음 게임으로 넘기지 않음 (기록만)
    for (const it of st.queue) { it.rec.status = "game_over"; it.rec.note = "게임이 끝나 적용 안 함"; dbStatus(it.rec); pushLog(r, it.rec); }
    st.queue = []; st.vote = null; st.timers = []; st.nextAt = 0; st.lastFire = {};
    io.to(ovRoom(r)).emit("dw:ovAlert", { k: "end", winner, kind: st.kind });
    io.to(ovRoom(r)).emit("dw:ov", ovSummary(r));
  }
  function onStart(r) { const st = r.stream; if (!st) return; st.nextVoteAt = 15; st.chaosAt = 0; io.to(ovRoom(r)).emit("dw:ovAlert", { k: "start", kind: st.kind }); }

  // 채팅 명령 (!1 !2 !3 투표, !레드 !블루 팀 선택)
  function onChat(r, msg) {
    const st = r.stream; if (!st) return;
    const text = String(msg.text || "").trim(); const who = String(msg.sender || msg.nick || ""); const nick = cleanDonor(msg.nick);
    if (!who) return;
    const m = text.match(/^!\s*([1-3])$/);
    if (m && st.settings.viewerJoin && !st.settings.viewOnly) { castVote(r, "chat:" + who, +m[1] - 1); return; }
    if (st.kind === "team") {
      if (st.chatTeams.size > 5000 && !st.chatTeams.has(nick)) st.chatTeams.delete(st.chatTeams.keys().next().value);
      if (/^!\s*(레드|빨강|red)$/i.test(text)) st.chatTeams.set(nick, 1);
      else if (/^!\s*(블루|파랑|blue)$/i.test(text)) st.chatTeams.set(nick, 0);
    }
  }

  return { receive, onTick, onEnd, onStart, castVote, onChat, ovSummary, matchRules: (r, a) => matchRules(r.stream, a), applyEffectTeam };
}
