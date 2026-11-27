// =========================
// 격리구역: 제로 — 이변체 제작소 공용 (화면·서버 같은 파일): 허용된 조건·효과 목록, 문장 자동 생성(3개 언어), 검사, 엔진용 정의 만들기
// 사용자는 정해진 목록에서만 고름 → 임의 코드 실행 없음. 서버도 같은 검사(validate)를 거친 것만 저장.
// =========================
const l = (ko, ja, en) => [ko, ja, en];
export const GRID = 48, FRAMES = 2;
export const PALETTE = ["", "#0b0d12", "#2a2d36", "#5a5f68", "#9aa3ad", "#e8ecf2", "#5a1018", "#c53a3a", "#ff7a5a", "#d6b04c", "#f4efe0", "#2f6d34", "#6ec466", "#1c3a5a", "#59a7e0", "#b796ff"];
// 조건 (on: work = 연구할 때 / tick = 늘)
export const CONDS = {
  m_observe: { on: "work", c: [["method", "observe"]], t: l("관찰로 연구하면", "観察で研究すると", "when studied by Observation"), neg: l("관찰했지만", "観察したが", "Observed it, but") },
  m_talk: { on: "work", c: [["method", "talk"]], t: l("말을 걸면", "話しかけると", "when spoken to"), neg: l("말을 걸었지만", "話しかけたが", "Spoke to it, but") },
  m_env: { on: "work", c: [["method", "env"]], t: l("환경을 조절하면", "環境を調整すると", "when its environment is adjusted"), neg: l("환경을 조절했지만", "環境を調整したが", "Adjusted its environment, but") },
  same: { on: "work", c: [["sameWorker"]], t: l("같은 직원이 연달아 다루면", "同じ職員が続けて扱うと", "when the same worker handles it twice in a row"), neg: l("같은 직원이 연달아 다뤘지만", "同じ職員が続けて扱ったが", "The same worker handled it twice, but") },
  sameM: { on: "work", c: [["sameMethod"]], t: l("같은 방식을 반복하면", "同じ方法を繰り返すと", "when the same method is repeated"), neg: l("같은 방식을 반복했지만", "同じ方法を繰り返したが", "Repeated the same method, but") },
  stressHi: { on: "work", c: [["stress>=", 60]], t: l("스트레스가 높은 직원(60 이상)이 다루면", "ストレスの高い職員（60以上）が扱うと", "when a stressed worker (60+) handles it"), neg: l("스트레스 높은 직원이 다뤘지만", "ストレスの高い職員が扱ったが", "A stressed worker handled it, but") },
  stressLo: { on: "work", c: [["stress<", 30]], t: l("차분한 직원(스트레스 30 미만)이 다루면", "落ち着いた職員（ストレス30未満）が扱うと", "when a calm worker (stress < 30) handles it"), neg: l("차분한 직원이 다뤘지만", "落ち着いた職員が扱ったが", "A calm worker handled it, but") },
  vet: { on: "work", c: [["lv>=", 3]], t: l("경험 많은 직원(레벨 3 이상)이 다루면", "経験豊富な職員（レベル3以上）が扱うと", "when a veteran (level 3+) handles it"), neg: l("경험 많은 직원이 다뤘지만", "経験豊富な職員が扱ったが", "A veteran handled it, but") },
  sec: { on: "work", c: [["job", "security"]], t: l("보안요원이 다루면", "警備員が扱うと", "when Security handles it"), neg: l("보안요원이 다뤘지만", "警備員が扱ったが", "Security handled it, but") },
  medic: { on: "work", c: [["job", "medic"]], t: l("의료요원이 다루면", "医療員が扱うと", "when a Medic handles it"), neg: l("의료요원이 다뤘지만", "医療員が扱ったが", "A Medic handled it, but") },
  morning: { on: "work", c: [["time", 0, 240]], t: l("오전(12시 전)에 다루면", "午前（12時前）に扱うと", "when handled before noon"), neg: l("오전에 다뤘지만", "午前に扱ったが", "Handled it in the morning, but") },
  evening: { on: "work", c: [["time", 360, 600]], t: l("오후 2시 이후에 다루면", "午後2時以降に扱うと", "when handled after 14:00"), neg: l("오후 늦게 다뤘지만", "午後遅くに扱ったが", "Handled it late in the day, but") },
  pair: { on: "work", c: [["roomStaff>=", 2]], t: l("두 명 이상이 같은 방에 있으면", "二人以上が同じ部屋にいると", "when two or more people are in the room"), neg: l("두 명이 함께 있었지만", "二人一緒にいたが", "Two people were present, but") },
  tired: { on: "work", c: [["fat>=", 60]], t: l("피곤한 직원(피로 60 이상)이 다루면", "疲れた職員（疲労60以上）が扱うと", "when a tired worker (fatigue 60+) handles it"), neg: l("피곤한 직원이 다뤘지만", "疲れた職員が扱ったが", "A tired worker handled it, but") },
  lowpow: { on: "tick", c: [["power<", 40]], t: l("전력이 40% 아래로 떨어지면", "電力が40%を下回ると", "when power drops below 40%"), neg: l("전력이 떨어졌지만", "電力が落ちたが", "Power fell, but") },
  alarm: { on: "tick", c: [["alarms>", 0]], t: l("경보가 울리면", "警報が鳴ると", "when alarms sound"), neg: l("경보가 울렸지만", "警報が鳴ったが", "Alarms sounded, but") },
  dark: { on: "tick", c: [["dark"]], t: l("시설이 어두워지면", "施設が暗くなると", "when the facility goes dark"), neg: l("어두워졌지만", "暗くなったが", "It went dark, but") },
  gen: { on: "tick", c: [["genBroken"]], t: l("발전기가 고장 나면", "発電機が故障すると", "when the generator fails"), neg: l("발전기가 멈췄지만", "発電機が止まったが", "The generator stopped, but") },
  lonely: { on: "tick", c: [["idle>", 120]], t: l("오래 혼자 두면(2시간)", "長く放置すると（2時間）", "when left alone for 2 hours"), neg: l("한참 혼자였지만", "しばらく一人だったが", "It was left alone a while, but") },
};
// 효과 (work·tick 따로 수치)
export const EFFS = {
  unstable: { work: { stab: -12 }, tick: { stab: -0.4 }, t: l("불안정해진다", "不安定になる", "it destabilizes"), past: l("안정도가 내려갔다", "安定度が下がった", "containment dropped") },
  stable: { work: { stab: 8 }, tick: { stab: 0.25 }, t: l("안정된다", "安定する", "it steadies"), past: l("안정도가 올라갔다", "安定度が上がった", "containment rose") },
  energy: { work: { energy: 1.6 }, t: l("에너지를 더 준다", "エネルギーが増える", "it gives more energy"), past: l("에너지가 늘었다 (×1.6)", "エネルギーが増えた（×1.6）", "energy rose (×1.6)") },
  stingy: { work: { energy: 0.5 }, t: l("에너지를 덜 준다", "エネルギーが減る", "it gives less energy"), past: l("에너지가 줄었다 (×0.5)", "エネルギーが減った（×0.5）", "energy fell (×0.5)") },
  data: { work: { data: 1.8 }, t: l("데이터를 더 준다", "データが増える", "it yields more data"), past: l("데이터가 늘었다 (×1.8)", "データが増えた（×1.8）", "data rose (×1.8)") },
  scare: { work: { stress: 15 }, t: l("작업자의 스트레스가 크게 오른다", "作業者のストレスが大きく上がる", "the worker gets badly stressed"), past: l("작업자가 크게 겁먹었다", "作業者がひどく怯えた", "the worker was badly shaken") },
  soothe: { work: { stress: -12 }, t: l("작업자를 진정시킨다", "作業者を落ち着かせる", "it calms the worker"), past: l("작업자가 진정됐다", "作業者が落ち着いた", "the worker calmed down") },
  calmall: { work: { stressAll: -6 }, tick: { calmFloor: 0.3 }, t: l("주변 사람들의 스트레스를 낮춘다", "周囲の人のストレスを下げる", "it calms everyone around it"), past: l("주변이 차분해졌다", "周りが落ち着いた", "everyone nearby calmed down") },
};
export const BREACH_TYPES = ["hop", "zone", "roam", "static"];
export const ZONES = ["vines", "paper", "chairs"];
export const METHODS4 = ["observe", "talk", "env", "analyze"];
// 문장 만들기
export function hypText(condId, effId) { const C = CONDS[condId], E = EFFS[effId]; return [0, 1, 2].map((i) => (i === 2 ? `${cap(E.t[2])} ${C.t[2]}` : `${C.t[i]} ${E.t[i]}`)); }
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function posText(condId, effId) { const C = CONDS[condId], E = EFFS[effId]; return [`기록: (${C.t[0]}) → ${E.past[0]} {s}`, `記録：（${C.t[1]}）→ ${E.past[1]} {s}`, `Record: (${C.t[2]}) → ${E.past[2]} {s}`]; }
function negText(condId) { const C = CONDS[condId]; return [`기록: ${C.neg[0]} 아무 변화가 없었다 {s}`, `記録：${C.neg[1]}何も変わらなかった {s}`, `Record: ${C.neg[2]} nothing changed {s}`]; }

// 검사 — 이상한 값은 null
const str = (v, n) => typeof v === "string" ? v.replace(/[<>\r\n\t]/g, "").trim().slice(0, n) : "";
export function validate(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = str(raw.name, 20), desc = str(raw.desc, 140); if (!name) return null;
  const grade = Math.max(1, Math.min(4, raw.grade | 0));
  const resp = {}; for (const m of METHODS4) { const v = raw.resp?.[m] | 0; resp[m] = v > 0 ? 1 : v < 0 ? -1 : 0; }
  const pickRule = (r) => r && CONDS[r.c] && EFFS[r.e] && (CONDS[r.c].on === "work" || EFFS[r.e].tick) ? { c: r.c, e: r.e } : null;
  const rules = (Array.isArray(raw.rules) ? raw.rules : []).slice(0, 2).map(pickRule).filter(Boolean); if (rules.length < 1) return null;
  const decoys = (Array.isArray(raw.decoys) ? raw.decoys : []).slice(0, 2).map(pickRule).filter(Boolean);
  const all = [...rules, ...decoys]; if (new Set(all.map((r) => r.c + r.e)).size !== all.length) return null;
  if (decoys.some((d) => rules.some((r) => r.c === d.c))) return null;          // 같은 조건으로 참·거짓이 겹치면 판정이 꼬임
  const bt = BREACH_TYPES.includes(raw.breach) ? raw.breach : "hop", zone = ZONES.includes(raw.zone) ? raw.zone : "vines", recon = METHODS4.includes(raw.recon) ? raw.recon : "env";
  const pix = typeof raw.pix === "string" && /^[0-9a-f]+$/.test(raw.pix) && raw.pix.length === GRID * GRID * FRAMES ? raw.pix : null; if (!pix) return null;
  return { v: 1, name, desc, grade, resp, rules, decoys, breach: bt, zone, recon, pix };
}
// 엔진용 정의 (zero-anoms 형식)
export function toAnom(id, d) {
  const hyp = [], rules = [], decoys = [];
  d.rules.forEach((r, i) => { const h = `${id}_t${i}`, C = CONDS[r.c], E = EFFS[r.e]; hyp.push({ id: h, t: 1, s: hypText(r.c, r.e), pos: posText(r.c, r.e) }); rules.push({ h, on: C.on, if: C.c, do: C.on === "tick" ? E.tick : E.work }); });
  d.decoys.forEach((r, i) => { const h = `${id}_f${i}`, C = CONDS[r.c]; hyp.push({ id: h, t: 0, s: hypText(r.c, r.e), neg: negText(r.c) }); decoys.push({ h, on: C.on, if: C.c }); });
  // 섞어서 순서로 정답이 드러나지 않게 (이름으로 정해진 순서)
  hyp.sort((a, b) => (a.id.length * 7 + a.s[0].length) % 5 - (b.id.length * 7 + b.s[0].length) % 5);
  const hp = [0, 80, 130, 190, 240][d.grade];
  const breach = d.breach === "hop" ? { type: "hop", every: [8, 12], stress: 0.8 + d.grade * 0.3, work: 0.6, hp, fight: 1, recon: { method: d.recon, if: [] } }
    : d.breach === "zone" ? { type: "zone", zone: d.zone, every: 11, max: 2 + d.grade, stress: 0.5 + d.grade * 0.2, work: 0.6, move: 0.7, recon: { method: d.recon, if: [["noZones"]] } }
    : d.breach === "roam" ? { type: "roam", seek: "staff", speed: 22 + d.grade * 3, hp, attack: { kind: "dmg", v: 1.5 + d.grade }, stress: 0.6 + d.grade * 0.3, recon: { method: d.recon, if: [] } }
    : { type: "static", stressAll: 0.1 + d.grade * 0.08, auto: 80, recon: { method: d.recon, if: [] } };
  const bt = { hop: l("방을 옮겨 다니며 직원들을 방해해요.", "部屋を移りながら職員を妨害します。", "Moves room to room, disrupting staff."), zone: l("주변 방으로 번져 이동과 작업을 느리게 해요.", "周囲の部屋へ広がり移動と作業を遅くします。", "Spreads into nearby rooms, slowing movement and work."), roam: l("직원을 쫓아다니며 공격해요.", "職員を追い回して攻撃します。", "Hunts and attacks staff."), static: l("제자리에서 시설 전체에 공포를 퍼뜨려요.", "その場で施設全体に恐怖を広げます。", "Spreads dread through the whole facility from its cell.") }[d.breach];
  const M = { observe: l("관찰", "観察", "Observation"), talk: l("대화", "対話", "Dialogue"), env: l("환경 조절", "環境調整", "Environment"), analyze: l("행동 분석", "行動分析", "Analysis") }[d.recon];
  const rc = d.breach === "roam" ? l(`제압한 뒤 '${M[0]}'로 재격리`, `鎮圧してから「${M[1]}」で再収容`, `Suppress it, then recontain with ${M[2]}`) : d.breach === "zone" ? l(`번진 곳을 정리한 뒤 '${M[0]}'로 재격리`, `広がった所を片付けてから「${M[1]}」で再収容`, `Clear the spread, then recontain with ${M[2]}`) : l(`그 자리에서 '${M[0]}'로 재격리`, `その場で「${M[1]}」で再収容`, `Recontain on the spot with ${M[2]}`);
  return { no: "U-" + id.slice(-3).toUpperCase(), grade: d.grade, size: 64, name: [d.name, d.name, d.name], look: [d.desc, d.desc, d.desc], origin: l("사용자가 만든 이변체", "ユーザー作の異変体", "A user-made anomaly"), resp: d.resp, energy: [0, 4, 6, 9, 12][d.grade], custom: 1, pix: d.pix, hyp, rules, decoys, breach, breachTxt: bt, reconTxt: rc };
}
