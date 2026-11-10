// 방송국 서바이벌 — 범인 찾기. 서버만 진실을 안다.
// 추리 구조: 사건 당일 모든 사람의 근무 기록(4가지 속성)은 공개. 증거는 범행자의 속성 값을 말해 준다.
//  · 단서 하나로는 항상 2명 이상 남는다  · 진짜 단서를 모으면 정확히 한 명 → 내부 범행 / 아무도 안 남으면 → 외부인 소행
//  · 믿기 어려운 출처의 단서는 틀릴 수 있고(서로 모순), 범인은 거짓 단서를 끼워 넣거나 진짜를 숨길 수 있다
// 모든 인물·기록은 게임 속 허구. 실제 사용자 채팅은 증거로 쓰지 않음.
import { L, LOCATIONS } from "./lifebc-sv-data.js";

const C = (id, loc, n, s, motive, outsider, next, w = 1) => ({ id, loc, n, s, motive, outsider, next, w });
export const CASES = [
  C("c_sns", "pr", L("SNS 익명 악성 게시글", "SNSの匿名悪質投稿", "Anonymous SNS Hate Post"), L("출연자를 겨냥한 악성 글이 내부 사정을 아는 듯한 말투로 올라왔다.", "出演者を狙う悪質投稿が内部事情を知る口ぶりで上がった。", "A hateful post about a cast member sounds like an inside job."), L("인기 경쟁에서 밀린 데 대한 앙심", "人気競争に負けた恨み", "Grudge over losing the popularity race"), L("내부 사정을 짜깁기한 외부 악플러의 소행이었다.", "内部事情を継ぎ接ぎした外部の悪質ユーザーの仕業だった。", "An outside troll stitched together public gossip."), "c_chat"),
  C("c_contract", "office", L("비밀 계약서 유출", "秘密契約書の流出", "Secret Contract Leak"), L("국장실 금고에 있던 계약서 사진이 커뮤니티에 올라왔다.", "局長室の金庫の契約書写真が掲示板に上がった。", "A photo of a contract from the chief's safe hit the forums."), L("계약 조건에 대한 불만과 폭로 욕심", "契約条件への不満と暴露欲", "Anger at the deal and a hunger to expose it"), L("거래처 직원이 실수로 올린 파일이었다.", "取引先の社員が誤って上げたファイルだった。", "A vendor's employee uploaded it by mistake."), "c_money"),
  C("c_mic", "control", L("생방송 마이크 고의 활성화", "生放送マイクの故意オン", "Hot Mic Sabotage"), L("광고 시간, 누군가 대기실 마이크를 일부러 켠 기록이 있다.", "CM中に誰かが控室マイクをわざと入れた記録がある。", "Logs show someone deliberately opened the green room mic during ads."), L("특정 출연자를 망신 주려는 복수", "特定の出演者に恥をかかせる復讐", "Revenge to humiliate a cast member"), L("외주 음향 장비의 자동 프리셋 오류였다.", "外注音響機材の自動プリセットの誤動作だった。", "An outside audio preset malfunctioned."), "c_gear"),
  C("c_ad", "meeting", L("광고 계약 자료 유출", "広告契約資料の流出", "Ad Deal Files Leaked"), L("광고 단가표가 경쟁사 영업 자료에 그대로 등장했다.", "広告単価表が競合の営業資料にそのまま登場した。", "Your rate card appeared verbatim in a rival sales deck."), L("경쟁사에서 받은 뒷돈", "競合からの裏金", "A payoff from the rival"), L("광고 대행사 쪽에서 새어 나간 자료였다.", "広告代理店側から漏れた資料だった。", "It leaked from the ad agency's side."), "c_rival"),
  C("c_money", "office", L("방송국 자금 횡령 의혹", "局の資金横領疑惑", "Embezzlement Suspicion"), L("회계 장부에서 어디로 갔는지 모를 지출이 발견됐다.", "会計帳簿で行き先不明の支出が見つかった。", "Untraceable spending turned up in the ledger."), L("개인 빚을 메우려는 횡령", "個人の借金を埋める横領", "Covering personal debts"), L("은행 수수료 전산 오류가 만든 숫자였다.", "銀行手数料の電算エラーが作った数字だった。", "A bank fee glitch produced the numbers."), "c_sponsor"),
  C("c_chat", "archive", L("출연진 비밀 채팅 유출", "出演者の秘密チャット流出", "Cast Group Chat Leak"), L("출연진 단체방의 대화가 편집돼 퍼졌다. (게임 속 허구)", "出演者グループの会話が編集され拡散。（ゲーム内の架空）", "Edited cast group chat logs spread. (in-game fiction)"), L("파벌 싸움에서 상대를 깎아내리려는 시도", "対立相手を貶める試み", "An attempt to tear down a rival"), L("해킹된 외부 메신저 계정에서 나간 것이었다.", "ハッキングされた外部メッセンジャーから漏れた。", "It came from a hacked outside messaging account."), "c_slander"),
  C("c_sched", "studio", L("방송 스케줄 고의 변경", "放送スケジュールの故意変更", "Schedule Sabotage"), L("특집 시간이 몰래 바뀌어 출연자 한 명이 결방됐다.", "特番の時間がこっそり変わり一人が欠番になった。", "The special's time was secretly changed; a cast member missed air."), L("경쟁 출연자의 분량을 뺏기 위해", "競争相手の出番を奪うため", "To steal a rival's airtime"), L("외부 편성 시스템 동기화 오류였다.", "外部編成システムの同期エラーだった。", "An external scheduling sync error."), "c_delete"),
  C("c_rival", "meeting", L("경쟁 방송국에 정보 전달", "競合局への情報提供", "Tip-off to the Rival"), L("다음 주 특집 기획이 경쟁사 방송에 먼저 나왔다.", "来週の特番企画が競合の放送に先に出た。", "Next week's special aired first on the rival network."), L("이직 약속을 위한 정보 거래", "移籍の約束のための情報取引", "Trading info for a job offer"), L("우연히 같은 외부 작가에게서 나온 기획이었다.", "偶然同じ外部作家から出た企画だった。", "The same freelance writer pitched both."), "c_contract"),
  C("c_gear", "control", L("방송 장비 고의 파손", "放送機材の故意破損", "Equipment Sabotage"), L("메인 스위처의 케이블이 깔끔하게 잘려 있었다.", "メインスイッチャーのケーブルがきれいに切られていた。", "The main switcher's cable was cleanly cut."), L("방송을 멈춰 책임자를 물러나게 하려는 시도", "放送を止めて責任者を退かせる試み", "Stop the show to force out a leader"), L("쥐가 갉은 흔적으로 드러났다.", "ネズミがかじった跡と判明した。", "It turned out rats had chewed it."), "c_sponsor"),
  C("c_fake", "pr", L("가짜 뉴스 유포", "偽ニュースの拡散", "Fake News Campaign"), L("방송국 폐업설 기사가 내부 자료 형식으로 돌고 있다.", "局の廃業説記事が内部資料形式で出回っている。", "Closure stories are circulating formatted like internal docs."), L("혼란을 틈타 자리를 차지하려는 욕심", "混乱に乗じて席を狙う欲", "Grabbing power in the chaos"), L("경쟁사 팬들이 만든 합성 자료였다.", "競合ファンが作った合成資料だった。", "Rival fans made the forgeries."), "c_slander"),
  C("c_slander", "office", L("방송국장 익명 비방", "局長への匿名誹謗", "Anonymous Attack on the Chief"), L("전 직원 메일로 국장 비방문이 발송됐다.", "全職員メールで局長への誹謗文が送られた。", "An attack on the chief went out to all staff by email."), L("불신임 여론을 만들려는 공작", "不信任の世論を作る工作", "Scheming to build no-confidence sentiment"), L("퇴사한 외부 협력사 직원이 보낸 메일이었다.", "退社した外部協力社員が送ったメールだった。", "A former outside contractor sent it."), "c_contract"),
  C("c_divide", "lounge", L("출연진 이간질 메시지", "出演者の離間メッセージ", "Divide-and-Conquer Messages"), L("서로를 험담했다는 가짜 메시지가 출연진에게 하나씩 도착했다.", "互いに陰口を言ったとの偽メッセージが一人ずつに届いた。", "Fake 'they trashed you' texts reached each cast member."), L("출연진 결속을 깨려는 계획", "出演者の結束を壊す計画", "A plan to break the cast's bond"), L("출연자를 노린 외부 스토커의 짓이었다.", "出演者を狙う外部ストーカーの仕業だった。", "An outside stalker targeting the cast did it."), "c_slander"),
  C("c_rig", "control", L("투표 결과 조작 시도", "投票結果の操作未遂", "Vote Rigging Attempt"), L("시청자 투표 서버에 관리자 권한 접속 기록이 남아 있다.", "視聴者投票サーバーに管理者権限の接続記録がある。", "Admin-level access logs appear on the viewer vote server."), L("좋아하는 출연자를 우승시키려는 욕심", "好きな出演者を優勝させたい欲", "Rigging for a favored cast member"), L("외부 매크로 공격이 만든 흔적이었다.", "外部マクロ攻撃が作った痕跡だった。", "Traces of an outside bot attack."), "c_delete"),
  C("c_sponsor", "office", L("후원 내역 조작", "後援内訳の操作", "Donation Records Doctored"), L("후원 정산 금액이 원본과 다르게 고쳐져 있었다.", "後援精算額が原本と違って修正されていた。", "Donation totals were altered from the originals."), L("빠진 돈을 감추기 위한 조작", "抜いた金を隠すための操作", "Hiding missing money"), L("결제 대행사 환율 처리 오류였다.", "決済代行の為替処理エラーだった。", "A payment processor's exchange-rate bug."), "c_delete"),
  C("c_delete", "archive", L("내부 문서 대량 삭제", "内部文書の大量削除", "Mass Deletion of Files"), L("감사 직전 자료실 문서 수백 건이 사라졌다.", "監査直前に資料室の文書数百件が消えた。", "Hundreds of archive files vanished right before an audit."), L("이전 범행의 증거를 없애려는 시도", "以前の犯行の証拠を消す試み", "Erasing evidence of earlier crimes"), L("백업 서버의 자동 정리 설정 때문이었다.", "バックアップサーバーの自動整理設定のせいだった。", "The backup server's auto-cleanup was misconfigured."), null),
  C("c_prop", "studio", L("소품 바꿔치기 사건", "小道具すり替え事件", "Prop Swap Incident"), L("생방 직전 소품이 바뀌어 출연자가 크게 망신을 당했다.", "生放送直前に小道具が替えられ出演者が大恥をかいた。", "A prop swap right before air publicly humiliated a cast member."), L("질투에서 나온 장난이 도를 넘음", "嫉妬からのいたずらが度を越した", "A jealous prank that went too far"), L("납품 업체가 잘못 배송한 소품이었다.", "納品業者が誤配送した小道具だった。", "The vendor delivered the wrong prop."), "c_divide"),
];
export const CASE_BY_ID = Object.fromEntries(CASES.map((c) => [c.id, c]));

// 공개 근무 기록 4가지 속성 (사건마다 다시 배정)
export const ATTRS = {
  device: { name: L("사용 기기", "使用機器", "Device"), v: [L("사내 PC", "社内PC", "Office PC"), L("업무 노트북", "業務ノートPC", "Work laptop"), L("개인 휴대폰", "個人スマホ", "Personal phone")] },
  zone: { name: L("출입 구역", "出入区域", "Access zone"), v: [L("제작동", "制作棟", "Production wing"), L("사무동", "事務棟", "Office wing"), L("별관", "別館", "Annex")] },
  shift: { name: L("근무조", "勤務班", "Shift"), v: [L("오전조", "午前班", "Morning"), L("오후조", "午後班", "Afternoon"), L("야간조", "夜間班", "Night")] },
  perm: { name: L("계정 권한", "アカウント権限", "Account level"), v: [L("일반", "一般", "Basic"), L("편집", "編集", "Editor"), L("관리", "管理", "Admin")] },
};
const AK = Object.keys(ATTRS);
const SRC = { access: { ic: "💻", r: 3, n: L("서버 접속 기록", "サーバー接続記録", "Server access log"), a: "device", t: L("범행은 [{v}]에서 이뤄졌다.", "犯行は[{v}]で行われた。", "It was done from a [{v}].") }, door: { ic: "🚪", r: 3, n: L("출입 기록", "入退室記録", "Door access log"), a: "zone", t: L("그 시각 [{v}] 출입증이 찍혔다.", "その時刻に[{v}]の入館証が記録された。", "A [{v}] badge was logged at that time.") }, cctv: { ic: "📹", r: 2, n: L("가상 CCTV", "仮想CCTV", "Virtual CCTV"), a: "shift", t: L("화면 속 인물은 [{v}] 복장이었다.", "映像の人物は[{v}]の服装だった。", "The figure on screen wore [{v}] shift gear.") }, gear: { ic: "🎛️", r: 3, n: L("송출 장비 기록", "送出機材記録", "Equipment log"), a: "perm", t: L("작업은 [{v}] 권한으로 실행됐다.", "作業は[{v}]権限で実行された。", "The action ran with [{v}] permission.") },
  witness: { ic: "👁️", r: 1, n: L("목격자 증언", "目撃証言", "Witness statement"), t: L("목격자: '{a:은} [{v}]였던 것 같아요.'", "目撃者：「{a}は[{v}]だったと思います」", "Witness: 'I think the {a} was [{v}].'") }, tip: { ic: "✉️", r: 1, n: L("익명 제보", "匿名情報", "Anonymous tip"), t: L("익명: '{a:은} [{v}]임. 확실함.'", "匿名：「{a}は[{v}]。確実」", "Anon: 'The {a} was [{v}]. Sure of it.'") }, chat: { ic: "💬", r: 2, n: L("업무 채팅 로그(허구)", "業務チャットログ（架空）", "Work chat log (fictional)"), t: L("로그 일부: {a} 항목에 [{v}]라고 적혀 있다.", "ログの一部：{a}の項目に[{v}]とある。", "Log excerpt: {a} entry reads [{v}].") }, memo: { ic: "📄", r: 2, n: L("내부 메모", "内部メモ", "Internal memo"), t: L("메모: {a:은} [{v}] 또는 [{w}] 중 하나로 보임.", "メモ：{a}は[{v}]か[{w}]のどちらか。", "Memo: {a} seems to be [{v}] or [{w}].") }, trace: { ic: "🧩", r: 3, n: L("은폐 시도 흔적", "隠蔽未遂の痕跡", "Trace of a cover-up"), t: L("누군가 수사를 방해하다 남긴 흔적: {a:은} [{v}].", "誰かが捜査妨害で残した痕跡：{a}は[{v}]。", "Someone slipped while interfering: {a} was [{v}].") }, ip: { ic: "🌐", r: 1, n: L("외부 접속 흔적", "外部接続の痕跡", "External connection trace"), t: L("사내 장비 목록에 없는 주소가 함께 잡혔다. 우회일 수도, 외부인일 수도 있다.", "社内機器一覧にないアドレスも検出。迂回か外部か。", "An address outside the staff list appeared. Could be a VPN, could be an outsider.") } };
const ROLE_BONUS = { tech: "device", finance: "perm", pr: "zone", legal: "perm", pd: "shift" };
export const QUESTIONS = { where: L("그 시간 어디에 있었죠?", "その時間どこにいましたか？", "Where were you at that time?"), who: L("누구와 함께 있었죠?", "誰と一緒でしたか？", "Who were you with?"), did: L("이 사건과 관련 있나요?", "この事件と関係ありますか？", "Are you connected to this case?") };
export const ANSWERS = { deny: L("아닙니다. 기록 보세요.", "違います。記録を見てください。", "No. Check the logs."), truth: L("사실대로 말할게요. 기록대로입니다.", "正直に言います。記録の通りです。", "I'll be straight: it's as logged."), refuse: L("답하지 않겠습니다.", "答えません。", "I won't answer.") };

const own = (o, k) => typeof k === "string" && Object.prototype.hasOwnProperty.call(o, k);
const shuffled = (a, R) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = R.int(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** 사건 시작: 범인·공범·근무 기록·증거 묶음을 서버에서 만듦 */
export function makeCase(g, def, opts = {}) {
  const R = g.R, seats = g.seats.filter((s) => !s.left), scale = 1 + Math.min(1.25, g.crimeChain * 0.25);
  const ex = opts.exclude || new Set(), recent = g.lastCulprits || [];
  const outsider = !opts.forceInsider && R.chance(0.26); let culprit = null, accomplice = null;
  if (!outsider) {
    const humans = seats.filter((s) => s.human).length; const pool = seats.filter((s) => !ex.has(s.seat)).filter((s) => humans > 1 || !s.human);
    const w = (s) => (recent.includes(s.seat) ? 0.25 : 1) * (s.human && humans >= 3 ? 2.4 : 1) * (s.spy ? 1.3 : 1);
    culprit = R.weighted(pool.length ? pool : seats, w)?.seat ?? seats[0].seat;
    if (seats.length >= 6 && humans >= 4 && R.chance(0.4)) accomplice = R.pick(seats.filter((s) => s.seat !== culprit && (s.human || humans < 6)))?.seat ?? null;
  }
  // 근무 기록: 단서 하나로는 두 명 이상 남고, 전부 모으면 범인 하나(외부인이면 0명)
  // 조건을 다 만족할 때까지 다시 뽑음
  let attrs, target; const others = seats.filter((s) => s.seat !== culprit);
  for (let tries = 0; tries < 400; tries++) {
    attrs = {}; for (const s of seats) attrs[s.seat] = Object.fromEntries(AK.map((k) => [k, R.int(0, 2)]));
    target = outsider ? Object.fromEntries(AK.map((k) => [k, R.int(0, 2)])) : attrs[culprit];
    const fitsAll = (a) => AK.every((k) => a[k] === target[k]);
    if (others.some((s) => fitsAll(attrs[s.seat]))) continue;
    const minSame = outsider ? 2 : 1; if (others.length >= 2 && !AK.every((k) => others.filter((s) => attrs[s.seat][k] === target[k]).length >= minSame)) continue;
    break;
  }
  // 증거 4~8개
  const ev = []; let nid = 1; const add = (src, attr, val, kind, extra = {}) => { const x = { id: nid++, src, attr, val, kind, by: new Set(), shared: false, ...extra }; ev.push(x); return x; };
  const reliable = { device: "access", zone: "door", shift: "cctv", perm: "gear" };
  const count = Math.min(8, Math.max(5, Math.round(seats.length * 0.6) + 2));
  for (const k of shuffled(AK, R)) add(reliable[k], k, target[k], "true");
  const wrong = (k) => (target[k] + 1 + R.int(0, 1)) % 3;
  const k1 = R.pick(AK); add("memo", k1, target[k1], "partial", { w: wrong(k1) });
  const k2 = R.pick(AK.filter((x) => x !== k1)); add(R.chance(0.5) ? "tip" : "witness", k2, wrong(k2), "misleading");
  if (outsider) add("ip", null, null, "true"); else if (R.chance(0.35)) add("ip", null, null, "misleading");
  while (ev.length < count) { const k = R.pick(AK); if (R.chance(0.5)) add("witness", k, wrong(k), "misleading"); else add("chat", k, target[k], "true"); }
  const c = { def, id: def.id, day: g.day, outsider, culprit, accomplice, attrs, target, ev: shuffled(ev, R), nid, points: {}, alibi: {}, checks: [], asks: [], votes: {}, finals: {}, used: {}, offers: [], scale, accused: null, defense: null, confessed: null, betrayed: null, covered: false, reopen: !!opts.reopen, exclude: ex, wrongPrev: opts.wrongPrev ?? null, seq: 1 };
  for (const s of seats) { c.points[s.seat] = 2 + (seats.length >= 10 ? 1 : 0); c.used[s.seat] = {}; }
  // 진짜 행동 기록: 범인은 사건 장소에 있었다
  c.real = {}; for (const s of seats) { const act = g.lastAction?.[s.seat]; const loc = s.seat === culprit ? def.loc : (act?.loc || "lounge"); const pals = seats.filter((o) => o.seat !== s.seat && (g.lastAction?.[o.seat]?.loc === loc)); c.real[s.seat] = { loc, act: act?.id || "rest", with: s.seat === culprit ? null : pals[0]?.seat ?? null }; }
  return c;
}

export function evText(e) { const S = SRC[e.src]; const A = e.attr ? ATTRS[e.attr] : null; return { src: S.n, ic: S.ic, r: S.r, t: S.t, vars: A ? { a: A.name, v: A.v[e.val], w: e.w != null ? A.v[e.w] : undefined } : {}, attr: e.attr || null, val: e.val ?? null, alt: e.w ?? null }; }
function addTrace(c, g, attr) { const k = attr || AK.filter((x) => c.target[x] != null)[g.R.int(0, 3)]; const e = { id: c.nid++, src: "trace", attr: k, val: c.target[k], kind: "true", by: new Set(), shared: true }; c.ev.push(e); return e; }
const isCrook = (c, seat) => c.culprit === seat || c.accomplice === seat;

/** 플레이어 행동. 모든 판정은 여기서. error 반환 시 상태 변화 없음 */
export function crimeAct(g, s, type, p) {
  const c = g.crime; if (!c) return { error: "NO_CASE" }; const ph = g.phase.name, seat = s.seat;
  const need = (...n) => n.includes(ph);
  const coin = (n) => { if (s.coin < n) return false; s.coin -= n; return true; };
  const once = (k, n = 1) => { const u = c.used[seat]; u[k] = (u[k] || 0) + 1; return u[k] <= n; };
  switch (type) {
    case "c_inspect": { if (!need("crime_collect")) return { error: "PHASE" }; const e = c.ev.find((x) => x.id === +p.ev); if (!e) return { error: "NO_EV" }; if (e.by.has(seat)) return { ok: 1 }; if ((c.points[seat] || 0) <= 0) return { error: "NO_POINTS" }; c.points[seat]--; e.by.add(seat); return { ok: 1 }; }
    case "c_share": { if (!need("crime_collect", "crime_ask", "crime_debate")) return { error: "PHASE" }; const e = c.ev.find((x) => x.id === +p.ev); if (!e || !e.by.has(seat)) return { error: "NOT_SEEN" }; if (!e.shared) { e.shared = true; e.sharer = seat; g.score(seat, "share", 1); } return { ok: 1 }; }
    case "c_alibi": { if (!need("crime_collect", "crime_ask")) return { error: "PHASE" }; const real = c.real[seat]; if (p.truth) { c.alibi[seat] = { loc: real.loc, act: real.act, with: real.with, lie: false }; return { ok: 1 }; } if (!own(LOCATIONS, p.loc)) return { error: "BAD_LOC" }; const w = p.with == null ? null : +p.with; if (w != null && !g.seats[w]) return { error: "BAD_SEAT" }; c.alibi[seat] = { loc: p.loc, act: real.act, with: w, lie: p.loc !== real.loc || w !== real.with }; return { ok: 1 }; }
    case "c_check": { if (!need("crime_ask", "crime_debate")) return { error: "PHASE" }; const t = +p.target, tg = g.seats[t]; if (!tg || t === seat) return { error: "BAD_SEAT" }; const al = c.alibi[t]; if (!al) return { error: "NO_ALIBI" }; if (c.checks.some((x) => x.by === seat && x.target === t)) return { error: "DONE" }; if (!once("check", 2 + (g.seats.length >= 10 ? 1 : 0))) return { error: "LIMIT" };
      let verdict; if (al.lie) { const covered = c.covered && isCrook(c, t); const catchP = covered ? 0.3 : 0.72; verdict = g.R.chance(catchP) ? "clash" : g.R.chance(0.5) ? "unknown" : "match"; } else verdict = g.R.chance(0.86) ? "match" : "unknown"; c.checks.push({ by: seat, target: t, verdict }); return { ok: 1 }; }
    case "c_ask": { if (!need("crime_ask")) return { error: "PHASE" }; const t = +p.target; if (!g.seats[t] || t === seat || !own(QUESTIONS, p.q)) return { error: "BAD" }; if (!once("ask", 2)) return { error: "LIMIT" }; const a = { id: c.seq++, by: seat, target: t, q: p.q, a: null }; c.asks.push(a); if (!g.seats[t].human || g.seats[t].away) g.npcAnswer(a); return { ok: 1 }; }
    case "c_answer": { if (!need("crime_ask", "crime_debate")) return { error: "PHASE" }; const a = c.asks.find((x) => x.id === +p.id && x.target === seat && !x.a); if (!a || !own(ANSWERS, p.a)) return { error: "BAD" }; a.a = p.a; if (isCrook(c, seat) && p.a === "deny" && g.R.chance(0.22)) addTrace(c, g); return { ok: 1 }; }
    case "c_vote": { if (!need("crime_vote")) return { error: "PHASE" }; const v = p.v === "out" || p.v === "none" ? p.v : +p.v; if (typeof v === "number" && (!g.seats[v] || g.seats[v].left)) return { error: "BAD" }; if (c.votes[seat] !== undefined) return { error: "VOTED" }; c.votes[seat] = v; return { ok: 1 }; }
    case "c_defend": { if (!need("crime_defense") || c.accused !== seat) return { error: "PHASE" }; if (c.defense) return { error: "DONE" }; const e = c.ev.find((x) => x.id === +p.ev && x.by.has(seat)); if (e) e.shared = true; c.defense = { kind: ["alibi", "evidence", "framed", "plead"].includes(p.kind) ? p.kind : "plead", ev: e?.id ?? null }; return { ok: 1 }; }
    case "c_final": { if (!need("crime_final")) return { error: "PHASE" }; if (seat === c.accused) return { error: "ACCUSED" }; if (c.finals[seat] !== undefined) return { error: "VOTED" }; c.finals[seat] = p.v === "guilty" ? "guilty" : "innocent"; return { ok: 1 }; }
    // ---------- 범인·공범 비밀 행동 ----------
    case "c_frame": { if (!isCrook(c, seat) || !need("crime_collect", "crime_ask")) return { error: "DENIED" }; const t = +p.target; if (!g.seats[t] || t === c.culprit) return { error: "BAD_SEAT" }; if ((c.used[seat].frame || 0) >= 1) return { error: "LIMIT" }; if (s.coin < 40) return { error: "COIN" }; once("frame"); coin(40); const cand = AK.filter((k) => c.attrs[t][k] !== c.target[k]); if (g.R.chance(0.62) && cand.length) { const k = g.R.pick(cand); c.ev.push({ id: c.nid++, src: g.R.chance(0.5) ? "tip" : "witness", attr: k, val: c.attrs[t][k], kind: "misleading", by: new Set(), shared: false, planted: seat }); return { ok: 1, result: "planted" }; } addTrace(c, g); return { ok: 1, result: "slip" }; }
    case "c_hide": { if (!isCrook(c, seat) || !need("crime_collect", "crime_ask")) return { error: "DENIED" }; const e = c.ev.find((x) => x.id === +p.ev); if (!e || e.shared) return { error: "BAD_EV" }; if ((c.used[seat].hide || 0) >= 1) return { error: "LIMIT" }; if (s.coin < 60) return { error: "COIN" }; once("hide"); coin(60); if (g.R.chance(0.55)) { c.ev = c.ev.filter((x) => x !== e); return { ok: 1, result: "hidden" }; } addTrace(c, g); return { ok: 1, result: "slip" }; }
    case "c_obstruct": { if (!isCrook(c, seat) || !need("crime_collect")) return { error: "DENIED" }; if ((c.used[seat].obstruct || 0) >= 1) return { error: "LIMIT" }; if (s.coin < 50) return { error: "COIN" }; once("obstruct"); coin(50); if (g.R.chance(0.5)) { for (const k in c.points) if (+k !== seat && c.points[k] > 1) c.points[k]--; return { ok: 1, result: "slowed" }; } addTrace(c, g); return { ok: 1, result: "slip" }; }
    case "c_help": { if (seat !== c.culprit || c.accomplice == null || !need("crime_collect", "crime_ask", "crime_debate")) return { error: "DENIED" }; if (!once("help")) return { error: "LIMIT" }; c.points[c.accomplice] = (c.points[c.accomplice] || 0) + 1; g.privateNote(c.accomplice, L("범인이 도움을 요청했습니다. 조사 기회 +1", "犯人が助けを求めました。調査機会+1", "The culprit asked for help. +1 inspection")); return { ok: 1 }; }
    case "c_cover": { if (seat !== c.accomplice || !need("crime_collect", "crime_ask", "crime_debate")) return { error: "DENIED" }; if (!once("cover")) return { error: "LIMIT" }; c.covered = true; return { ok: 1 }; }
    case "c_offer": { if (!isCrook(c, seat) || !need("crime_ask", "crime_debate")) return { error: "DENIED" }; const t = +p.target, amt = Math.max(20, Math.min(200, p.coin | 0)); if (!g.seats[t] || t === seat) return { error: "BAD_SEAT" }; if ((c.used[seat].offer || 0) >= 2) return { error: "LIMIT" }; if (s.coin < amt) return { error: "COIN" }; once("offer", 2); const o = { id: c.seq++, from: seat, to: t, coin: amt, st: null }; c.offers.push(o); if (!g.seats[t].human || g.seats[t].away) g.npcOffer(o); return { ok: 1 }; }
    case "c_reply": { const o = c.offers.find((x) => x.id === +p.id && x.to === seat && !x.st); if (!o) return { error: "BAD" }; if (p.accept) { const f = g.seats[o.from]; if (f.coin < o.coin) { o.st = "void"; return { ok: 1 }; } f.coin -= o.coin; s.coin += o.coin; o.st = "ok"; if (g.R.chance(0.3)) addTrace(c, g); g.score(seat, "bribed", 1); } else { o.st = "no"; if (g.R.chance(0.25)) { const k = g.R.pick(AK); g.privateNote(seat, L("거래를 제안한 사람의 {a}: {v}", "取引を持ちかけた者の{a}：{v}", "The person who offered the deal: {a} = {v}"), { a: ATTRS[k].name, v: ATTRS[k].v[c.attrs[o.from][k]] }); } } return { ok: 1 }; }
    case "c_betray": { if (seat !== c.accomplice || !need("crime_ask", "crime_debate", "crime_vote")) return { error: "DENIED" }; if (c.betrayed != null) return { error: "DONE" }; c.betrayed = seat; g.highlight("betray", { a: seat, b: c.culprit, size: 40 }); return { ok: 1, endCase: "betray" }; }
    case "c_confess": { if (!isCrook(c, seat) || !need("crime_collect", "crime_ask", "crime_debate", "crime_vote", "crime_defense", "crime_final")) return { error: "DENIED" }; if (c.confessed != null) return { error: "DONE" }; c.confessed = seat; return { ok: 1, endCase: "confess" }; }
    default: return { error: "BAD_TYPE" };
  }
}

/** 공유 게시판 단서로 후보 좁히기 (NPC 추리·시험 정책 공용) */
export function deduce(c, seats, clues) {
  const by = {}; for (const e of clues) { if (e.attr == null) continue; const w = SRC[e.src].r; by[e.attr] = by[e.attr] || []; by[e.attr].push({ v: e.val, alt: e.w, w }); }
  const pick = {}; for (const k in by) { const sc = {}; for (const x of by[k]) { sc[x.v] = (sc[x.v] || 0) + x.w; if (x.alt != null) sc[x.alt] = (sc[x.alt] || 0) + x.w; } pick[k] = sc; }
  const score = (s) => { let v = 0, miss = 0; for (const k in pick) { const best = Math.max(...Object.values(pick[k])), mine = pick[k][c.attrs[s.seat][k]] || 0; if (mine >= best) v += 1; else miss++; } return { v, miss }; };
  const full = seats.filter((s) => score(s).miss === 0); const n = Object.keys(pick).length;
  return { n, full };
}

export function crimeResult(g) {
  const c = g.crime, out = { kind: null, culprit: c.culprit, accomplice: c.accomplice, outsider: c.outsider, accused: c.accused, verdict: null };
  if (c.confessed != null) out.kind = "confess"; else if (c.betrayed != null) out.kind = "betray"; else if (c.verdict === "out") out.kind = c.outsider ? "out_right" : "out_wrong"; else if (c.verdict === "guilty") out.kind = c.accused === c.culprit || c.accused === c.accomplice ? "caught" : c.outsider ? "false_out" : "false"; else out.kind = c.outsider ? "hung_out" : "hung";
  return out;
}
