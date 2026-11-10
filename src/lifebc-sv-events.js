// 방송국 서바이벌 — 긴급 사건·마지막 기회·복합 비상사태. 판정은 lifebc-sv-core.js. 모든 인물·회사는 게임 속 허구.
import { L } from "./lifebc-sv-data.js";

// 모두가 참여: 사건을 맡은 역할(lead)은 사건 전용 선택, 나머지는 역할별 대응. 사건마다 fit으로 맞고 틀림이 다름
export const PALETTE = {
  director: [["official", L("공식 사과·입장 발표", "公式謝罪・見解発表", "Official statement")], ["hold", L("입장 유보", "見解保留", "Hold position")], ["hardline", L("강경 대응", "強硬対応", "Hard line")]],
  pd: [["push", L("방송 강행", "放送強行", "Push on")], ["halt", L("방송 중단", "放送中断", "Halt broadcast")], ["swap", L("대체 편성", "代替編成", "Swap lineup")]],
  pr: [["spin", L("여론 적극 대응", "世論に積極対応", "Engage the public")], ["factcheck", L("사실 확인 먼저", "事実確認を先に", "Fact-check first")], ["quiet", L("조용히 넘기기", "静かにやり過ごす", "Keep it quiet")]],
  finance: [["inject", L("긴급 자금 투입 (-120)", "緊急資金投入 (-120)", "Inject funds (-120)")], ["freeze", L("지출 동결", "支出凍結", "Freeze spending")]],
  tech: [["fix", L("긴급 복구", "緊急復旧", "Emergency repair")], ["bypass", L("우회 송출", "迂回送出", "Bypass route")]],
  legal: [["lawyer", L("법적 검토", "法的検討", "Legal review")], ["settle", L("합의 추진 (-80)", "和解推進 (-80)", "Push settlement (-80)")]],
  writer: [["rewrite", L("대본·문구 수정", "台本・文言修正", "Rewrite copy")], ["stall", L("시간 벌기", "時間稼ぎ", "Buy time")]],
  hr: [["calm", L("출연진 달래기", "出演者をなだめる", "Calm the cast")], ["shield", L("출연진 보호", "出演者を守る", "Shield the cast")]],
  cast: [["apologize", L("직접 사과", "直接謝罪", "Apologize")], ["explain", L("직접 해명", "直接釈明", "Explain")], ["silent", L("침묵", "沈黙", "Stay silent")]],
};
export const CONFLICTS = [["official", "hardline"], ["official", "silent"], ["hardline", "apologize"], ["push", "halt"], ["push", "fix"], ["quiet", "spin"], ["apologize", "explain"], ["freeze", "inject"], ["settle", "hardline"]];

const list = [];
const E = (id, group, lead, o) => list.push({ id, group, lead, w: 1, min: 2, max: 30, cd: 8, ...o });
const roll = (k, th, good, bad, o) => ({ k, th, good, bad, ...o });

// ---------- 방송 사고 ----------
E("mic", "accident", "pd", { n: L("생방송 마이크 사고", "生放送マイク事故", "Hot Mic Accident"), s: L("광고 시간에 꺼졌어야 할 마이크로 출연진의 험담이 그대로 나갔다.", "CM中に切れるはずのマイクで出演者の陰口が流れた。", "A mic that should be off aired cast members' gossip."), fit: { official: 1, apologize: 1, halt: 1, push: -1, silent: -1, fix: 1, quiet: -1, shield: 1 }, ch: [
  [L("즉시 사과 후 재개", "即謝罪して再開", "Apologize and resume"), { trust: -3, ctrv: 6 }, L("빠른 사과로 번지는 건 막았다.", "素早い謝罪で拡大は防いだ。", "A quick apology contained it.")],
  [L("웃음으로 넘기기", "笑ってごまかす", "Laugh it off"), {}, L("넘어갈 수도, 터질 수도 있었다.", "流れるか爆発するか。", "It could pass or blow up."), { roll: roll("trust", 58, { rating: 3, ctrv: 3 }, { trust: -9, ctrv: 16 }, { nextBad: ["sponsor_angry", 2] }) }],
  [L("문제 구간 삭제", "問題箇所を削除", "Delete the segment"), { stab: -2 }, L("삭제가 더 큰 의심을 샀을지 모른다.", "削除がさらなる疑いを呼んだかも。", "Deleting may have raised more suspicion."), { risk: { fans: 2 }, next: ["clip_spread", 2] }] ] });
E("server", "accident", "tech", { n: L("송출 서버 장애", "送出サーバー障害", "Broadcast Server Down"), s: L("메인 서버가 내려갔다. 화면이 멈추고 항의 전화가 쏟아진다.", "メインサーバーがダウン。画面が止まり抗議電話が殺到。", "The main server is down. The picture froze and complaints flood in."), when: (g) => g.m.stab < 70 || g.risk.maint > 0, w: 2, tech: 1, fit: { fix: 2, bypass: 1, push: -1, halt: 1, inject: 1, freeze: -1, spin: 1 }, ch: [
  [L("비싸도 전면 복구 (-420)", "高くても全面復旧 (-420)", "Full repair (-420)"), { money: -420, stab: 14 }, L("복구됐지만 통장이 얇아졌다.", "復旧したが資金は減った。", "Repaired, at a price."), { clear: { maint: 3 } }],
  [L("임시 패치 (-120)", "臨時パッチ (-120)", "Quick patch (-120)"), { money: -120 }, L("일단은 돌아간다. 일단은.", "とりあえず動く。とりあえず。", "It runs. For now."), { roll: roll("stab", 50, { stab: 3 }, { stab: -9, rating: -4 }), risk: { maint: 2 } }],
  [L("재방송으로 시간 벌기", "再放送で時間稼ぎ", "Air reruns to buy time"), { rating: -7, stab: 3 }, L("시청률을 내주고 시간을 샀다.", "視聴率を捨て時間を買った。", "Traded ratings for time."), { risk: { maint: 1 } }] ] });
E("gear", "accident", "tech", { n: L("중요 방송 직전 장비 고장", "重要放送前の機材故障", "Gear Fails Before Big Show"), s: L("특집 생방 한 시간 전, 주 카메라와 스위처가 동시에 죽었다.", "特番1時間前、主カメラとスイッチャーが同時に故障。", "An hour before the special, main camera and switcher die together."), tech: 1, fit: { fix: 2, bypass: 1, swap: 1, push: -1, inject: 1 }, ch: [
  [L("장비 긴급 대여 (-300)", "機材緊急レンタル (-300)", "Rent gear fast (-300)"), { money: -300, stab: 5 }, L("간신히 큐 사인이 떨어졌다.", "何とかキューが出た。", "The cue came, barely.")],
  [L("스마트폰 생방 시도", "スマホ生放送に挑戦", "Try a phone live show"), {}, L("망하거나 전설이 되거나.", "失敗か伝説か。", "Disaster or legend."), { roll: roll("rating", 45, { rating: 9, trust: 3 }, { rating: -7, ctrv: 8, trust: -4 }) }],
  [L("특집 연기 공지", "特番延期を告知", "Postpone the special"), { rating: -5, ad: -5 }, L("광고주 표정이 굳었다.", "広告主の顔がこわばった。", "The sponsors frowned."), { next: ["sponsor_angry", 3] }] ] });
E("caption", "accident", "writer", { n: L("자막 오표기 대참사", "字幕誤記の大惨事", "Caption Catastrophe"), s: L("뉴스 자막에 전혀 다른 사람 이름이 범인처럼 나갔다.", "ニュース字幕に全く別人の名前が犯人のように出た。", "A news caption named the wrong person as if a criminal."), fit: { official: 2, rewrite: 1, settle: 1, lawyer: 1, quiet: -2, hold: -1 }, ch: [
  [L("정정 방송과 공개 사과", "訂正放送と公開謝罪", "Correction and public apology"), { trust: -2, ctrv: 2, rating: -2 }, L("뼈아프지만 깔끔했다.", "痛いがきれいだった。", "Painful but clean.")],
  [L("다음 회차에 슬쩍 정정", "次回にこっそり訂正", "Quietly fix next episode"), { ctrv: 4 }, L("누군가 이미 캡처했다.", "誰かがすでにキャプチャ済み。", "Someone already screenshotted it."), { risk: { fans: 2 }, roll: roll("ctrv", 35, {}, { trust: -7, ctrv: 11 }, { inv: 1 }) }],
  [L("외주사 탓으로 돌리기", "外注先のせいにする", "Blame the vendor"), { ctrv: 3, unity: -4 }, L("외주사가 내부 메일을 들고 왔다.", "外注先が内部メールを持ってきた。", "The vendor showed up with internal mail."), { next: ["lawsuit", 3] }] ] });
E("blackout", "accident", "tech", { n: L("생방 중 정전", "生放送中の停電", "Studio Blackout"), s: L("스튜디오 전체 전원이 나갔다. 비상 전원은 10분뿐이다.", "スタジオ全体が停電。非常電源は10分だけ。", "Studio power is gone. Backup lasts 10 minutes."), min: 6, when: (g) => g.m.stab < 55, w: 2, tech: 1, fit: { bypass: 2, fix: 1, halt: 1, push: -2, shield: 1, calm: 1 }, ch: [
  [L("외부 중계차로 전환 (-260)", "外部中継車に切替 (-260)", "Switch to OB van (-260)"), { money: -260, stab: 4 }, L("방송은 살렸다.", "放送は守った。", "The broadcast survived.")],
  [L("어둠 속 라디오 방송", "暗闇のラジオ放送", "Do a radio show in the dark"), {}, L("즉흥 쇼의 운은 결속에 달렸다.", "即興ショーは結束次第。", "An improv show lives on team unity."), { roll: roll("unity", 50, { rating: 6, trust: 4, unity: 3 }, { rating: -6, fat: 6, ctrv: 4 }) }],
  [L("오늘 방송 포기", "今日の放送を断念", "Give up today's show"), { rating: -8, ad: -5, trust: -3, stab: 6 }, L("안전했지만 잃은 것이 많다.", "安全だが失うものは多い。", "Safe, but costly.")] ] });
E("hack", "accident", "tech", { n: L("방송 계정 해킹", "放送アカウントのハッキング", "Station Account Hacked"), s: L("공식 계정에 이상한 광고글이 도배되고 있다.", "公式アカウントに怪しい広告が連投されている。", "The official account is spamming shady ads."), min: 4, tech: 1, fit: { fix: 1, factcheck: 1, spin: 1, official: 1, quiet: -1, hold: -1 }, ch: [
  [L("계정 잠그고 전면 점검 (-160)", "ロックして全面点検 (-160)", "Lock it and audit (-160)"), { money: -160, stab: 3, trust: -1 }, L("피해 범위가 좁아졌다.", "被害範囲が狭まった。", "Damage narrowed.")],
  [L("팔로워에게 먼저 공지", "フォロワーに先に告知", "Warn followers first"), { trust: 2, ctrv: 4 }, L("솔직함이 통할지는 여론에 달렸다.", "正直さが通じるかは世論次第。", "Honesty depends on the mood."), { roll: roll("trust", 45, { trust: 4, ctrv: -4 }, { ctrv: 7, ad: -4 }) }],
  [L("조용히 글만 삭제", "静かに投稿だけ削除", "Quietly delete posts"), {}, L("누군가는 이미 당했다.", "すでに被害者がいた。", "Someone already fell for it."), { risk: { fans: 1, maint: 1 }, next: ["clip_spread", 3] }] ] });
// ---------- 인간관계 ----------
E("quit", "people", "hr", { n: L("출연진 돌발 하차 선언", "出演者の突然の降板宣言", "Cast Member Quits Suddenly"), s: L("간판 출연자가 방송 직전 하차를 선언했다. 스케줄과 처우가 이유다.", "看板出演者が放送直前に降板宣言。スケジュールと待遇が理由。", "A star declares they quit right before air, citing hours and pay."), when: (g) => g.m.fat > 42 || g.risk.grudge > 0 || g.m.unity < 50, w: 2, fit: { calm: 2, shield: 1, inject: 1, hardline: -2, push: -1, swap: 1 }, ch: [
  [L("출연료 인상 (-280)", "出演料アップ (-280)", "Raise pay (-280)"), { money: -280, unity: 3, fat: -3 }, L("남았다. 다른 사람들도 그걸 봤다.", "残った。他の皆もそれを見た。", "They stayed, and everyone noticed."), { risk: { grudge: 1 } }],
  [L("직접 찾아가 대화", "直接会って話す", "Talk in person"), { fat: 1 }, L("진심이 통할지는 팀 분위기에 달렸다.", "本気が届くかはチームの空気次第。", "Sincerity depends on the mood."), { roll: roll("unity", 45, { unity: 7, fat: -6 }, { unity: -6, rating: -6 }, { nextBad: ["walkout_talk", 2] }) }],
  [L("그냥 보내고 대체 투입", "そのまま代役投入", "Let them go, use a stand-in"), { rating: -9, unity: -5, money: 90 }, L("빈자리는 생각보다 컸다.", "穴は思ったより大きい。", "The gap was bigger than expected.")] ] });
E("feud", "people", "hr", { n: L("출연진 정면 충돌", "出演者の正面衝突", "Cast Feud Erupts"), s: L("생방 직전 대기실에서 고성이 터졌다. 스태프가 뜯어말리는 중.", "放送前の控室で怒号。スタッフが止めに入っている。", "Shouting in the green room right before air. Staff pulling them apart."), when: (g) => g.m.unity < 62, fit: { calm: 2, shield: 1, swap: 1, push: -1, hold: 1, hardline: -1 }, ch: [
  [L("각자 따로 면담", "個別に面談", "Mediate separately"), { unity: 5, fat: 2 }, L("큰 불은 껐다.", "大火は消した。", "The big fire is out.")],
  [L("촬영 분리 편성", "撮影を分離", "Separate their shoots"), { rating: -4, money: -100, unity: 1 }, L("서로 안 마주치니 일은 된다.", "顔を合わせなければ仕事は進む。", "No contact, work proceeds.")],
  [L("갈등을 방송 소재로", "対立を放送ネタに", "Air the feud as content"), { rating: 7, ctrv: 9, unity: -7 }, L("시청률은 튀었고 관계는 금 갔다.", "視聴率は跳ね、関係にひびが入った。", "Ratings jumped; relations cracked."), { risk: { grudge: 2 } }] ] });
E("chatleak", "people", "pr", { n: L("내부 채팅 유출", "内部チャット流出", "Internal Chat Leaked"), s: L("스태프끼리 나눈 출연자 뒷담화 캡처가 커뮤니티에 올라왔다. (게임 속 허구)", "スタッフの出演者陰口キャプチャが掲示板に。（ゲーム内の架空）", "Screenshots of staff trashing cast hit forums. (in-game fiction)"), when: (g) => g.day >= 5, fit: { official: 1, calm: 1, factcheck: 1, apologize: 1, quiet: -1, hardline: -1, shield: 1 }, ch: [
  [L("당사자 공개 사과", "当事者が公開謝罪", "Those involved apologize"), { trust: 2, unity: -3, ctrv: -3 }, L("상처는 남았지만 공기는 풀렸다.", "傷は残ったが空気は和らいだ。", "Scars remain, tension eases.")],
  [L("유출자부터 색출", "流出者の特定を優先", "Hunt the leaker first"), { unity: -6, ctrv: 4 }, L("모두가 서로를 쳐다보기 시작했다.", "皆が互いを見始めた。", "Everyone started eyeing each other."), { crime: 1 }],
  [L("조작이라고 주장", "捏造だと主張", "Claim it's fake"), {}, L("진짜라는 게 들통날 수도 있다.", "本物と発覚するかも。", "It may be exposed as real."), { roll: roll("trust", 60, { ctrv: -2 }, { trust: -11, ctrv: 14 }, { nextBad: ["sponsor_angry", 2] }) }] ] });
E("staffout", "people", "director", { n: L("핵심 스태프 이탈", "主要スタッフの離脱", "Key Staff Walk Out"), s: L("촬영감독과 메인 편집자가 사표를 던졌다. 경쟁사로 간다는 말도 돈다.", "撮影監督とメイン編集者が辞表を提出。競合へ行くとの噂。", "Camera lead and head editor quit; rumor says they're going to the rival."), when: (g) => g.risk.unpaid > 0 || g.m.unity < 48, w: 2, fit: { inject: 2, calm: 1, settle: 1, hardline: -1, freeze: -2 }, ch: [
  [L("밀린 수당과 보너스 (-340)", "未払いとボーナス (-340)", "Pay arrears and bonus (-340)"), { money: -340, unity: 8, stab: 2 }, L("돈이 말을 했다.", "金がものを言った。", "Money talked."), { clear: { unpaid: 2 } }],
  [L("보내주고 인턴 승격", "送り出してインターン昇格", "Let go, promote interns"), { stab: -7, rating: -3, money: 60 }, L("다음 사고의 씨앗이 뿌려졌다.", "次の事故の種がまかれた。", "Seeds of the next accident."), { risk: { maint: 2 } }],
  [L("경쟁사 이직 금지 소송", "競合移籍禁止の訴訟", "Sue to block the move"), { money: -120, ctrv: 6, unity: -3 }, L("이겨도 평판은 진다.", "勝っても評判は負ける。", "Win or lose, reputation loses."), { next: ["lawsuit", 3] }] ] });
E("overwork", "people", "hr", { n: L("출연진 과로 쓰러짐", "出演者が過労で倒れる", "Cast Member Collapses"), s: L("촬영 중 출연자가 쓰러졌다. 영상은 이미 퍼지고 있다.", "撮影中に出演者が倒れた。映像はすでに拡散中。", "A cast member collapsed on set. The clip is already spreading."), when: (g) => g.m.fat > 58, w: 3, fit: { shield: 2, calm: 1, official: 1, halt: 1, push: -2, silent: -1 }, ch: [
  [L("3일 전면 휴방", "3日間全面休止", "Three-day full break"), { fat: -24, rating: -8, ad: -3, money: -60 }, L("모두가 숨을 돌렸다.", "皆が息をついた。", "Everyone caught their breath.")],
  [L("당사자만 쉬게 하고 진행", "本人だけ休ませ続行", "Rest them, keep going"), { fat: -6, trust: -3 }, L("남은 사람의 눈빛이 달라졌다.", "残った者の目つきが変わった。", "The rest looked at you differently."), { risk: { grudge: 1 } }],
  [L("괜찮다고 발표", "大丈夫と発表", "Announce they're fine"), { ctrv: 6 }, L("거짓말이면 값이 커진다.", "嘘なら代償は大きい。", "If false, the cost grows."), { roll: roll("fat", 45, {}, { trust: -11, ctrv: 12, unity: -5 }, { inv: 1, nextBad: ["walkout_talk", 2] }) }] ] });
E("walkout_talk", "people", "director", { n: L("집단 이탈 모의", "集団離脱の相談", "Walkout Being Plotted"), s: L("출연진 다수가 같이 나가자는 단체 대화방을 만들었다는 보고다.", "出演者多数が一緒に辞める相談をしているとの報告。", "Reports say most of the cast are organizing to leave together."), chainOnly: 1, fit: { calm: 2, inject: 1, shield: 2, official: 1, hardline: -2, push: -1 }, ch: [
  [L("전원 면담과 처우 개선 (-380)", "全員面談と待遇改善 (-380)", "Meet all, better terms (-380)"), { money: -380, unity: 12, fat: -8 }, L("한 명씩 다시 자리에 앉았다.", "一人ずつ席に戻った。", "One by one, they sat back down."), { clear: { grudge: 2 } }],
  [L("주동자만 설득", "主導者だけ説得", "Persuade the ringleader"), {}, L("주동자의 마음은 관계에 달렸다.", "主導者の心は関係次第。", "Depends on the relationship."), { roll: roll("unity", 42, { unity: 8, fat: -4 }, { unity: -10, rating: -7 }) }],
  [L("나갈 테면 나가라", "出ていくなら出ていけ", "Let them leave"), { unity: -14, rating: -7 }, L("문이 쾅 닫혔다.", "ドアがバタンと閉まった。", "The door slammed.")] ] });
E("favor", "people", "director", { n: L("특혜 논란 내부 폭발", "特恵論争の内部爆発", "Favoritism Blowup"), s: L("특정 출연자만 황금 시간대를 받는다는 불만이 터졌다.", "特定の出演者だけが好時間帯との不満が爆発。", "Complaints erupt: only one star gets prime time."), when: (g) => g.m.unity < 66, fit: { calm: 1, official: 1, swap: 2, hold: -1, hardline: -1 }, ch: [
  [L("편성 공개 기준 도입", "編成基準を公開", "Publish scheduling rules"), { unity: 7, rating: -3 }, L("불만은 줄었지만 스타는 삐쳤다.", "不満は減ったがスターは拗ねた。", "Fewer gripes, but the star sulks.")],
  [L("지금 구조 유지", "現状維持", "Keep things as they are"), { rating: 3, unity: -6 }, L("시청률이 답이라고 말했다.", "視聴率が答えだと言った。", "You said ratings are the answer."), { risk: { grudge: 2 } }],
  [L("추가 수당으로 무마 (-200)", "追加手当で収める (-200)", "Pay it away (-200)"), { money: -200, unity: 3 }, L("돈으로 시간을 샀다.", "金で時間を買った。", "Bought time with money.")] ] });
// ---------- 여론 ----------
E("expose", "opinion", "pr", { n: L("방송 중 공개 폭로", "放送中の公開暴露", "On-Air Exposé"), s: L("게스트가 생방 도중 방송국 내부 문제를 폭로하기 시작했다.", "ゲストが生放送中に局の内部問題を暴露し始めた。", "A guest starts exposing the station's internal issues live."), min: 5, fit: { halt: 1, factcheck: 2, official: 1, hardline: -1, push: -1, lawyer: 1, spin: 1 }, ch: [
  [L("끝까지 들은 뒤 사실 확인", "最後まで聞き事実確認", "Hear it out, then verify"), { trust: 4, ctrv: 6, ad: -3 }, L("용기 있단 말을 들었지만 광고주는 불안하다.", "勇気があると言われたが広告主は不安。", "Called brave; sponsors uneasy.")],
  [L("마이크를 끄고 광고로", "マイクを切ってCMへ", "Cut the mic, go to ads"), { ctrv: 12, trust: -6 }, L("'입막음' 태그가 올라왔다.", "「口封じ」タグが上がった。", "A #Silenced tag started trending."), { next: ["clip_spread", 1] }],
  [L("즉석 공개 토론 전환", "即席公開討論に切替", "Turn it into a live debate"), {}, L("여론의 신뢰가 판을 가른다.", "世論の信頼が左右する。", "Public trust decides this."), { roll: roll("trust", 50, { rating: 8, trust: 5, ctrv: -3 }, { rating: 3, ctrv: 12, unity: -4 }) }] ] });
E("clip_spread", "opinion", "pr", { n: L("악마의 편집 영상 확산", "悪意ある編集動画の拡散", "Malicious Edit Goes Viral"), s: L("방송 일부만 잘라 만든 영상이 수백만 조회수를 넘었다.", "放送の一部を切り取った動画が数百万再生を超えた。", "A misleading cut of the show tops millions of views."), chainOnly: 1, fit: { factcheck: 2, spin: 1, official: 1, quiet: -1, rewrite: 1, lawyer: 1 }, ch: [
  [L("원본 전체 공개", "原本を全公開", "Release the full footage"), { ctrv: -8, trust: 2, stab: -1 }, L("맥락이 알려지기 시작했다.", "文脈が伝わり始めた。", "Context began to spread."), { clear: { fans: 1 } }],
  [L("저작권 신고로 삭제", "著作権通報で削除", "Takedown by copyright"), { money: -60 }, L("지울수록 더 퍼질 수 있다.", "消すほど広がるかも。", "The more you delete, the more it may spread."), { roll: roll("ctrv", 45, { ctrv: -4 }, { ctrv: 11, trust: -5 }, { inv: 1 }) }],
  [L("무시", "無視", "Ignore it"), { ctrv: 5 }, L("며칠이면 식을까?", "数日で冷めるか？", "Will it cool in days?"), { risk: { fans: 2 } }] ] });
E("mass", "opinion", "director", { n: L("시청자 집단 항의", "視聴者の集団抗議", "Viewer Mass Protest"), s: L("시청자 게시판이 마비됐고 방송국 앞에 트럭 시위까지 왔다.", "視聴者掲示板が麻痺し局の前にトラックデモまで。", "The viewer board crashed and protest trucks arrived outside."), when: (g) => g.m.ctrv > 40 || g.risk.fans > 1, w: 3, fit: { official: 2, spin: 1, apologize: 1, hardline: -2, silent: -1, quiet: -2 }, ch: [
  [L("공개 간담회 개최 (-140)", "公開懇談会開催 (-140)", "Hold a public forum (-140)"), { money: -140, ctrv: -10, trust: 5, fat: 3 }, L("거친 말이 오갔지만 들어줬다.", "荒い言葉も飛んだが聞いた。", "Harsh words, but you listened."), { clear: { fans: 2 } }],
  [L("요구사항 일부 수용", "要求を一部受け入れ", "Accept some demands"), { ctrv: -5, rating: -3, ad: -2 }, L("모두를 조금씩 실망시켰다.", "皆を少しずつ失望させた。", "You let everyone down a little.")],
  [L("악성 민원으로 규정", "悪質クレームと規定", "Label it malicious complaints"), { ctrv: 13, trust: -9 }, L("기름을 부었다.", "火に油を注いだ。", "You poured on gasoline."), { next: ["sponsor_angry", 2] }] ] });
E("oldpost", "opinion", "cast", { n: L("출연자 과거 글 논란", "出演者の過去投稿騒動", "Old Post Scandal"), s: L("출연자의 오래된 글이 끌올돼 논란이다. 앞뒤 맥락은 아직 모른다.", "出演者の古い投稿が掘り返され騒動に。文脈はまだ不明。", "A cast member's old post resurfaced; context unclear."), fit: { factcheck: 2, hold: 1, apologize: 1, hardline: -1, spin: -1 }, ch: [
  [L("직접 사과", "直接謝罪", "Apologize personally"), { ctrv: -3, trust: 1, rating: -2 }, L("맥락과 상관없이 고개를 숙였다.", "文脈に関わらず頭を下げた。", "Bowed regardless of context.")],
  [L("맥락 해명", "文脈を説明", "Explain the context"), {}, L("믿어 줄지는 신뢰에 달렸다.", "信じるかは信頼次第。", "Depends on trust."), { roll: roll("trust", 52, { ctrv: -8, trust: 3 }, { ctrv: 10, trust: -5 }) }],
  [L("당분간 방송 하차", "しばらく出演見合わせ", "Step back for a while"), { ctrv: -6, rating: -6, fat: -3 }, L("조용해졌지만 자리가 비었다.", "静かになったが穴が空いた。", "Quieter, but a gap appeared.")] ] });
E("factfake", "opinion", "pr", { n: L("가짜 기사 대량 유포", "偽記事の大量拡散", "Fake News Flood"), s: L("방송국이 곧 망한다는 가짜 기사 수십 건이 동시에 올라왔다.", "局がもうすぐ潰れるとの偽記事が数十件同時に。", "Dozens of fake stories claim the station is about to fold."), min: 6, fit: { factcheck: 2, lawyer: 1, spin: 1, official: 1, quiet: -1, stall: 1 }, ch: [
  [L("하나씩 반박 자료 공개", "一つずつ反証資料を公開", "Debunk them one by one"), { trust: 4, fat: 3, ctrv: -3 }, L("피곤했지만 효과가 있었다.", "疲れたが効果はあった。", "Exhausting but effective.")],
  [L("법적 대응 예고 (-90)", "法的対応を予告 (-90)", "Threaten legal action (-90)"), { money: -90, ctrv: 2, ad: 2 }, L("광고주는 안심, 커뮤니티는 시큰둥.", "広告主は安心、掲示板は冷ややか。", "Sponsors relieved; forums unimpressed.")],
  [L("대응 안 함", "対応しない", "Do nothing"), { ad: -6 }, L("거짓이 먼저 지구를 돌았다.", "嘘が先に世界を回った。", "The lie went around first."), { risk: { ads: 1, fans: 1 } }] ] });
E("vote_doubt", "opinion", "pd", { n: L("시청자 투표 공정성 논란", "視聴者投票の公正性騒動", "Viewer Vote Dispute"), s: L("결승 투표 집계가 이상하다는 분석 글이 퍼진다.", "決勝投票の集計がおかしいとの分析が広がる。", "An analysis claims the finale vote count looks off."), min: 7, fit: { factcheck: 2, official: 1, rewrite: 1, quiet: -2, hold: -1 }, ch: [
  [L("원자료 전체 공개", "元データ全公開", "Publish raw data"), { trust: 6, ctrv: -5, rating: -2 }, L("숫자 앞에 소문이 잦아들었다.", "数字の前に噂が静まった。", "Rumors faded before the numbers.")],
  [L("재투표", "再投票", "Hold a revote"), { rating: 2, unity: -3, fat: 2, ctrv: 2 }, L("지던 쪽만 좋아했다.", "負けていた側だけ喜んだ。", "Only the losing side was happy.")],
  [L("이상 없다고 일축", "問題なしと一蹴", "Dismiss it"), { ctrv: 5 }, L("증거가 나오면 끝이다.", "証拠が出れば終わりだ。", "If proof appears, it's over."), { roll: roll("trust", 58, {}, { trust: -13, ctrv: 14 }, { nextBad: ["sponsor_angry", 1] }) }] ] });
// ---------- 재정·광고 ----------
E("sponsor_angry", "money", "finance", { n: L("광고주 긴급 항의", "広告主の緊急抗議", "Sponsor Emergency Complaint"), s: L("메인 광고주가 '해결 안 되면 계약 재검토'라며 전화를 걸어왔다.", "メイン広告主が「解決しなければ契約見直し」と電話。", "The main sponsor calls: fix this or the contract's under review."), when: (g) => g.m.ctrv > 30 || g.m.ad < 55, w: 2, fit: { official: 1, settle: 1, inject: 1, lawyer: 1, hardline: -2, spin: 1 }, ch: [
  [L("보상 광고 제공 (-180)", "補償広告の提供 (-180)", "Offer make-good ads (-180)"), { money: -180, ad: 9 }, L("수화기 너머 목소리가 낮아졌다.", "受話器の声が和らいだ。", "The voice on the phone softened.")],
  [L("사장 직접 사과 방문", "社長が直接謝罪訪問", "Chief visits to apologize"), { fat: 2 }, L("상대의 기분은 신뢰에 달렸다.", "相手の機嫌は信頼次第。", "Depends on trust."), { roll: roll("ad", 45, { ad: 10, unity: 1 }, { ad: -8, ctrv: 2 }, { nextBad: ["contract_cut", 2] }) }],
  [L("요구 거절, 원칙 고수", "要求拒否、原則を守る", "Refuse, stand firm"), { trust: 5, ad: -11 }, L("시청자는 좋아했지만 계약은 흔들린다.", "視聴者は喜んだが契約は揺らぐ。", "Viewers cheered; the contract wobbled."), { next: ["contract_cut", 3] }] ] });
E("contract_cut", "money", "finance", { n: L("광고 계약 해지 통보", "広告契約の解約通知", "Sponsor Cancels Contract"), s: L("광고 한 건이 정식으로 해지됐다. 위약 정산 얘기까지 나온다.", "広告1件が正式に解約。違約金精算の話まで。", "A deal was formally cancelled; penalty talks have started."), chainOnly: 1, fit: { settle: 1, lawyer: 2, inject: 1, freeze: 1, push: -1 }, ch: [
  [L("남은 광고주 집중 관리 (-220)", "残る広告主を集中管理 (-220)", "Secure remaining sponsors (-220)"), { money: -220, ad: 10 }, L("이탈이 멈췄다.", "離脱が止まった。", "The bleeding stopped.")],
  [L("저가 광고로 슬롯 메우기", "安価な広告で枠を埋める", "Fill slots with cheap ads"), { money: 170, trust: -6, ad: -2 }, L("돈은 들어왔지만 품격이 나갔다.", "金は入ったが品格は出ていった。", "Money in, dignity out.")],
  [L("위약금 소송으로 맞대응", "違約金訴訟で対抗", "Counter-sue for penalties"), { money: -80, ad: -6 }, L("법정 싸움이 길어진다.", "法廷闘争が長引く。", "A long court fight."), { next: ["lawsuit", 4] }] ] });
E("cashcrunch", "money", "finance", { n: L("긴급 자금 부족", "緊急資金不足", "Cash Crunch"), s: L("이번 주 지급일을 넘기면 대금이 연체된다.", "今週の支払日を過ぎると延滞になる。", "Miss this week's payday and bills go overdue."), when: (g) => g.m.money < 1100, w: 4, cd: 6, fit: { freeze: 2, settle: 1, inject: -1, calm: 1, swap: 1 }, ch: [
  [L("단기 고금리 대출", "短期高金利ローン", "High-interest short loan"), { money: 640 }, L("당장은 숨통이 트였다.", "当面は息がつけた。", "Breathing room, for now."), { debt: 860 }],
  [L("전 직원 수당 삭감", "全職員の手当削減", "Cut everyone's allowance"), { money: 340, unity: -11 }, L("회의실 공기가 얼어붙었다.", "会議室の空気が凍った。", "The room froze."), { risk: { unpaid: 2, grudge: 1 } }],
  [L("광고 특집 긴급 편성", "広告特集を緊急編成", "Rush a sponsor special"), { money: 420, trust: -7, ctrv: 4 }, L("돈은 벌었고 욕도 벌었다.", "金も稼ぎ、悪口も稼いだ。", "Earned cash and insults alike.")] ] });
E("audit_tax", "money", "finance", { n: L("세무 조사 통보", "税務調査の通知", "Tax Audit Notice"), s: L("장부를 확인하겠다는 통지가 왔다. 정리 못한 항목이 있다.", "帳簿確認の通知。整理できていない項目がある。", "Auditors want the books; some entries are a mess."), min: 8, fit: { lawyer: 2, freeze: 1, factcheck: 1, hardline: -1, hold: 1 }, ch: [
  [L("자진 신고 후 납부 (-320)", "自主申告して納付 (-320)", "Self-report and pay (-320)"), { money: -320, ad: 3, trust: 2 }, L("깨끗하게 털었다.", "きれいに済ませた。", "Cleared up cleanly.")],
  [L("회계사 동원 (-120)", "会計士を動員 (-120)", "Bring accountants (-120)"), { money: -120 }, L("장부 상태가 운명을 가른다.", "帳簿の状態が運命を分ける。", "The books decide it."), { roll: roll("ad", 48, { money: 90 }, { money: -360, ctrv: 8 }) }],
  [L("서류 늦게 제출", "書類を遅れて提出", "Stall the paperwork"), { ctrv: 4 }, L("시간을 벌었지만 끝난 건 아니다.", "時間は稼いだが終わっていない。", "Bought time, not an end."), { next: ["lawsuit", 4] }] ] });
E("lawsuit", "money", "legal", { n: L("대형 소송 제기", "大型訴訟の提起", "Major Lawsuit Filed"), s: L("예전 결정이 돌아왔다. 소장이 도착했고 기자들이 냄새를 맡았다.", "以前の決定が戻ってきた。訴状が届き記者が嗅ぎつけた。", "A past decision came back. A suit arrived and the press smells it."), chainOnly: 1, fit: { lawyer: 2, settle: 2, hardline: -1, official: 1, spin: 1 }, ch: [
  [L("합의금 지급 (-360)", "和解金支払い (-360)", "Pay settlement (-360)"), { money: -360, ctrv: -7 }, L("조용히 끝났다.", "静かに終わった。", "It ended quietly.")],
  [L("끝까지 다툰다 (-110)", "最後まで争う (-110)", "Fight it out (-110)"), { money: -110, fat: 2 }, L("판결은 신뢰에 달렸다.", "判決は信頼次第。", "Depends on credibility."), { roll: roll("trust", 45, { trust: 5, ctrv: -5 }, { money: -360, trust: -7, ctrv: 9 }) }],
  [L("보도 막아 시간 끌기", "報道を止め時間稼ぎ", "Suppress press, stall"), { ctrv: 7, ad: -4 }, L("불씨는 안 꺼졌다.", "火種は消えていない。", "The ember lives."), { risk: { ads: 1 } }] ] });
E("pay_demand", "money", "director", { n: L("미지급 임금 집단 요구", "未払い賃金の集団要求", "Unpaid Wage Demand"), s: L("스태프 전원이 밀린 임금 전에는 일 안 한다고 선언했다.", "スタッフ全員が未払い賃金なしでは働かないと宣言。", "All staff refuse to work until arrears are paid."), when: (g) => g.risk.unpaid >= 2, w: 5, fit: { inject: 2, settle: 1, calm: 1, freeze: -2, hardline: -2 }, ch: [
  [L("전액 지급 (-420)", "全額支給 (-420)", "Pay in full (-420)"), { money: -420, unity: 11, stab: 2 }, L("믿음이 조금 돌아왔다.", "信頼が少し戻った。", "Some faith returned."), { clear: { unpaid: 3 } }],
  [L("절반만 지금, 절반은 약속 (-200)", "半分は今、半分は約束 (-200)", "Half now, half promised (-200)"), { money: -200, unity: 2 }, L("약속을 지켜야 한다.", "約束は守らねば。", "You must keep that promise."), { risk: { unpaid: 1 } }],
  [L("대체 인력 투입", "代替人員を投入", "Bring replacements"), { stab: -11, unity: -13, money: -90 }, L("방송은 나가지만 사고가 늘어난다.", "放送は出るが事故が増える。", "On air, but accidents rise."), { risk: { maint: 2, grudge: 1 } }] ] });
// ---------- 경쟁·특수 (조기 엔딩 포함) ----------
E("rival_poach", "special", "director", { n: L("경쟁 방송국의 도발", "競合局の挑発", "Rival Provocation"), s: L("경쟁 방송국이 같은 시간대에 판박이 방송을 편성하고 공개 저격했다.", "競合局が同時間帯にそっくり番組を編成し公然と攻撃。", "The rival scheduled a copycat show at your time and called you out."), fit: { spin: 1, push: 1, rewrite: 1, hardline: 1, freeze: -1, quiet: -1 }, ch: [
  [L("정면 대결 특집 (-180)", "正面対決特番 (-180)", "Head-on special (-180)"), { money: -180, fat: 3 }, L("승패는 시청률이 말한다.", "勝敗は視聴率が語る。", "Ratings decide."), { roll: roll("rating", 42, { rating: 10, trust: 2 }, { rating: -6, ctrv: 3 }) }],
  [L("조용히 편성 이동", "静かに編成を移動", "Quietly change time slot"), { rating: -4, stab: 2 }, L("싸움을 피했다.", "争いを避けた。", "Dodged the fight.")],
  [L("표절로 공개 고발", "盗作と公開告発", "Publicly accuse of plagiarism"), { ctrv: 7, trust: 1, rating: 2 }, L("여론전이 시작됐다.", "世論戦が始まった。", "The PR war began.")] ] });
E("rival_steal", "special", "hr", { n: L("경쟁사의 출연자 빼가기", "競合の引き抜き", "Rival Poaches Talent"), s: L("경쟁사가 우리 출연자에게 두 배 출연료를 제시했다.", "競合が出演者に2倍の出演料を提示。", "The rival offers your cast double pay."), min: 7, when: (g) => g.m.unity < 62 || g.m.money < 1600, fit: { calm: 1, inject: 1, shield: 1, hardline: -1, lawyer: 1 }, ch: [
  [L("맞불 인상 (-260)", "対抗値上げ (-260)", "Match the offer (-260)"), { money: -260, unity: 4 }, L("붙잡았다.", "引き止めた。", "Kept them.")],
  [L("의리에 호소", "義理に訴える", "Appeal to loyalty"), {}, L("지난 일들이 답을 정한다.", "これまでの事が答えを決める。", "The past decides."), { roll: roll("unity", 48, { unity: 6 }, { rating: -8, unity: -7 }) }],
  [L("보내고 신인 발굴", "送り出して新人発掘", "Let go, find rookies"), { rating: -6, money: 70, fat: -3 }, L("새 얼굴에 기대를 건다.", "新しい顔に期待する。", "Betting on new faces.")] ] });
E("merger", "special", "director", { n: L("경쟁 방송국의 합병 제안", "競合局の合併提案", "Merger Offer from Rival"), s: L("빚을 떠안는 조건으로 합병을 제안한다. 받으면 지금 판은 끝난다.", "負債を引き受ける条件で合併提案。受ければここで終わる。", "They'll absorb your debt in a merger. Accepting ends the season."), min: 10, cd: 99, when: (g) => g.m.money < 1400 || g.m.trust < 40, w: 2, fit: { hold: 1, lawyer: 1, stall: 1 }, ch: [
  [L("합병 수락 (시즌 종료)", "合併受諾（シーズン終了）", "Accept merger (ends season)"), {}, L("간판을 내리기로 했다.", "看板を下ろすことにした。", "Time to take down the sign."), { end: "merged" }],
  [L("조건만 더 끌어낸 뒤 거절", "条件を引き出して拒否", "Negotiate, then refuse"), { money: 240, ad: -4, unity: -3 }, L("한 푼이라도 벌었다.", "一銭でも稼いだ。", "Squeezed out some cash.")],
  [L("즉시 거절", "即拒否", "Refuse outright"), { unity: 5, trust: 2 }, L("모두가 자리에서 일어나 박수를 쳤다.", "皆が立って拍手した。", "Everyone stood and applauded.")] ] });
E("buyout", "special", "director", { n: L("대기업 인수 제안", "大企業の買収提案", "Conglomerate Buyout"), s: L("대기업이 방송국 전체를 사겠다고 한다. 지금 끝내면 빚은 사라진다.", "大企業が局全体を買うと言う。今終えれば借金は消える。", "A conglomerate wants the whole station. End it now, debts vanish."), min: 9, cd: 99, when: (g) => g.m.money < 1200, w: 3, fit: { hold: 1, lawyer: 1 }, ch: [
  [L("매각 수락 (시즌 종료)", "売却受諾（シーズン終了）", "Sell (ends season)"), {}, L("서류에 도장이 찍혔다.", "書類に印が押された。", "The papers were stamped."), { end: "sold" }],
  [L("지분 일부만 판다", "株式の一部だけ売る", "Sell only a share"), { money: 620, unity: -6, ad: -2 }, L("숨을 돌렸지만 간섭이 시작된다.", "息はつけたが干渉が始まる。", "Breathing room, but meddling begins.")],
  [L("거절", "拒否", "Refuse"), { unity: 5, trust: 1 }, L("우리 방송국은 팔지 않는다.", "うちの局は売らない。", "This station's not for sale.")] ] });
E("indie_call", "special", "cast", { n: L("출연진 독립 선언 움직임", "出演者の独立宣言の動き", "Cast Independence Movement"), s: L("출연진이 함께 나가 새 방송국을 만들자고 뜻을 모았다. 결단의 순간이다.", "出演者が共に新局を作ろうと意を固めた。決断の時だ。", "The cast rally to leave and start a new station. Decision time."), min: 12, cd: 99, when: (g) => g.m.unity < 44, w: 3, fit: { calm: 2, shield: 1, hardline: -2 }, ch: [
  [L("독립 선언 (시즌 종료)", "独立宣言（シーズン終了）", "Declare independence (ends season)"), {}, L("창고 열쇠를 받아 들었다.", "倉庫の鍵を受け取った。", "They took the warehouse keys."), { end: "indep" }],
  [L("조건을 걸고 남는다", "条件付きで残る", "Stay, with conditions"), { unity: 8, money: -240, fat: -4 }, L("이번엔 남았다.", "今回は残った。", "They stayed, this time.")],
  [L("없던 일로 한다", "なかったことにする", "Drop it"), { unity: -5 }, L("불씨는 그대로다.", "火種はそのままだ。", "The ember remains."), { risk: { grudge: 2 } }] ] });
E("mega", "special", "finance", { n: L("초대형 스폰서 제안", "超大型スポンサー提案", "Mega Sponsor Offer"), s: L("3년 독점 계약 제안. 조기 시즌 종료가 조건이지만 대성공이다.", "3年独占契約の提案。シーズン早期終了が条件だが大成功。", "A 3-year exclusive. Ends the season early, but it's a triumph."), min: 15, cd: 99, when: (g) => g.m.ad >= 72 && g.m.rating >= 52 && g.m.trust >= 50, w: 3, fit: { lawyer: 1, spin: 1 }, ch: [
  [L("계약 체결 (시즌 종료)", "契約締結（シーズン終了）", "Sign (ends season)"), {}, L("펜 끝이 떨렸다.", "ペン先が震えた。", "The pen trembled."), { end: "bigdeal" }],
  [L("독립성 위해 거절", "独立性のため拒否", "Refuse for independence"), { trust: 7, ad: -3 }, L("시청자가 환호했다.", "視聴者が歓声を上げた。", "Viewers cheered.")],
  [L("규모 줄인 단기 계약", "縮小した短期契約", "Smaller short deal"), { money: 720, ad: 3 }, L("적당한 선에서 손을 잡았다.", "適度なところで手を結んだ。", "Struck a modest deal.")] ] });
E("citizens", "special", "director", { n: L("시청자 지분 참여 운동", "視聴者の持分参加運動", "Viewer Ownership Movement"), s: L("시청자들이 돈을 모아 방송국 지분을 사겠다고 나섰다.", "視聴者が資金を集めて局の持分を買うと動き出した。", "Viewers are pooling money to buy into the station."), min: 12, cd: 99, when: (g) => g.m.trust >= 66, w: 3, fit: { official: 1, spin: 1, factcheck: 1, hardline: -1 }, ch: [
  [L("시청자 주도 전환 (시즌 종료)", "視聴者主導へ転換（シーズン終了）", "Go viewer-owned (ends season)"), {}, L("주인이 바뀌었다.", "オーナーが変わった。", "New owners."), { end: "viewer" }],
  [L("후원금만 받는다", "後援金だけ受ける", "Accept donations only"), { money: 480, trust: 3, ctrv: 1 }, L("고맙지만 경영은 우리가.", "感謝しつつ経営は我々が。", "Thanks, but we'll run it.")],
  [L("정중히 거절", "丁重に断る", "Politely refuse"), { trust: -3 }, L("조금 서운해했다.", "少し残念がられた。", "They were a bit let down.")] ] });

// ---------- 마지막 기회: 지표 붕괴 직전 무조건 한 번 (끝나기 전 대응 기회) ----------
const LC = (id, doom, n, s, ch) => list.push({ id, group: "last", lead: "director", last: doom, chainOnly: 1, cd: 0, n, s, fit: {}, ch });
LC("lc_money", "bankrupt", L("마지막 회생 협상", "最後の再建交渉", "Last Rescue Talks"), L("채권단이 오늘이 마지막이라고 통보했다.", "債権団が今日が最後だと通告。", "Creditors say today is the last day."), [
  [L("핵심 장비 매각", "主要機材を売却", "Sell key equipment"), { money: 980, stab: -14 }, L("살았지만 장비가 줄었다.", "生き延びたが機材は減った。", "Alive, with less gear."), { rescue: 1 }],
  [L("전원 수당 포기 호소", "全員に手当放棄を訴える", "Ask all to give up pay"), {}, L("모두의 마음에 달렸다.", "皆の心次第。", "It's up to everyone."), { rescue: 1, roll: roll("unity", 42, { money: 860, unity: 5 }, { money: 300, unity: -14 }) }],
  [L("버티기", "耐える", "Hold out"), { money: 100 }, L("남은 시간이 얼마 없다.", "残り時間はわずか。", "Little time left.")] ]);
LC("lc_trust", "trust", L("대국민 사과 생방송", "全国謝罪の生放送", "Nationwide Apology Broadcast"), L("이번 말 한마디가 신뢰의 마지막 끈이다.", "この一言が信頼の最後の綱だ。", "This one statement is the last thread of trust."), [
  [L("모든 잘못 인정, 편성 축소", "全ての非を認め編成縮小", "Admit all, cut programming"), { trust: 24, rating: -9, ctrv: -12, money: -160 }, L("처음으로 시청자가 끝까지 들었다.", "初めて視聴者が最後まで聞いた。", "For once viewers listened to the end."), { rescue: 1 }],
  [L("외부 감시 위원회 도입 (-300)", "外部監視委員会導入 (-300)", "Add outside oversight (-300)"), { money: -300, trust: 19, ctrv: -7 }, L("돈으로 투명성을 샀다.", "金で透明性を買った。", "Bought transparency."), { rescue: 1 }],
  [L("대표 메시지만 낸다", "代表メッセージのみ", "Just release a statement"), { trust: 4 }, L("아무도 만족하지 않았다.", "誰も満足しなかった。", "No one was satisfied.")] ]);
LC("lc_stab", "blackout", L("송출 시스템 전면 재가동", "送出システム全面再稼働", "Full System Restart"), L("이대로면 곧 방송이 완전히 끊긴다.", "このままでは放送が完全に途切れる。", "Without action, broadcasts stop entirely."), [
  [L("외부 기술팀 긴급 투입 (-480)", "外部技術チーム投入 (-480)", "Hire outside techs (-480)"), { money: -480, stab: 32 }, L("불이 다시 들어왔다.", "灯りが戻った。", "Lights back on."), { rescue: 1, clear: { maint: 4 } }],
  [L("밤샘 자체 복구", "徹夜で自力復旧", "All-nighter repairs"), { fat: 14 }, L("모두의 능력과 결속이 시험대에 올랐다.", "全員の力と結束が試される。", "Skill and unity put to the test."), { rescue: 1, roll: roll("unity", 40, { stab: 28 }, { stab: 9, unity: -8 }) }],
  [L("땜질", "応急処置", "Patch it"), { stab: 6 }, L("곧 다시 고장 난다.", "すぐまた壊れる。", "It'll break again soon.")] ]);
LC("lc_unity", "split", L("긴급 전원 회의", "緊急全員会議", "Emergency All-Hands"), L("문을 잠그고 끝장 토론을 한다. 오늘 못 풀면 끝이다.", "ドアを閉めて徹底討論。今日解けなければ終わり。", "Doors locked, no one leaves. Fail today and it's over."), [
  [L("모든 불만 듣고 공개 약속 (-220)", "全不満を聞き公開約束 (-220)", "Hear all, promise publicly (-220)"), { money: -220, unity: 26, fat: -5 }, L("몇 명은 울었다.", "何人かは泣いた。", "Some cried."), { rescue: 1, clear: { grudge: 3 } }],
  [L("원인 제공자 책임 묻기", "原因者の責任を問う", "Hold the culprits responsible"), { unity: 14, trust: -3 }, L("일단 봉합됐다.", "とりあえず収まった。", "Patched up for now."), { rescue: 1 }],
  [L("회의 취소", "会議中止", "Cancel the meeting"), { unity: 1 }, L("복도가 조용해졌다. 나쁜 뜻으로.", "廊下が静かになった。悪い意味で。", "The hall went silent, the bad way.")] ]);
LC("lc_ads", "ads", L("광고주 총회 설득", "広告主総会の説得", "Sponsor Summit"), L("남은 광고주가 모두 모였다. 오늘 결정으로 전부 나갈 수도 있다.", "残る広告主が全員集合。今日の決定で全員去るかも。", "All remaining sponsors gathered. They might all leave today."), [
  [L("대폭 할인 패키지 (-280)", "大幅割引パッケージ (-280)", "Heavy discount package (-280)"), { money: -280, ad: 28 }, L("붙잡았다.", "引き止めた。", "They stayed."), { rescue: 1, clear: { ads: 3 } }],
  [L("시청률 보증 약속", "視聴率保証を約束", "Guarantee ratings"), { fat: 5 }, L("성적표가 답한다.", "成績表が答える。", "The numbers answer."), { rescue: 1, roll: roll("rating", 40, { ad: 26 }, { ad: 10, ctrv: 4 }) }],
  [L("변명만 한다", "言い訳だけする", "Just make excuses"), { ad: 4 }, L("하나둘 자리를 떴다.", "一人また一人と席を立った。", "One by one they left.")] ]);
LC("lc_walk", "walkout", L("출연진 마지막 면담", "出演者との最終面談", "Last Talk with the Cast"), L("출연진 짐이 이미 복도에 있다.", "出演者の荷物はもう廊下にある。", "Cast belongings are already in the hallway."), [
  [L("강제 휴방 + 보너스 (-340)", "強制休止＋ボーナス (-340)", "Forced break and bonus (-340)"), { money: -340, fat: -34, unity: 12, rating: -7 }, L("짐이 다시 대기실로 갔다.", "荷物が控室に戻った。", "Bags went back to the green room."), { rescue: 1, clear: { grudge: 2 } }],
  [L("진심으로 사정한다", "本心から頼み込む", "Plead sincerely"), {}, L("그동안 쌓은 관계가 답한다.", "これまでの関係が答える。", "The bonds you built will answer."), { rescue: 1, roll: roll("unity", 38, { fat: -22, unity: 10 }, { fat: -6, unity: -7 }) }],
  [L("막지 않는다", "止めない", "Don't stop them"), { fat: -3 }, L("복도가 비어 간다.", "廊下が空いていく。", "The hallway empties.")] ]);
LC("lc_chain", "chain", L("전면 쇄신 선언", "全面刷新宣言", "Total Overhaul Declared"), L("위기 대응이 계속 실패했다. 체계를 바꾸지 않으면 끝이다.", "危機対応が失敗続き。体制を変えねば終わりだ。", "Failures keep stacking. Change the system or it's over."), [
  [L("대응 매뉴얼 전면 재작성 (-240)", "マニュアル全面改定 (-240)", "Rewrite all playbooks (-240)"), { money: -240, stab: 8, unity: 5 }, L("연쇄가 끊겼다.", "連鎖が切れた。", "The chain snapped."), { rescue: 1, clearStreak: 1 }],
  [L("책임자 전원 재배치", "責任者を全員再配置", "Reassign all leads"), { unity: -6, trust: 5 }, L("어수선하지만 흐름은 바뀌었다.", "混乱はあるが流れは変わった。", "Messy, but the tide shifted."), { rescue: 1, clearStreak: 1 }],
  [L("하던 대로 간다", "今まで通り", "Carry on"), { unity: -3 }, L("다음 사고는 곧 온다.", "次の事故はすぐ来る。", "The next accident's coming.")] ]);
LC("lc_scandal", "scandal", L("외부 특별 조사단", "外部特別調査団", "Outside Special Inquiry"), L("미제 사건이 쌓였다. 조사단을 받아들이지 않으면 폐국 명령이 나온다.", "未解決事件が積もった。調査団を受け入れねば閉局命令が。", "Unsolved cases piled up. Accept an inquiry or face closure."), [
  [L("전면 수용 (-260)", "全面受け入れ (-260)", "Accept fully (-260)"), { money: -260, trust: 10, ctrv: -9 }, L("문을 열어 줬다.", "扉を開いた。", "Doors opened."), { rescue: 1, clearCrime: 1 }],
  [L("제한적 협조", "限定的協力", "Limited cooperation"), { trust: 3, ctrv: 2 }, L("절반만 믿어 줬다.", "半分だけ信じてくれた。", "Half believed you.")],
  [L("거부", "拒否", "Refuse"), { ctrv: 8 }, L("다음 공문은 더 짧을 것이다.", "次の公文はもっと短いだろう。", "The next notice will be shorter.")] ]);
export const URGENT = list;
export const URGENT_BY_ID = Object.fromEntries(list.map((e) => [e.id, e]));
export const LAST_BY_DOOM = Object.fromEntries(list.filter((e) => e.last).map((e) => [e.last, e.id]));

// ---------- 복합 비상사태: 모두 못 막는다. 각자 문제 하나에 투입(국장 2명분). 사람 수에 비례해 필요 인원. 해결은 돈도 든다 ----------
const P = {
  server: { ic: "📡", n: L("송출 서버 장애", "送出サーバー障害", "Server failure"), need: 0.34, cost: 260, ok: { stab: 6 }, no: { stab: -14, rating: -6 } },
  star: { ic: "🌟", n: L("인기 출연자 하차 요구", "人気出演者の降板要求", "Star demands to quit"), need: 0.3, cost: 220, ok: { unity: 5 }, no: { rating: -9, unity: -9 } },
  ad: { ic: "🏢", n: L("광고주 계약 중단", "広告主の契約中断", "Sponsors suspend deals"), need: 0.3, cost: 200, ok: { ad: 7 }, no: { ad: -16, money: -220 } },
  staff: { ic: "🧯", n: L("내부 직원 갈등", "内部職員の対立", "Staff infighting"), need: 0.22, cost: 100, ok: { unity: 7 }, no: { unity: -13, fat: 6 } },
  viewer: { ic: "📢", n: L("시청자 불만 폭발", "視聴者の不満爆発", "Viewer rage"), need: 0.3, cost: 120, ok: { ctrv: -7, trust: 4 }, no: { trust: -11, ctrv: 13 } },
  press: { ic: "📰", n: L("언론 집중 보도", "メディアの集中報道", "Press swarm"), need: 0.22, cost: 90, ok: { ctrv: -5 }, no: { ctrv: 12, trust: -5 } },
  bill: { ic: "🧾", n: L("대금 연체 독촉", "代金延滞の督促", "Overdue bill notice"), need: 0.2, cost: 340, ok: { ad: 2 }, no: { money: -340, stab: -5 } },
  fatigue: { ic: "😵", n: L("출연진 탈진", "出演者の消耗", "Cast exhaustion"), need: 0.26, cost: 80, ok: { fat: -13 }, no: { fat: 15, rating: -5 } },
};
const X = (id, min, n, s, probs, gambit, nextOf) => ({ id, min, n, s, probs, gambit, nextOf });
export const EMERGENCIES = [
  X("x_night", 8, L("방송국 붕괴의 밤", "放送局崩壊の夜", "Night of Collapse"), L("서버, 출연자, 광고주, 직원, 시청자. 다섯 곳이 동시에 터졌다.", "サーバー、出演者、広告主、職員、視聴者。五か所同時に爆発。", "Server, cast, sponsors, staff, viewers. Five fires at once."), ["server", "star", "ad", "staff", "viewer"], { t: L("국장 결단: 특집 전면 취소, 전원 수습", "局長決断：特番全面中止、総員収拾", "Chief's call: cancel all specials, all hands"), d: { rating: -14, money: -160, unity: 4 }, solve: 2 }, { server: "gear", star: "walkout_talk", ad: "contract_cut" }),
  X("x_finale", 12, L("생방 결승 대혼란", "生放送決勝の大混乱", "Live Finale Chaos"), L("결승 직전 장비, 출연진, 언론이 동시에 흔들린다.", "決勝直前に機材、出演者、メディアが同時に揺らぐ。", "Right before the finale, gear, cast and press all wobble."), ["server", "fatigue", "press", "viewer"], { t: L("국장 결단: 결승 연기", "局長決断：決勝延期", "Chief's call: postpone finale"), d: { rating: -11, ad: -6 }, solve: 2 }, { press: "clip_spread", fatigue: "overwork" }),
  X("x_money", 10, L("돈줄 동시 붕괴", "資金源の同時崩壊", "Money Lines Collapse"), L("대금 독촉, 광고 중단, 직원 항의가 같은 날 왔다.", "代金督促、広告中断、職員抗議が同じ日に。", "Bills, sponsor halts and staff protests hit the same day."), ["bill", "ad", "staff", "press"], { t: L("국장 결단: 지분 담보 대출", "局長決断：持分担保ローン", "Chief's call: loan against equity"), d: { money: 520, unity: -5 }, debt: 720, solve: 1 }, { ad: "contract_cut", staff: "pay_demand" }),
  X("x_scandal", 9, L("초대형 스캔들 폭발", "超大型スキャンダル爆発", "Mega-Scandal Blows Up"), L("같은 날 언론, 시청자, 광고주가 해명을 요구한다.", "同じ日にメディア、視聴者、広告主が釈明を要求。", "Press, viewers and sponsors all demand answers."), ["press", "viewer", "ad", "star"], { t: L("국장 결단: 책임자 사퇴 쇼", "局長決断：責任者辞任ショー", "Chief's call: stage a resignation"), d: { trust: 3, unity: -11, ctrv: -6 }, solve: 1 }, { viewer: "mass", press: "factfake" }),
  X("x_burnout", 9, L("번아웃 도미노", "バーンアウトのドミノ", "Burnout Dominoes"), L("피로가 한꺼번에 터졌다. 스태프와 출연진이 쓰러지고 있다.", "疲労が一度に爆発。スタッフと出演者が倒れていく。", "Fatigue burst all at once. People are collapsing."), ["fatigue", "staff", "star", "server"], { t: L("국장 결단: 사흘 전면 휴방", "局長決断：3日全面休止", "Chief's call: three-day shutdown"), d: { fat: -26, rating: -12, ad: -6 }, solve: 2 }, { star: "quit", staff: "feud" }),
  X("x_rival", 13, L("경쟁사 총공세", "競合の総攻撃", "Rival's All-Out Attack"), L("경쟁사가 광고주, 출연진, 언론을 동시에 공략한다.", "競合が広告主、出演者、メディアを同時に攻略。", "The rival attacks your sponsors, cast and press at once."), ["ad", "star", "press", "bill"], { t: L("국장 결단: 전면 맞불 특집", "局長決断：全面対抗特番", "Chief's call: all-out counter special"), d: { rating: 9, money: -320, fat: 7 }, solve: 1 }, { star: "rival_steal", ad: "sponsor_angry" }),
  X("x_tech", 7, L("기술 대란", "技術大混乱", "Tech Meltdown"), L("서버와 계정, 대금 시스템이 한꺼번에 먹통이다.", "サーバーとアカウント、決済が一斉にダウン。", "Servers, accounts and billing all down at once."), ["server", "bill", "viewer", "fatigue"], { t: L("국장 결단: 외주 전면 위탁", "局長決断：外注に全面委託", "Chief's call: outsource all of it"), d: { money: -440, stab: 8 }, solve: 2 }, { server: "blackout", viewer: "hack" }),
  X("x_trial", 14, L("규제 당국 합동 조사", "規制当局の合同調査", "Regulators Descend"), L("당국이 현장 조사에 왔다. 장부와 언론과 직원이 모두 시험대에 오른다.", "当局が現場調査に。帳簿とメディアと職員が試される。", "Regulators arrive. Books, press and staff all under scrutiny."), ["bill", "press", "staff", "viewer"], { t: L("국장 결단: 벌금 선납 합의", "局長決断：罰金先納で合意", "Chief's call: prepay fines"), d: { money: -500, trust: 4 }, solve: 2 }, { bill: "audit_tax", press: "lawsuit" }),
];
export const PROBLEMS = P;
