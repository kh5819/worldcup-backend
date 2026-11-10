// 방송국 서바이벌 버그 사냥: 무작위·악성 입력을 마구 보내며 불변 조건 검사. node scripts/test-lifebc-sv-fuzz.mjs [판수] [시드]
import { SvGame } from "../src/lifebc-sv-core.js";
const N = +(process.argv[2] || 300), S0 = +(process.argv[3] || 1);
const TYPES = ["done", "action", "agenda", "program", "statement", "u_pick", "u_tag", "x_assign", "x_gambit", "petition", "h_say", "h_evid", "h_vote", "e_vote", "ct_propose", "ct_reply", "ct_break", "ev_verify", "ev_publish", "retrial", "c_inspect", "c_share", "c_alibi", "c_check", "c_ask", "c_answer", "c_vote", "c_defend", "c_final", "c_frame", "c_hide", "c_obstruct", "c_help", "c_cover", "c_offer", "c_reply", "c_betray", "c_confess", "zzz"];
const BAD = ["constructor", "__proto__", "toString", "hasOwnProperty", -1, 1.5, 999, NaN, null, undefined, "", "1", {}, [], true, 1e9, -1e9, "out", "none"];
let rs = 7; const rnd = () => ((rs = (rs * 1103515245 + 12345) >>> 0) / 4294967296), pick = (a) => a[Math.floor(rnd() * a.length)];
const fails = {}; const fail = (k, info) => { if (!fails[k]) fails[k] = { n: 0, ex: info }; fails[k].n++; };
const SECRET_KEYS = ["culprit", "accomplice", "mission", "spy", "unseen", "evidence", "contracts", "notes"];
function goodPayload(g, s, type) {
  const v = g.viewFor(s.seat), seats = g.seats.map((x) => x.seat), c = v.crime;
  switch (type) {
    case "action": { const a = pick(v.me.actions); return { id: a.id, target: pick(seats) }; }
    case "agenda": return { i: Math.floor(rnd() * 3) };
    case "program": return { id: pick(["normal", "bold", "safe", "sponsor"]) };
    case "statement": return { id: v.rumors[0]?.id, mode: pick(["verify", "deny", "admit", "ignore"]) };
    case "u_pick": return { i: Math.floor(rnd() * 4) };
    case "u_tag": return { tag: v.urgent?.mine?.opts?.[0]?.tag };
    case "x_assign": return { p: pick(v.emg?.probs || [{}]).k };
    case "h_say": return { kind: pick(["blame", "defend", "reform", "evidence"]) };
    case "h_evid": case "ev_verify": case "ev_publish": return { id: pick(v.evidence || [{}]).id };
    case "h_vote": return { v: pick(["yes", "no", "abstain"]) };
    case "e_vote": return { seat: pick(seats) };
    case "ct_propose": return { type: pick(["revshare", "show", "support", "info", "protect"]), to: pick(seats), days: 3, coin: 20, penalty: 30, public: rnd() < 0.5, candidate: pick(seats) };
    case "ct_reply": case "ct_break": return { id: pick(v.contracts || [{}]).id, accept: rnd() < 0.5 };
    case "c_inspect": case "c_share": case "c_hide": case "c_defend": return { ev: pick(c?.slots || [{}]).id, kind: pick(["alibi", "evidence", "framed", "plead"]) };
    case "c_alibi": return rnd() < 0.5 ? { truth: 1 } : { loc: pick(["office", "studio", "pr", "lounge"]), with: pick(seats) };
    case "c_check": case "c_frame": return { target: pick(seats) };
    case "c_ask": return { target: pick(seats), q: pick(["where", "who", "did"]) };
    case "c_answer": return { id: c?.mine?.toAnswer?.[0]?.id, a: pick(["deny", "truth", "refuse"]) };
    case "c_vote": return { v: rnd() < 0.2 ? "out" : rnd() < 0.2 ? "none" : pick(seats) };
    case "c_final": return { v: pick(["guilty", "innocent"]) };
    case "c_offer": return { target: pick(seats), coin: 50 };
    case "c_reply": return { id: c?.mine?.offers?.[0]?.id, accept: rnd() < 0.5 };
  }
  return {};
}
const badPayload = () => { const o = {}; for (const k of ["id", "i", "target", "to", "seat", "v", "p", "tag", "mode", "kind", "type", "ev", "loc", "with", "q", "a", "coin", "days", "penalty", "candidate", "accept", "truth"]) if (rnd() < 0.5) o[k] = pick(BAD); return o; };
const finite = (g) => Object.entries(g.m).every(([, v]) => typeof v === "number" && Number.isFinite(v));
let ended = 0, days = [], endIds = {};
for (let gi = 0; gi < N; gi++) {
  rs = S0 * 7919 + gi; const n = 1 + (gi % 15); let t = 0; const g = new SvGame({ players: Array.from({ length: n }, (_, i) => ({ key: "k" + i, nick: "P" + i })), diff: pick(["normal", "hard", "expert"]), seed: S0 * 1000 + gi, now: () => t });
  g.start(); let steps = 0, lastDay = 0, stuck = 0;
  try {
    while (g.phase.name !== "over" && steps++ < 20000) {
      const hs = g.humans();
      for (let k = 0; k < 3 && hs.length; k++) {
        const s = pick(hs), type = pick(TYPES); let p;
        try { p = rnd() < 0.3 ? badPayload() : goodPayload(g, s, type); } catch (e) { p = {}; }
        const before = JSON.stringify([g.seats.map((x) => x.coin), g.m.money]);
        let r; try { r = g.act(s.seat, type, p); } catch (e) { fail("act 예외 " + type + ": " + e.message, { p, ph: g.phase.name, stack: e.stack.split("\n")[1] }); continue; }
        if (!r.ok && type.startsWith("c_") && JSON.stringify([g.seats.map((x) => x.coin), g.m.money]) !== before) fail("실패했는데 코인 변함 " + type + " " + r.error, { p });
        if (g.seats.some((x) => !Number.isFinite(x.coin) || x.coin < 0 || !(x.rep >= 0 && x.rep <= 100) || !Number.isFinite(x.fame))) fail("개인 수치 이상 after " + type, { p, coins: g.seats.map((x) => x.coin) });
        if (g.contracts.length > 400) fail("계약 목록 무한 증가", { n: g.contracts.length });
        if (!finite(g)) { fail("지표가 숫자 아님 after " + type, { p, m: g.m }); break; }
      }
      // 끊김·재접속·이탈
      if (rnd() < 0.01 && hs.length) g.setAway(pick(hs).seat, rnd() < 0.6);
      if (rnd() < 0.002 && hs.length > 1) g.leave(pick(hs).seat);
      // 화면 정보 검사
      if (steps % 7 === 0) {
        try {
          for (const s of g.humans()) { const v = g.viewFor(s.seat); JSON.stringify(v); }
          const sp = g.viewFor(null), js = JSON.stringify(sp);
          if (sp.me || sp.evidence || sp.contracts) fail("관전에 개인 정보", {});
          if (sp.crime?.mine) fail("관전에 crime.mine", {});
          if (g.crime && g.phase.name !== "crime_result" && g.crime.culprit != null && sp.crime?.reveal) fail("결과 전 범인 공개", {});
          if (sp.urgent?.mine) fail("관전에 urgent.mine", {});
          if (g.phase.name !== "over" && /"spy":true/.test(js)) fail("관전에 스파이 표시", {});
          // 다른 사람 화면에 남의 비밀
          if (g.crime && g.crime.culprit != null) for (const s of g.humans()) { if (s.seat === g.crime.culprit || s.seat === g.crime.accomplice) continue; const v = g.viewFor(s.seat); if (v.crime?.mine?.secret || v.crime?.mine?.unseen) fail("범인 아닌 사람에게 비밀", { seat: s.seat }); }
        } catch (e) { fail("viewFor 예외: " + e.message, { ph: g.phase.name, stack: e.stack.split("\n").slice(1, 3).join(" | ") }); }
      }
      // 시간 진행
      t = Math.max(t + 400, rnd() < 0.5 ? g.phase.ends : t + 400);
      try { g.tick(); } catch (e) { fail("tick 예외 @" + g.phase.name + ": " + e.message, { stack: e.stack.split("\n").slice(1, 3).join(" | ") }); t = g.phase.ends; try { g.endPhase(); } catch { break; } }
      if (g.day === lastDay) stuck++; else { stuck = 0; lastDay = g.day; }
      if (stuck > 4000) { fail("진행 멈춤 @" + g.phase.name, { day: g.day }); break; }
      if (g.day > 31) { fail("30일 넘음", { day: g.day }); break; }
    }
    if (g.phase.name === "over") { ended++; days.push(g.day); endIds[g.ending.id] = (endIds[g.ending.id] || 0) + 1; JSON.stringify(g.viewFor(null)); }
    else fail("끝나지 않음", { day: g.day, ph: g.phase.name, steps });
  } catch (e) { fail("게임 예외: " + e.message, { stack: e.stack.split("\n").slice(1, 3).join(" | ") }); }
}
console.log(`판 ${N}, 끝까지 ${ended}, 평균 일수 ${(days.reduce((a, b) => a + b, 0) / Math.max(1, days.length)).toFixed(1)}`);
console.log("엔딩", JSON.stringify(endIds));
const keys = Object.keys(fails); console.log(keys.length ? "문제 " + keys.length + "종" : "문제 없음");
for (const k of keys) console.log(" -", k, "x" + fails[k].n, JSON.stringify(fails[k].ex).slice(0, 300));
process.exit(keys.length ? 1 : 0);
