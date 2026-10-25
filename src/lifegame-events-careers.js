// =========================
// 인생게임 직업 루트 — 직업마다 이어지는 이야기 (생성 파일: lifegame-careers-gen/build.sh → 직접 고치지 말고 원본 cr_data*.py를 고쳐 다시 생성)
// 사건 표시: career(그 직업일 때만) · step[lo,hi](직업 단계 0 입문 1 성장 2 성공/실패 3 위기 4 새 도전 5 정점) · minYears(그 직업 n년차부터)
//   careerEntry(입문 사건: 특별한 직업이 이미 있으면 안 나옴) · followup(앞 사건의 next 로만 나옴)
// 선택/결과: career(이 직업으로 바뀜) · life.step / life.stepUp(단계) · life.careerEnd(직업을 접음) · next({id, after}: 후속 사건 예약)
// =========================
const E = o => ({ v: 2, type: "normal", stage: "*", ...o });
const has = (ctx, f) => !!ctx?.flags?.has(f);

export const CAREERS = {
  politics: { label: "정치인", title: "정당 청년위원", salary: 2600, retire: 85, route: "politics", alias: [] },
  writer: { label: "작가", title: "작가 지망생", salary: 1800, retire: 80, route: "writer", alias: [] },
  corporate: { label: "대기업 직장인", title: "대기업 사원", salary: 5200, retire: 60, route: "corporate", alias: [] },
  worker: { label: "직장인", title: "회사원", salary: 3200, retire: 60, route: "worker", alias: [] },
  civil: { label: "공무원", title: "9급 공무원", salary: 3300, retire: 60, route: "civil", alias: [] },
  developer: { label: "개발자", title: "주니어 개발자", salary: 3800, retire: 62, route: "developer", alias: [] },
  doctor: { label: "의사", title: "의대생", salary: 0, retire: 72, route: "doctor", alias: [] },
  lawyer: { label: "변호사", title: "로스쿨생", salary: 0, retire: 75, route: "lawyer", alias: [] },
  teacher: { label: "교사", title: "기간제 교사", salary: 3000, retire: 62, route: "teacher", alias: [] },
  idol: { label: "연예인", title: "연습생", salary: 0, retire: 65, route: "idol", alias: [] },
  business: { label: "사업가", title: "초보 사장", salary: 2400, retire: 78, route: "business", alias: ["ai"] },
  athlete: { label: "운동선수", title: "신인 선수", salary: 3500, retire: 65, route: "athlete", alias: [] },
  artist: { label: "예술가", title: "무명 화가", salary: 1400, retire: 80, route: "artist", alias: [] },
  streamer: { label: "유튜버", title: "새내기 유튜버", salary: 1000, retire: 65, route: "streamer", alias: ["influencer"] },
  gamer: { label: "프로게이머", title: "연습생 게이머", salary: 1500, retire: 62, route: "gamer", alias: [] },
};

// 직함 → 직업(이벤트가 정한 일자리가 어느 직업인지)
export const TITLE_CAREER = {"9급 공무원": "civil", "공무원": "civil", "주니어 개발자": "developer", "개발자": "developer", "대기업 사원": "corporate", "스타트업 대표": "business", "치킨집 사장": "business", "스타트업 경력직": "worker", "중견기업 사원": "worker", "구의원": "politics", "국회 보좌관": "politics", "국회의원": "politics", "전직 국회의원": "politics", "당대표": "politics", "대통령": "politics", "회고록 작가": "writer", "작가 겸 직장인": "writer", "인기 웹소설 작가": "writer", "베스트셀러 작가": "writer", "문학상 수상 작가": "writer", "세계적인 작가": "writer", "정당 영입 인사": "politics", "대기업 부장": "corporate", "대기업 상무": "corporate", "대기업 사장": "corporate", "창업자": "business", "온라인몰 대표": "business", "중소기업 과장": "worker", "중소기업 이사": "worker", "가게 사장": "business", "6급 주무관": "civil", "5급 사무관": "civil", "구청장": "politics", "빅테크 개발자": "developer", "수석 엔지니어": "developer", "개발 팀장": "developer", "CTO": "developer", "인턴": "doctor", "전문의": "doctor", "개원의": "doctor", "의대 교수": "doctor", "신입 변호사": "lawyer", "로펌 변호사": "lawyer", "공익 변호사": "lawyer", "개업 변호사": "lawyer", "파트너 변호사": "lawyer", "법률사무소 대표": "lawyer", "정교사": "teacher", "교육 유튜버": "streamer", "교장": "teacher", "교감": "teacher", "신인 가수": "idol", "인기 가수": "idol", "톱스타": "idol", "배우": "idol", "기획사 대표": "business", "사장": "business", "기업 대표": "business", "그룹 회장": "business", "프로 선수": "athlete", "해외파 선수": "athlete", "코치": "athlete", "스포츠 해설위원": "streamer", "체육관 대표": "business", "감독": "athlete", "세계적인 미술가": "artist", "인기 유튜버": "streamer", "100만 유튜버": "streamer", "프로게이머": "gamer", "게임 스트리머": "streamer", "e스포츠 코치": "gamer", "회사원": null, "계약직 사원": null, "공인중개사": "business", "요양보호사": null};

export const EVENTS_CAREERS = [
  E({
    id: "cr_pol_join", age: [22, 45], emoji: "🏛️", title: "정당 가입 권유",
    desc: "동네 일에 목소리를 냈더니 정당 사무국장이 찾아왔다. '청년위원 자리가 비었는데요.'", careerEntry: "politics", weight: 0.9, cond: p => p.stats.social >= 45 || p.stats.intel >= 60,
    choices: [
      { id: "join", emoji: "🤝", text: "입당해 정치를 시작한다", grade: "good", career: "politics", effects: { social: +5, intel: +2 }, narratives: ["당원증을 받았다. 첫 회의에서 막내라며 커피 심부름부터 했다."] },
      { id: "civic", emoji: "📣", text: "시민단체 활동부터 해 본다", grade: "mid", career: "politics", flag: {"add": ["pol_civic"]}, effects: { social: +4, happy: +2 }, narratives: ["주말마다 서명을 받으러 다녔다. 동네 사람들이 얼굴을 알아보기 시작했다."] },
      { id: "no", emoji: "🙅", text: "정치는 내 길이 아니다", grade: "mid", effects: { happy: +1 }, narratives: ["명함을 정중히 돌려줬다. 뉴스 볼 때만 화내는 시민으로 남기로 했다."] },
    ],
  }),
  E({
    id: "cr_pol_local_run", career: "politics", step: [0, 1], age: [25, 55], emoji: "🗳️", title: "지방선거 출마",
    desc: "구의원 선거가 다가온다. 당에서 '이번에 한번 나가 보라'고 한다. 기탁금과 선거비만 수천만 원.", weight: 1.4, repeat: 5,
    choices: [
      { id: "run", emoji: "🏃", text: "출마한다 — 골목마다 명함을 돌린다", grade: "good", life: {"step": 1}, next: {"id": "cr_pol_pledge", "after": 1}, effects: { money: -1500, power: -2, social: +4 }, narratives: ["새벽 시장부터 밤 노인정까지. 운동화 밑창이 두 번 닳았다. 이제 공약을 발표할 차례다."] },
      { id: "camp", emoji: "📋", text: "아직 이르다 — 다른 후보 캠프 실무부터", grade: "mid", life: {"step": 1}, effects: { intel: +3, social: +3 }, narratives: ["남의 선거를 치르며 판을 배웠다. 다음엔 내 이름을 걸 생각이다."] },
      { id: "quit", emoji: "🚪", text: "정치는 여기까지", grade: "mid", life: {"careerEnd": true}, effects: { happy: +3 }, narratives: ["당원증을 서랍에 넣었다. 평범한 삶으로 돌아갔다."] },
    ],
  }),
  E({
    id: "cr_pol_pledge", career: "politics", age: [25, 60], emoji: "📢", title: "공약 발표",
    desc: "선거 유세 첫날. 확성기 앞에서 무엇을 약속할까?", followup: true,
    choices: [
      { id: "real", emoji: "📐", text: "지킬 수 있는 생활 공약", grade: "good",
        outcomes: [
          { chance: 0.5, effects: { social: +5, happy: +8 }, grade: "crit", narrative: "'약속을 지킬 것 같은 사람'이라는 평. 당선! 구의원 배지를 달았다.", life: {"step": 2, "job": {"title": "구의원", "salary": 4800}}, flag: {"add": ["pol_local_win"]}, next: {"id": "cr_pol_council_first", "after": 1} },
          { chance: 0.5, effects: { happy: -8, money: -500 }, grade: "bad", narrative: "심심하다는 평 속에 낙선. 표 차이는 312표였다.", flag: {"add": ["pol_lost_once"]}, next: {"id": "cr_pol_lost", "after": 1} },
        ] },
      { id: "bold", emoji: "🎆", text: "파격 공약 — 청년 월세 반값!", grade: "crit",
        outcomes: [
          { chance: 0.45, effects: { internet: +6, social: +6, happy: +10 }, grade: "crit", narrative: "유세 영상이 퍼지며 돌풍. 당선됐다. 이제 그 약속을 지켜야 한다.", life: {"step": 2, "job": {"title": "구의원", "salary": 4800}}, flag: {"add": ["pol_local_win", "pol_bold"]}, next: {"id": "cr_pol_council_first", "after": 1} },
          { chance: 0.55, effects: { happy: -9, money: -800, social: -2 }, grade: "bad", narrative: "'포퓰리즘'이라는 공격에 무너졌다. 낙선.", flag: {"add": ["pol_lost_once"]}, next: {"id": "cr_pol_lost", "after": 1} },
        ] },
      { id: "negative", emoji: "🗡️", text: "상대 후보 약점을 판다", grade: "bad",
        outcomes: [
          { chance: 0.4, effects: { social: -4, happy: +4 }, grade: "good", narrative: "진흙탕 끝에 신승. 이겼지만 개운하지는 않았다.", life: {"step": 2, "job": {"title": "구의원", "salary": 4800}}, flag: {"add": ["pol_local_win", "pol_dirty"]}, next: {"id": "cr_pol_council_first", "after": 1} },
          { chance: 0.6, effects: { social: -8, happy: -8, money: -1000 }, grade: "bad", narrative: "역풍. 명예훼손 소송까지 걸렸다. 낙선.", flag: {"add": ["pol_lost_once", "pol_dirty"]}, next: {"id": "cr_pol_lost", "after": 1} },
        ] },
    ],
  }),
  E({
    id: "cr_pol_lost", career: "politics", age: [25, 70], emoji: "🌧️", title: "낙선 다음 날",
    desc: "선거 사무실 현수막을 내렸다. 빚과 함께 남은 건 '다음엔 꼭'이라던 사람들.", followup: true,
    choices: [
      { id: "again", emoji: "🔁", text: "4년 뒤를 준비한다", grade: "good", life: {"step": 1}, effects: { power: +2, social: +3, happy: -2 }, narratives: ["떨어진 동네를 다시 돌았다. '또 왔네' 하던 사람들이 이번엔 손을 잡아 줬다."] },
      { id: "aide", emoji: "🗂️", text: "국회의원 보좌관으로 들어간다", grade: "mid", life: {"step": 1, "job": {"title": "국회 보좌관", "salary": 5000}}, effects: { intel: +4, social: +2 }, narratives: ["여의도에서 일을 배웠다. 밤 11시 퇴근이 기본이었다."] },
      { id: "leave", emoji: "🚪", text: "정치를 접는다", grade: "mid", life: {"careerEnd": true}, effects: { happy: +4, health: +2 }, narratives: ["후련했다. 다시 출근할 곳을 알아보기 시작했다."] },
    ],
  }),
  E({
    id: "cr_pol_council_first", career: "politics", age: [26, 70], emoji: "🏢", title: "첫 의정 활동",
    desc: "구의회 첫 회기. 민원 전화가 하루 100통이다. 무엇부터 할까?", followup: true,
    choices: [
      { id: "field", emoji: "🦺", text: "현장으로 — 민원 해결사", grade: "good", flag: {"add": ["pol_field"]}, effects: { social: +6, happy: +4, health: -2 }, narratives: ["고장 난 가로등, 막힌 하수구. 하나씩 고쳤다. '그 의원 일 잘한다'는 말이 돌았다."] },
      { id: "budget", emoji: "💰", text: "예산 싸움 — 어린이 도서관 예산 확보", grade: "good", flag: {"add": ["pol_budget"]}, effects: { intel: +5, social: +3 }, narratives: ["밤샘 예산 심사 끝에 도서관 예산을 따냈다. 개관식에서 아이들이 꽃을 줬다."] },
      { id: "photo", emoji: "📸", text: "행사장 사진 위주로", grade: "bad", flag: {"add": ["pol_photo"]}, effects: { internet: +4, social: -2 }, narratives: ["SNS 팔로워는 늘었다. 하지만 '사진만 찍는 의원'이라는 별명도 생겼다."] },
    ],
  }),
  E({
    id: "cr_pol_conflict", career: "politics", step: [2, 4], age: [28, 72], emoji: "⚔️", title: "당론과 소신 사이",
    desc: "당이 반대하라는 법안이 있다. 하지만 내 지역 사람들에겐 꼭 필요한 법이다.", repeat: 5,
    choices: [
      { id: "party", emoji: "🧱", text: "당론을 따른다", grade: "mid", flag: {"add": ["pol_loyal"]}, effects: { social: +2, happy: -5 }, narratives: ["당 지도부의 신임을 얻었다. 지역 카페에는 '배신자'라는 글이 올라왔다."] },
      { id: "conscience", emoji: "🧭", text: "소신 투표를 한다", grade: "good",
        outcomes: [
          { chance: 0.55, effects: { happy: +7, social: +5, internet: +3 }, grade: "crit", narrative: "'소신 있는 정치인'으로 화제가 됐다. 지지율이 올랐다.", flag: {"add": ["pol_maverick"]} },
          { chance: 0.45, effects: { happy: -4, social: -3 }, grade: "bad", narrative: "당에서 찍혔다. 다음 공천이 불투명해졌다.", flag: {"add": ["pol_maverick", "pol_outcast"]} },
        ] },
      { id: "leave_party", emoji: "🚶", text: "아예 탈당한다", grade: "mid", flag: {"add": ["pol_independent"]}, effects: { happy: +3, social: -2, money: -300 }, narratives: ["무소속이 됐다. 자유로웠지만 조직도, 돈도 없어졌다."] },
    ],
  }),
  E({
    id: "cr_pol_scandal", career: "politics", step: [1, 5], age: [28, 80], emoji: "📰", title: "측근 비리 보도",
    desc: "아침 뉴스에 내 보좌관 이름이 나왔다. 업체에서 돈을 받았다는 의혹이다.", weight: 0.8, repeat: 5,
    choices: [
      { id: "apologize", emoji: "🙇", text: "즉시 공개 사과하고 조사에 협조", grade: "good",
        outcomes: [
          { chance: 0.65, effects: { social: +3, happy: -4 }, grade: "good", narrative: "빠른 사과가 먹혔다. 위기는 넘겼다." },
          { chance: 0.35, effects: { social: -5, happy: -8 }, grade: "bad", narrative: "사과해도 불길은 꺼지지 않았다. 지지율 반토막.", life: {"step": 1} },
        ] },
      { id: "deny", emoji: "🛡️", text: "'정치 공작'이라며 버틴다", grade: "bad",
        outcomes: [
          { chance: 0.35, effects: { social: +2 }, grade: "mid", narrative: "버티다 보니 다른 뉴스에 묻혔다." },
          { chance: 0.65, effects: { social: -10, happy: -10, money: -2000 }, grade: "bad", narrative: "녹취록이 공개됐다. 당에서 출당 조치. 재기가 어려워졌다.", life: {"step": 0}, flag: {"add": ["pol_disgraced"]} },
        ] },
      { id: "cut", emoji: "✂️", text: "보좌관을 해고하고 선을 긋는다", grade: "mid", effects: { social: -3, happy: -3 }, narratives: ["꼬리 자르기라는 비판을 받았지만 살아남았다. 의리 있는 사람들은 떠났다."] },
    ],
  }),
  E({
    id: "cr_pol_bribe", career: "politics", step: [2, 5], age: [30, 78], emoji: "💼", title: "검은 돈의 유혹",
    desc: "건설업체 회장이 쇼핑백을 내민다. '선거 때 쓰시라고요. 아무도 모릅니다.'", weight: 0.7, repeat: 5,
    choices: [
      { id: "refuse", emoji: "✋", text: "단호히 거절한다", grade: "good", flag: {"add": ["pol_clean"]}, effects: { happy: +4, social: +2 }, narratives: ["쇼핑백을 돌려보냈다. 몇 달 뒤 그 회장은 구속됐다. 내 이름은 없었다."] },
      { id: "take", emoji: "💰", text: "받는다", grade: "bad",
        outcomes: [
          { chance: 0.45, effects: { money: +5000, happy: -3 }, grade: "mid", narrative: "아무 일도 없었다. 아직은.", flag: {"add": ["pol_bribed"]} },
          { chance: 0.55, effects: { money: -8000, social: -15, happy: -15 }, grade: "bad", narrative: "압수수색. 뇌물죄로 기소됐다. 정치 인생이 끝났다.", route: "criminal", life: {"careerEnd": true}, flag: {"add": ["pol_jailed"]} },
        ] },
      { id: "report", emoji: "🚨", text: "검찰에 신고한다", grade: "crit", flag: {"add": ["pol_clean"]}, effects: { social: +6, happy: +3, internet: +4 }, narratives: ["'뇌물 신고한 의원'으로 뉴스에 나왔다. 적도 생겼지만 팬도 생겼다."] },
    ],
  }),
  E({
    id: "cr_pol_assembly", career: "politics", step: [2, 3], age: [32, 66], emoji: "🏛️", title: "국회의원 도전",
    desc: "총선이 1년 남았다. 공천 경쟁자는 당 대표의 측근이다.", minYears: 3, weight: 1.3, repeat: 5, flagBanned: ["pol_independent", "pol_mp"],
    choices: [
      { id: "faction", emoji: "🤝", text: "실세 계파에 줄을 선다", grade: "mid",
        outcomes: [
          { chance: 0.55, effects: { social: +4, happy: +8 }, grade: "crit", narrative: "공천을 받고 당선. 국회의원 배지를 달았다.", life: {"step": 3, "job": {"title": "국회의원", "salary": 15500}}, flag: {"add": ["pol_mp"]}, next: {"id": "cr_pol_mp_first", "after": 1} },
          { chance: 0.45, effects: { happy: -8, money: -2000 }, grade: "bad", narrative: "계파 싸움에서 밀려 공천 탈락.", flag: {"add": ["pol_lost_once"]} },
        ] },
      { id: "primary", emoji: "🥊", text: "경선에서 정면 승부", grade: "good",
        outcomes: [
          { chance: 0.45, effects: { social: +6, happy: +10, internet: +3 }, grade: "crit", narrative: "당원 투표에서 이변. 본선까지 이겼다. 국회의원이 됐다.", life: {"step": 3, "job": {"title": "국회의원", "salary": 15500}}, flag: {"add": ["pol_mp"]}, next: {"id": "cr_pol_mp_first", "after": 1} },
          { chance: 0.55, effects: { happy: -6, money: -1500 }, grade: "bad", narrative: "석패. 그래도 이름은 알렸다.", flag: {"add": ["pol_lost_once"]} },
        ] },
      { id: "indep", emoji: "🦅", text: "무소속으로 출마", grade: "mid",
        outcomes: [
          { chance: 0.25, effects: { social: +8, happy: +12 }, grade: "crit", narrative: "기적 같은 무소속 당선. 정치권이 놀랐다.", life: {"step": 3, "job": {"title": "국회의원", "salary": 15500}}, flag: {"add": ["pol_mp", "pol_independent"]}, next: {"id": "cr_pol_mp_first", "after": 1} },
          { chance: 0.75, effects: { happy: -8, money: -3000 }, grade: "bad", narrative: "조직의 벽은 높았다. 빚만 남았다.", flag: {"add": ["pol_lost_once"]} },
        ] },
    ],
  }),
  E({
    id: "cr_pol_mp_first", career: "politics", age: [33, 72], emoji: "📜", title: "초선 의원",
    desc: "국회 첫 출근. 의원회관 방 한 칸과 보좌진 아홉 명이 생겼다. 1호 법안은?", followup: true,
    choices: [
      { id: "law", emoji: "📜", text: "내 공약을 법으로", grade: "crit", flag: {"add": ["pol_law"]}, effects: { intel: +5, social: +4, happy: +6 }, narratives: ["2년을 매달려 통과시켰다. 법 이름에 내 이름이 붙었다."] },
      { id: "tv", emoji: "📺", text: "시사 방송 단골이 된다", grade: "mid", flag: {"add": ["pol_tv"]}, effects: { internet: +7, social: +5, health: -2 }, narratives: ["'사이다 발언'으로 얼굴이 알려졌다. 지역구엔 잘 안 보인다는 소리도 들었다."] },
      { id: "local", emoji: "🏘️", text: "지역구부터 챙긴다", grade: "good", flag: {"add": ["pol_local_strong"]}, effects: { social: +6, happy: +3 }, narratives: ["주말마다 지역에 내려갔다. 재선은 걱정 없다는 말이 나왔다."] },
    ],
  }),
  E({
    id: "cr_pol_filibuster", career: "politics", step: [3, 5], age: [34, 78], emoji: "🎤", title: "본회의장의 밤",
    desc: "여야가 극한 대치 중이다. 당에서 필리버스터 주자로 나를 지목했다.", flagRequired: ["pol_mp"], repeat: 5,
    choices: [
      { id: "talk", emoji: "🎙️", text: "12시간 연설에 도전", grade: "good",
        outcomes: [
          { chance: 0.6, effects: { internet: +8, social: +5, health: -5, happy: +5 }, grade: "crit", narrative: "12시간 47분. 기록을 세웠다. 생중계 시청자들이 응원 메시지를 보냈다." },
          { chance: 0.4, effects: { health: -8, happy: -3 }, grade: "bad", narrative: "5시간 만에 쓰러질 뻔했다. 링거를 맞았다." },
        ] },
      { id: "deal", emoji: "🤝", text: "물밑 협상으로 합의를 이끈다", grade: "good", flag: {"add": ["pol_dealmaker"]}, effects: { social: +6, intel: +3 }, narratives: ["새벽 3시, 양당 원내대표가 악수했다. 그 뒤엔 내가 있었다."] },
    ],
  }),
  E({
    id: "cr_pol_reelect", career: "politics", step: [3, 4], age: [37, 76], emoji: "🗳️", title: "재선 선거",
    desc: "4년이 지났다. 지역구 사람들이 내 성적표를 매긴다.", flagRequired: ["pol_mp"], minYears: 6, repeat: 5, flagBanned: ["pol_reelected"],
    choices: [
      { id: "record", emoji: "📊", text: "의정 활동 성적으로 승부", grade: "good",
        outcomes: [
          { chance: 0.6, effects: { social: +5, happy: +8 }, grade: "crit", narrative: "재선 성공. 중진 의원 소리를 듣기 시작했다.", life: {"step": 4, "raise": 1.05}, flag: {"add": ["pol_reelected"]} },
          { chance: 0.4, effects: { happy: -10, money: -2000 }, grade: "bad", narrative: "바람이 반대로 불었다. 낙선. 배지를 반납했다.", life: {"step": 2, "job": {"title": "전직 국회의원", "salary": 3000}}, flag: {"add": ["pol_lost_once"]} },
        ] },
      { id: "retire", emoji: "🌅", text: "불출마 선언", grade: "mid", life: {"careerEnd": true}, flag: {"add": ["pol_graceful"]}, effects: { happy: +5, health: +3 }, narratives: ["박수 칠 때 떠났다. 후배에게 지역구를 물려줬다."] },
    ],
  }),
  E({
    id: "cr_pol_leader", career: "politics", step: [3, 4], age: [40, 74], emoji: "👑", title: "당대표 도전",
    desc: "당이 선거에 참패했다. '이제 당신이 나서야 한다'는 전화가 이어진다.", flagRequired: ["pol_mp"], minYears: 8, repeat: 5, flagBanned: ["pol_leader"],
    choices: [
      { id: "run", emoji: "🔥", text: "당대표 선거에 나선다", grade: "crit",
        outcomes: [
          { chance: 0.45, effects: { social: +8, happy: +10, health: -3 }, grade: "crit", narrative: "당대표 당선. 이제 대선이 보인다.", life: {"step": 4, "job": {"title": "당대표", "salary": 16000}}, flag: {"add": ["pol_leader"]} },
          { chance: 0.55, effects: { happy: -7, social: -2 }, grade: "bad", narrative: "2위. 당은 다른 사람의 손을 들어줬다." },
        ] },
      { id: "kingmaker", emoji: "♟️", text: "킹메이커로 남는다", grade: "good", flag: {"add": ["pol_kingmaker"]}, effects: { social: +5, intel: +3 }, narratives: ["내가 민 후보가 당선됐다. 보이지 않는 힘이 생겼다."] },
    ],
  }),
  E({
    id: "cr_pol_president", career: "politics", step: [4, 4], age: [45, 78], emoji: "🇰🇷", title: "대통령 선거 출마",
    desc: "여론조사 지지율 1위. 대선 출마 기자회견장의 플래시가 쏟아진다.", flagRequired: ["pol_leader"], weight: 1.5, repeat: 5, flagBanned: ["pol_president", "pol_reformer"],
    choices: [
      { id: "unity", emoji: "🕊️", text: "통합의 메시지로", grade: "good",
        outcomes: [
          { chance: 0.45, effects: { social: +10, happy: +15 }, grade: "crit", narrative: "당선. 대통령이 됐다. 첫 출근길, 손이 떨렸다.", life: {"step": 5, "job": {"title": "대통령", "salary": 25000}}, flag: {"add": ["pol_president"]}, next: {"id": "cr_pol_pres_term", "after": 2} },
          { chance: 0.55, effects: { happy: -12, health: -4 }, grade: "bad", narrative: "0.7%p 차이로 졌다. 개표 방송을 끝까지 봤다.", flag: {"add": ["pol_pres_lost"]} },
        ] },
      { id: "reform", emoji: "⚡", text: "강력한 개혁을 내건다", grade: "crit",
        outcomes: [
          { chance: 0.4, effects: { social: +8, happy: +15, internet: +5 }, grade: "crit", narrative: "개혁 바람을 타고 당선. 대통령 취임식에서 '약속을 지키겠다'고 말했다.", life: {"step": 5, "job": {"title": "대통령", "salary": 25000}}, flag: {"add": ["pol_president", "pol_reformer"]}, next: {"id": "cr_pol_pres_term", "after": 2} },
          { chance: 0.6, effects: { happy: -12, social: -3 }, grade: "bad", narrative: "기득권의 반격에 무너졌다. 낙선.", flag: {"add": ["pol_pres_lost"]} },
        ] },
    ],
  }),
  E({
    id: "cr_pol_pres_term", career: "politics", age: [47, 85], emoji: "🏛️", title: "대통령의 5년",
    desc: "임기 중반. 지지율이 30%대로 떨어졌다. 남은 시간, 무엇에 걸까?", followup: true,
    choices: [
      { id: "legacy", emoji: "🏗️", text: "욕먹어도 미래를 위한 개혁", grade: "good", flag: {"add": ["pol_legacy"]}, effects: { happy: +4, intel: +3, health: -4 }, narratives: ["임기 내내 욕을 먹었다. 10년 뒤 교과서는 다르게 썼다."] },
      { id: "popular", emoji: "📈", text: "지지율 관리에 집중", grade: "mid", effects: { social: +4, happy: +3 }, narratives: ["무난하게 임기를 마쳤다. 기억에 남는 일은 별로 없었다."] },
      { id: "crisis", emoji: "🌪️", text: "측근 비리를 덮는다", grade: "bad", flag: {"add": ["pol_pres_scandal"]}, effects: { social: -8, happy: -8 }, narratives: ["퇴임 후 청문회가 열렸다. 이름 앞에 '전직'보다 무거운 말이 붙었다."] },
    ],
  }),
  E({
    id: "cr_pol_retire", career: "politics", step: [1, 5], age: [62, 90], emoji: "🌇", title: "정계 은퇴",
    desc: "머리가 하얗게 셌다. 후배들이 '원로'라고 부른다. 이제 어떻게 마무리할까?", weight: 1.2, repeat: 5,
    choices: [
      { id: "memoir", emoji: "📖", text: "회고록을 쓴다", grade: "good", career: "writer", life: {"step": 1, "job": {"title": "회고록 작가", "salary": 1500}}, effects: { intel: +4, happy: +5 }, narratives: ["정치 인생 40년을 책으로 묶었다. 출판사에서 다음 책도 쓰자고 한다."] },
      { id: "mentor", emoji: "🌱", text: "정치 학교를 열어 후배 양성", grade: "good", life: {"careerEnd": true}, flag: {"add": ["pol_mentor"]}, effects: { social: +5, happy: +6 }, narratives: ["청년들이 찾아왔다. 내가 처음 당원증을 받던 날이 떠올랐다."] },
      { id: "garden", emoji: "🌿", text: "고향에 내려가 텃밭을 가꾼다", grade: "mid", life: {"careerEnd": true}, effects: { health: +5, happy: +6, social: -2 }, narratives: ["아무도 나를 의원님이라 부르지 않았다. 그게 좋았다."] },
    ],
  }),
  E({
    id: "cr_wr_entry", age: [18, 50], emoji: "✍️", title: "첫 작품을 쓰다",
    desc: "머릿속에서 떠나지 않는 이야기가 있다. 노트북을 열었다. 첫 문장을 쓸까?", careerEntry: "writer", weight: 1.0, cond: p => p.stats.intel >= 50 || p.routes.has("artist") || p.routes.has("student"),
    choices: [
      { id: "full", emoji: "🖋️", text: "모든 걸 걸고 전업으로 쓴다", grade: "crit", career: "writer", effects: { intel: +4, happy: +5, money: -300 }, narratives: ["일을 그만뒀다. 하루 열 시간씩 썼다. 통장 잔고가 줄어드는 소리가 들렸다."] },
      { id: "night", emoji: "🌙", text: "일하며 밤마다 조금씩", grade: "good", career: "writer", life: {"job": {"title": "작가 겸 직장인", "salary": 3000}}, effects: { intel: +3, health: -2, happy: +3 }, narratives: ["퇴근 후 새벽 1시까지 썼다. 1년 만에 원고 한 편이 완성됐다."] },
      { id: "web", emoji: "📱", text: "웹소설 플랫폼에 연재부터", grade: "good", career: "writer", flag: {"add": ["wr_web"]}, effects: { internet: +5, intel: +2 }, narratives: ["1화를 올렸다. 조회수 37. 댓글 하나: '다음 화 언제요?'"] },
      { id: "hobby", emoji: "📓", text: "취미로만 남겨 둔다", grade: "mid", effects: { happy: +2 }, narratives: ["가끔 일기장에 짧은 글을 썼다. 그걸로 충분했다."] },
    ],
  }),
  E({
    id: "cr_wr_submit", career: "writer", step: [0, 0], age: [18, 70], emoji: "📮", title: "투고냐 연재냐",
    desc: "원고가 완성됐다. 이 이야기를 세상에 어떻게 내보낼까?", weight: 1.5, repeat: 5, flagBanned: ["wr_book"],
    choices: [
      { id: "publisher", emoji: "📮", text: "출판사 50곳에 투고한다", grade: "good",
        outcomes: [
          { chance: 0.35, effects: { happy: +10, intel: +3 }, grade: "crit", narrative: "49곳에서 거절. 1곳에서 '만나서 이야기하자'는 메일이 왔다. 첫 책 계약!", life: {"step": 1}, flag: {"add": ["wr_book"]}, next: {"id": "cr_wr_first_sales", "after": 1} },
          { chance: 0.65, effects: { happy: -8 }, grade: "bad", narrative: "50곳 모두 거절. 거절 메일을 폴더에 모아 두었다. 언젠가 웃으며 볼 수 있기를.", flag: {"add": ["wr_rejected"]} },
        ] },
      { id: "serial", emoji: "📱", text: "웹소설로 매일 연재", grade: "good",
        outcomes: [
          { chance: 0.5, effects: { internet: +6, happy: +6 }, grade: "good", narrative: "30화쯤부터 독자가 붙기 시작했다. 댓글이 쏟아진다.", life: {"step": 1}, flag: {"add": ["wr_web"]}, next: {"id": "cr_wr_readers", "after": 1} },
          { chance: 0.5, effects: { happy: -5, health: -3 }, grade: "bad", narrative: "100화를 올렸는데 조회수가 그대로다. 손목이 시큰거린다.", flag: {"add": ["wr_web"]} },
        ] },
      { id: "self", emoji: "🖨️", text: "자비출판으로 직접 낸다", grade: "mid", life: {"step": 1}, flag: {"add": ["wr_book"]}, next: {"id": "cr_wr_first_sales", "after": 1}, effects: { money: -500, happy: +4 }, narratives: ["500권을 찍었다. 첫 독자는 엄마였다. 이제 팔아야 한다."] },
    ],
  }),
  E({
    id: "cr_wr_first_sales", career: "writer", age: [19, 75], emoji: "📊", title: "첫 책의 성적표",
    desc: "서점에 내 책이 꽂혔다. 출판사에서 판매 데이터를 보내왔다. 이제 어떻게 할까?", followup: true,
    choices: [
      { id: "tour", emoji: "🎤", text: "북토크를 돌며 독자를 만난다", grade: "good",
        outcomes: [
          { chance: 0.5, effects: { social: +5, happy: +8, money: +300 }, grade: "crit", narrative: "입소문이 났다. 3쇄를 찍었다. 차기작을 기다린다는 편지가 왔다.", life: {"step": 2}, flag: {"add": ["wr_hit"]} },
          { chance: 0.5, effects: { happy: -4, money: -100 }, grade: "mid", narrative: "북토크에 온 사람은 세 명. 그중 한 명은 서점 직원.", life: {"step": 2}, flag: {"add": ["wr_flop"]} },
        ] },
      { id: "sns", emoji: "📲", text: "SNS로 홍보한다", grade: "mid",
        outcomes: [
          { chance: 0.45, effects: { internet: +6, happy: +6, money: +200 }, grade: "good", narrative: "한 문장이 캡처되어 돌았다. '그 문장 쓴 작가'로 유명해졌다.", life: {"step": 2}, flag: {"add": ["wr_hit"]} },
          { chance: 0.55, effects: { happy: -5 }, grade: "bad", narrative: "반응이 없었다. 초판 2천 부 중 1천 부가 반품됐다.", life: {"step": 2}, flag: {"add": ["wr_flop"]} },
        ] },
      { id: "next", emoji: "🖋️", text: "숫자는 신경 쓰지 않고 차기작", grade: "good", life: {"step": 2}, effects: { intel: +4, happy: +2 }, narratives: ["다시 빈 페이지 앞에 앉았다. 두 번째가 더 어렵다는 걸 알게 됐다."] },
    ],
  }),
  E({
    id: "cr_wr_readers", career: "writer", age: [19, 70], emoji: "💬", title: "독자들의 반응",
    desc: "연재 순위가 오르자 댓글이 갈린다. '주인공 너무 답답해요' vs '이대로가 좋아요'.", followup: true,
    choices: [
      { id: "listen", emoji: "👂", text: "독자 의견을 반영한다", grade: "good",
        outcomes: [
          { chance: 0.6, effects: { internet: +6, happy: +7, money: +1500 }, grade: "crit", narrative: "유료 전환 첫 달, 월 수익이 직장인 월급을 넘었다.", life: {"step": 2, "job": {"title": "인기 웹소설 작가", "salary": 4500}}, flag: {"add": ["wr_hit"]} },
          { chance: 0.4, effects: { happy: -4 }, grade: "mid", narrative: "이리저리 휘둘리다 이야기가 산으로 갔다.", life: {"step": 2}, flag: {"add": ["wr_flop"]} },
        ] },
      { id: "stubborn", emoji: "🗿", text: "내 이야기는 내가 쓴다", grade: "mid",
        outcomes: [
          { chance: 0.45, effects: { happy: +8, intel: +4, money: +800 }, grade: "crit", narrative: "뚝심이 통했다. 완결 후 '명작'이라는 평이 붙었다.", life: {"step": 2}, flag: {"add": ["wr_hit"]} },
          { chance: 0.55, effects: { happy: -6 }, grade: "bad", narrative: "독자가 하나둘 떠났다. 조기 완결.", life: {"step": 2}, flag: {"add": ["wr_flop"]} },
        ] },
      { id: "hurt", emoji: "💔", text: "악플에 상처받아 잠시 쉰다", grade: "bad", life: {"step": 1}, effects: { happy: -6, health: +2 }, narratives: ["휴재 공지를 올렸다. '기다릴게요'라는 댓글 몇 개가 버팀목이 됐다."] },
    ],
  }),
  E({
    id: "cr_wr_block", career: "writer", step: [1, 4], age: [22, 85], emoji: "🫥", title: "슬럼프",
    desc: "석 달째 한 줄도 못 썼다. 마감은 다가오고 빈 화면의 커서만 깜빡인다.", repeat: 8,
    choices: [
      { id: "travel", emoji: "🧳", text: "훌쩍 여행을 떠난다", grade: "good", effects: { happy: +6, money: -300 }, narratives: ["낯선 도시 골목에서 첫 문장이 떠올랐다. 냅킨에 받아 적었다."] },
      { id: "grind", emoji: "⏰", text: "억지로라도 매일 쓴다", grade: "mid", effects: { intel: +3, health: -3 }, narratives: ["쓰레기 같은 문장 100개 중 하나가 살아남았다. 그걸로 다시 시작했다."] },
      { id: "rest", emoji: "🛌", text: "마감을 미루고 쉰다", grade: "mid", effects: { health: +4, happy: +2, social: -2 }, narratives: ["편집자의 한숨이 전화기 너머로 들렸다. 그래도 몸은 회복됐다."] },
    ],
  }),
  E({
    id: "cr_wr_bestseller", career: "writer", step: [2, 2], age: [24, 80], emoji: "🏆", title: "베스트셀러 도전",
    desc: "차기작 원고가 나왔다. 편집자가 말한다. '이번 거, 크게 갈 수도 있어요.'", minYears: 2, weight: 1.4, repeat: 5, flagBanned: ["wr_best"],
    choices: [
      { id: "allin", emoji: "🚀", text: "홍보에 인세 선금까지 쏟는다", grade: "crit",
        outcomes: [
          { chance: 0.4, effects: { happy: +12, social: +6, money: +6000 }, grade: "crit", narrative: "종합 베스트셀러 1위. 서점 입구에 내 얼굴이 걸렸다.", life: {"step": 3, "job": {"title": "베스트셀러 작가", "salary": 6000}}, flag: {"add": ["wr_best"]} },
          { chance: 0.6, effects: { happy: -8, money: -1000 }, grade: "bad", narrative: "2편 징크스. 기대만큼 팔리지 않았다. 홍보비만 날렸다.", flag: {"add": ["wr_flop"]} },
        ] },
      { id: "quality", emoji: "🔍", text: "1년 더 고쳐서 완성도를 높인다", grade: "good",
        outcomes: [
          { chance: 0.5, effects: { happy: +10, intel: +5, money: +4000 }, grade: "crit", narrative: "평단과 독자 모두 극찬. 조용히 오래 팔리는 책이 됐다.", life: {"step": 3, "job": {"title": "베스트셀러 작가", "salary": 6000}}, flag: {"add": ["wr_best"]} },
          { chance: 0.5, effects: { happy: -4, money: -300 }, grade: "mid", narrative: "완벽해졌지만 시기를 놓쳤다. 비슷한 책이 먼저 나왔다." },
        ] },
    ],
  }),
  E({
    id: "cr_wr_royalty", career: "writer", step: [2, 4], age: [24, 80], emoji: "📝", title: "인세 협상",
    desc: "다른 출판사에서 연락이 왔다. 지금 출판사보다 좋은 조건을 주겠다고 한다.", repeat: 5,
    choices: [
      { id: "raise", emoji: "📈", text: "인세율 인상을 요구한다", grade: "good",
        outcomes: [
          { chance: 0.6, effects: { money: +1500, happy: +4 }, grade: "good", narrative: "12%로 올렸다. 계약서에 사인하는 손이 가벼웠다.", life: {"raise": 1.15} },
          { chance: 0.4, effects: { social: -3, happy: -3 }, grade: "bad", narrative: "협상이 틀어졌다. 오랜 편집자와 서먹해졌다." },
        ] },
      { id: "advance", emoji: "💵", text: "이적하고 선인세를 크게 받는다", grade: "mid", effects: { money: +3000, social: -2 }, narratives: ["목돈이 들어왔다. 그만큼 다음 책의 부담도 커졌다."] },
      { id: "loyal", emoji: "🤝", text: "의리로 지금 출판사에 남는다", grade: "good", effects: { social: +4, happy: +3 }, narratives: ["편집자가 울컥했다. 다음 책은 더 정성껏 만들어 주겠다고 했다."] },
    ],
  }),
  E({
    id: "cr_wr_adapt", career: "writer", step: [3, 4], age: [26, 85], emoji: "🎬", title: "드라마·영화화 제안",
    desc: "제작사에서 판권 계약서를 들고 왔다. 주연으로 거론되는 배우 이름이 화려하다.", repeat: 5, flagBanned: ["wr_screen"],
    choices: [
      { id: "sell", emoji: "💰", text: "판권을 판다", grade: "good", flag: {"add": ["wr_drama"]}, effects: { money: +4000, happy: +6, internet: +4 }, narratives: ["드라마가 방영됐다. 원작과 꽤 달랐지만, 책은 다시 1위로 올라왔다."] },
      { id: "script", emoji: "✏️", text: "각본을 직접 쓰겠다고 한다", grade: "crit",
        outcomes: [
          { chance: 0.45, effects: { money: +5000, happy: +10, social: +5 }, grade: "crit", narrative: "원작자가 쓴 각본으로 대히트. 시상식에서 각본상까지 받았다.", flag: {"add": ["wr_drama", "wr_screen"]} },
          { chance: 0.55, effects: { happy: -6, health: -4, money: +2000 }, grade: "bad", narrative: "방송 문법은 소설과 달랐다. 중간에 작가가 교체됐다.", flag: {"add": ["wr_drama"]} },
        ] },
      { id: "no", emoji: "🙅", text: "내 이야기를 지키려 거절", grade: "mid", effects: { happy: +3, intel: +2 }, narratives: ["'책으로만 남는 이야기도 있어야죠.' 인터뷰 한 줄이 화제가 됐다."] },
    ],
  }),
  E({
    id: "cr_wr_plagiarism", career: "writer", step: [2, 5], age: [25, 85], emoji: "⚠️", title: "표절 시비",
    desc: "인터넷에 '내 책이 해외 소설을 베꼈다'는 비교 글이 올라왔다. 출판사 전화가 울린다.", weight: 0.7, repeat: 5,
    choices: [
      { id: "prove", emoji: "📂", text: "집필 노트를 공개해 해명한다", grade: "good",
        outcomes: [
          { chance: 0.7, effects: { social: +4, happy: +3 }, grade: "good", narrative: "5년 전 노트까지 나오자 여론이 뒤집혔다. 오히려 팬이 늘었다." },
          { chance: 0.3, effects: { social: -4, happy: -6 }, grade: "bad", narrative: "해명해도 의심은 남았다. 한동안 책이 서점에서 빠졌다.", life: {"step": 2} },
        ] },
      { id: "sue", emoji: "⚖️", text: "명예훼손으로 고소한다", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { happy: +3, money: -500 }, grade: "mid", narrative: "승소했지만 변호사비가 더 들었다." },
          { chance: 0.5, effects: { happy: -6, money: -1500, social: -3 }, grade: "bad", narrative: "재판이 길어지며 지쳐 갔다. 그사이 신작은 한 줄도 못 썼다." },
        ] },
      { id: "silent", emoji: "🤐", text: "침묵한다", grade: "bad", life: {"step": 2}, effects: { happy: -5, social: -3 }, narratives: ["침묵은 인정으로 읽혔다. 몇 년이 지나서야 잠잠해졌다."] },
    ],
  }),
  E({
    id: "cr_wr_award", career: "writer", step: [3, 4], age: [33, 88], emoji: "🥇", title: "문학상 후보",
    desc: "국내 최고 권위의 문학상 최종 후보에 올랐다. 발표는 오늘 저녁이다.", minYears: 5, repeat: 5, flagBanned: ["wr_award"],
    choices: [
      { id: "wait", emoji: "📞", text: "전화를 기다린다", grade: "good",
        outcomes: [
          { chance: 0.4, effects: { happy: +14, social: +6, intel: +4, money: +5000 }, grade: "crit", narrative: "수상! 수상 소감에서 첫 투고 때 받은 거절 메일 이야기를 했다.", life: {"step": 4, "job": {"title": "문학상 수상 작가", "salary": 7000}}, flag: {"add": ["wr_award"]} },
          { chance: 0.6, effects: { happy: -5 }, grade: "mid", narrative: "전화는 오지 않았다. 친구들과 떡볶이를 먹으며 웃었다." },
        ] },
      { id: "skip", emoji: "🚶", text: "시상식은 신경 쓰지 않고 집필", grade: "mid", life: {"stepUp": 1}, effects: { intel: +4, happy: +2 }, narratives: ["발표 시간에도 원고를 쓰고 있었다. 상보다 다음 문장이 중요했다."] },
    ],
  }),
  E({
    id: "cr_wr_world", career: "writer", step: [4, 4], age: [38, 92], emoji: "🌍", title: "세계로",
    desc: "해외 에이전시에서 연락이 왔다. 내 책을 20개국에 번역 출간하자고 한다.", repeat: 5, flagBanned: ["wr_world"],
    choices: [
      { id: "go", emoji: "✈️", text: "번역가와 함께 해외 북투어", grade: "crit",
        outcomes: [
          { chance: 0.5, effects: { happy: +12, social: +8, money: +6000 }, grade: "crit", narrative: "런던, 파리, 뉴욕. 낯선 언어로 내 문장을 읽는 사람들을 만났다. 세계적인 작가가 됐다.", life: {"step": 5, "job": {"title": "세계적인 작가", "salary": 8000}}, flag: {"add": ["wr_world"]} },
          { chance: 0.5, effects: { happy: +3, health: -4, money: +1500 }, grade: "mid", narrative: "몇 나라에서 조용히 팔렸다. 시차와 강연에 지쳐 돌아왔다." },
        ] },
      { id: "home", emoji: "🏡", text: "국내 독자 곁에 남는다", grade: "mid", effects: { happy: +4, social: +2 }, narratives: ["번역은 맡기고 나는 동네 서점 북토크를 계속했다."] },
    ],
  }),
  E({
    id: "cr_wr_social", career: "writer", step: [2, 5], age: [28, 72], emoji: "📢", title: "화제가 된 사회 소설",
    desc: "사회 문제를 다룬 내 소설이 국회에서까지 인용됐다. 한 정당에서 영입 제안이 왔다.", weight: 0.6, cond: p => p.stats.social >= 40, repeat: 5,
    choices: [
      { id: "politics", emoji: "🏛️", text: "펜 대신 법으로 바꾸겠다 — 수락", grade: "mid", career: "politics", life: {"step": 1, "job": {"title": "정당 영입 인사", "salary": 3500}}, flag: {"add": ["wr_to_pol"]}, effects: { social: +6, happy: +3 }, narratives: ["비례대표 후보 명단에 이름이 올랐다. 작가에서 정치인으로, 새 이야기가 시작됐다."] },
      { id: "stay", emoji: "🖋️", text: "작가로 남아 계속 쓴다", grade: "good", flag: {"add": ["wr_social"]}, effects: { intel: +3, happy: +4 }, narratives: ["'제 무기는 문장입니다.' 정중히 거절하고 후속작을 썼다."] },
    ],
  }),
  E({
    id: "cr_wr_last", career: "writer", step: [1, 5], age: [66, 100], emoji: "🕯️", title: "마지막 원고",
    desc: "손이 예전 같지 않다. 그래도 쓰고 싶은 이야기가 하나 남았다.", repeat: 5,
    choices: [
      { id: "memoir", emoji: "📖", text: "내 인생을 쓴다", grade: "good", flag: {"add": ["wr_last_book"]}, effects: { happy: +7, intel: +2 }, narratives: ["마지막 장에 '고마웠다'라고 썼다. 편집자가 원고를 받아 들고 한참 말이 없었다."] },
      { id: "kids", emoji: "🧸", text: "손주들을 위한 동화를 쓴다", grade: "good", flag: {"add": ["wr_last_book"]}, effects: { happy: +8, social: +3 }, narratives: ["손주가 그림을 그리고 내가 글을 썼다. 세상에 단 한 권뿐인 책."] },
      { id: "stop", emoji: "🖊️", text: "펜을 내려놓는다", grade: "mid", life: {"careerEnd": true}, effects: { health: +3, happy: +3 }, narratives: ["평생 쓴 원고 더미를 정리했다. 할 만큼 했다."] },
    ],
  }),
  E({
    id: "cr_co_training", career: "corporate", step: [0, 0], age: [22, 34], emoji: "🎓", title: "신입사원 연수",
    desc: "합숙 연수 마지막 날 장기자랑. 동기 200명과 임원들이 보고 있다.", weight: 2.0, repeat: 5,
    choices: [
      { id: "show", emoji: "🕺", text: "무대를 찢는다", grade: "good", next: {"id": "cr_co_dept", "after": 1}, effects: { social: +6, happy: +4 }, narratives: ["사장님이 박수를 쳤다. '그 친구 누구야?' 첫인상은 확실히 남겼다."] },
      { id: "plan", emoji: "📋", text: "기획 담당으로 뒤에서 조율", grade: "good", next: {"id": "cr_co_dept", "after": 1}, effects: { intel: +4, social: +3 }, narratives: ["팀 공연이 1등을 했다. 인사팀 수첩에 내 이름이 적혔다."] },
      { id: "quiet", emoji: "🫥", text: "조용히 박수만 친다", grade: "mid", next: {"id": "cr_co_dept", "after": 1}, effects: { happy: +1 }, narratives: ["무난하게 연수를 마쳤다. 동기 단톡방은 평생 갈 것 같다."] },
    ],
  }),
  E({
    id: "cr_co_dept", career: "corporate", age: [22, 36], emoji: "🗂️", title: "부서 배치",
    desc: "인사 발령 공지가 떴다. 희망 부서를 하나 고를 수 있다.", followup: true,
    choices: [
      { id: "sales", emoji: "🤝", text: "영업 — 실적이 곧 실력", grade: "good", life: {"step": 1}, flag: {"add": ["co_sales"]}, effects: { social: +6, health: -2, money: +300 }, narratives: ["첫 달 술자리 열두 번. 거래처 부장님 생일을 외우게 됐다."] },
      { id: "plan", emoji: "📊", text: "전략기획 — 회사의 두뇌", grade: "good", life: {"step": 1}, flag: {"add": ["co_plan"]}, effects: { intel: +6, health: -2 }, narratives: ["보고서 1장을 위해 엑셀 50장을 만들었다. 임원 보고에 처음 들어갔다."] },
      { id: "global", emoji: "🌏", text: "해외사업 — 세계로", grade: "mid", life: {"step": 1}, flag: {"add": ["co_global"]}, effects: { intel: +3, social: +3, happy: +3 }, narratives: ["시차 때문에 새벽 회의가 일상이 됐다. 영어 이메일 실력은 확실히 늘었다."] },
    ],
  }),
  E({
    id: "cr_co_boss", career: "corporate", step: [1, 3], age: [23, 52], emoji: "😤", title: "갑질 팀장",
    desc: "팀장이 주말에도 카톡을 보낸다. 오늘은 회의실에서 서류를 집어던졌다.", repeat: 5,
    choices: [
      { id: "endure", emoji: "😶", text: "참는다", grade: "mid", effects: { happy: -6, health: -3, money: +200 }, narratives: ["버텼다. 팀장은 승진해서 떠났다. 위장약이 서랍에 남았다."] },
      { id: "report", emoji: "📨", text: "인사팀에 정식 신고", grade: "good",
        outcomes: [
          { chance: 0.55, effects: { happy: +6, social: +3 }, grade: "good", narrative: "조사 끝에 팀장이 징계를 받았다. 동료들이 몰래 커피를 사 줬다." },
          { chance: 0.45, effects: { happy: -6, social: -4 }, grade: "bad", narrative: "흐지부지 끝났다. 나만 '예민한 사람'이 됐다.", flag: {"add": ["co_marked"]} },
        ] },
      { id: "transfer", emoji: "🔀", text: "부서 이동을 신청한다", grade: "mid",
        outcomes: [
          { chance: 0.6, effects: { happy: +5 }, grade: "good", narrative: "새 팀은 천국이었다. 진작 옮길 걸." },
          { chance: 0.4, effects: { happy: -3 }, grade: "mid", narrative: "옮긴 곳에도 비슷한 사람이 있었다. 사람은 어디에나 있다." },
        ] },
    ],
  }),
  E({
    id: "cr_co_project", career: "corporate", step: [1, 2], age: [24, 50], emoji: "🚧", title: "대형 프로젝트",
    desc: "회사의 사활이 걸린 신제품 프로젝트에 차출됐다. 기한은 6개월.", weight: 1.3, repeat: 5, flagBanned: ["co_star"],
    choices: [
      { id: "allnight", emoji: "🌙", text: "밤샘으로 끝장을 본다", grade: "good",
        outcomes: [
          { chance: 0.55, effects: { intel: +4, happy: +6, health: -6, money: +800 }, grade: "crit", narrative: "대성공. 사장 표창과 특별 보너스. '에이스'라는 별명이 붙었다.", life: {"step": 2, "raise": 1.1}, flag: {"add": ["co_star"]} },
          { chance: 0.45, effects: { health: -8, happy: -6 }, grade: "bad", narrative: "출시가 연기됐다. 책임은 실무자에게 돌아왔다.", life: {"step": 1} },
        ] },
      { id: "team", emoji: "🤝", text: "팀원들과 일을 나눈다", grade: "good",
        outcomes: [
          { chance: 0.6, effects: { social: +6, happy: +4 }, grade: "good", narrative: "무리 없이 성공. 팀원들이 다음 프로젝트도 같이 하자고 했다.", life: {"step": 2} },
          { chance: 0.4, effects: { happy: -3 }, grade: "mid", narrative: "무난했지만 눈에 띄지는 않았다." },
        ] },
      { id: "dodge", emoji: "🫣", text: "슬쩍 발을 뺀다", grade: "bad", effects: { health: +2, social: -4 }, narratives: ["프로젝트는 성공했고, 내 이름은 거기 없었다."] },
    ],
  }),
  E({
    id: "cr_co_eval", career: "corporate", step: [1, 3], age: [26, 56], emoji: "📋", title: "인사평가 시즌",
    desc: "연말 인사평가 면담. 팀장이 묻는다. '올해 본인 성과를 한 줄로 말해 봐요.'", repeat: 5,
    choices: [
      { id: "pitch", emoji: "📣", text: "숫자로 또박또박 어필", grade: "good",
        outcomes: [
          { chance: 0.55, effects: { happy: +6, money: +500 }, grade: "good", narrative: "S등급. 성과급이 두둑했다.", life: {"raise": 1.08, "stepUp": 1} },
          { chance: 0.45, effects: { happy: -3 }, grade: "mid", narrative: "B등급. '다들 잘했어요'라는 말만 들었다." },
        ] },
      { id: "humble", emoji: "🙂", text: "겸손하게 팀 덕분이라고", grade: "mid", effects: { social: +4 }, narratives: ["팀 분위기는 좋아졌다. 성과급은 평균이었다."] },
      { id: "blunt", emoji: "😑", text: "'솔직히 연봉이 문제입니다'", grade: "bad", effects: { happy: +2, social: -3 }, narratives: ["면담실 공기가 얼어붙었다. 그래도 속은 시원했다."] },
    ],
  }),
  E({
    id: "cr_co_promo", career: "corporate", step: [2, 2], age: [30, 52], emoji: "📈", title: "부장 승진 심사",
    desc: "부장 자리 하나에 후보가 셋. 그중 하나는 입사 동기다.", minYears: 6, weight: 1.4, repeat: 5,
    choices: [
      { id: "perform", emoji: "🏃", text: "실적으로 승부한다", grade: "good",
        outcomes: [
          { chance: 0.5, effects: { happy: +8, social: +3 }, grade: "crit", narrative: "부장 승진. 명함이 바뀌던 날 부모님께 사진을 보냈다.", life: {"step": 3, "job": {"title": "대기업 부장", "salary": 10500}} },
          { chance: 0.5, effects: { happy: -7 }, grade: "bad", narrative: "동기가 승진했다. 축하 회식에서 웃는 얼굴이 굳었다.", flag: {"add": ["co_passed_over"]} },
        ] },
      { id: "golf", emoji: "⛳", text: "임원과 주말 골프", grade: "mid",
        outcomes: [
          { chance: 0.55, effects: { social: +5, money: -300, happy: +4 }, grade: "good", narrative: "버디 대신 눈도장. 부장이 됐다.", life: {"step": 3, "job": {"title": "대기업 부장", "salary": 10500}} },
          { chance: 0.45, effects: { money: -500, happy: -6 }, grade: "bad", narrative: "골프채 값만 날렸다. 승진은 다른 사람이었다.", flag: {"add": ["co_passed_over"]} },
        ] },
      { id: "yield", emoji: "🫱", text: "동기에게 양보한다", grade: "mid", effects: { social: +5, happy: -2 }, narratives: ["동기가 술을 샀다. '다음은 네 차례야.'"] },
    ],
  }),
  E({
    id: "cr_co_politics", career: "corporate", step: [2, 4], age: [30, 57], emoji: "♟️", title: "사내 정치",
    desc: "두 임원의 세력 다툼이 시작됐다. 어느 쪽에 설지 다들 눈치를 본다.", repeat: 5,
    choices: [
      { id: "side", emoji: "🎲", text: "한쪽 라인에 확실히 선다", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { social: +4, happy: +5, money: +500 }, grade: "good", narrative: "내 라인이 이겼다. 핵심 부서로 발탁됐다.", life: {"raise": 1.1} },
          { chance: 0.5, effects: { happy: -8, social: -4 }, grade: "bad", narrative: "반대편이 이겼다. 지방 지사로 발령이 났다.", flag: {"add": ["co_exiled"]} },
        ] },
      { id: "neutral", emoji: "⚖️", text: "중립을 지킨다", grade: "good", effects: { happy: +2, social: +2 }, narratives: ["어느 쪽도 나를 챙기지 않았지만, 아무도 나를 해치지도 않았다."] },
      { id: "tf", emoji: "🧪", text: "신사업 TF로 자원해 빠져나간다", grade: "good", flag: {"add": ["co_newbiz"]}, effects: { intel: +4, happy: +3 }, narratives: ["싸움판을 떠나 새 일을 배웠다. 의외로 적성에 맞았다."] },
    ],
  }),
  E({
    id: "cr_co_overseas", career: "corporate", step: [1, 3], age: [28, 50], emoji: "✈️", title: "해외 주재원 제안",
    desc: "3년간 해외 지사 근무 제안이 왔다. 경력엔 큰 도움이 된다.", repeat: 5, flagBanned: ["co_abroad"],
    choices: [
      { id: "go", emoji: "🛫", text: "간다", grade: "good",
        outcomes: [
          { chance: 0.65, effects: { intel: +5, social: +4, happy: +5, money: +2000 }, grade: "crit", narrative: "주재원 수당으로 돈도 모이고 시야도 넓어졌다. 돌아오자 승진 1순위가 됐다.", life: {"stepUp": 1, "raise": 1.1}, flag: {"add": ["co_abroad"]} },
          { chance: 0.35, effects: { happy: -6, health: -4 }, grade: "bad", narrative: "현지 적응에 실패했다. 외로움에 지쳐 1년 만에 돌아왔다." },
        ] },
      { id: "stay", emoji: "🏠", text: "가족과 한국에 남는다", grade: "mid", effects: { happy: +3, social: +2 }, narratives: ["기회는 다른 사람에게 갔다. 저녁 식탁은 지켰다."] },
    ],
  }),
  E({
    id: "cr_co_whistle", career: "corporate", step: [2, 4], age: [30, 58], emoji: "🧾", title: "회계 부정",
    desc: "결산 자료에서 이상한 숫자를 발견했다. 윗선이 알고도 덮고 있는 것 같다.", weight: 0.6, repeat: 5,
    choices: [
      { id: "blow", emoji: "📣", text: "내부고발한다", grade: "crit",
        outcomes: [
          { chance: 0.45, effects: { happy: +6, social: +6, internet: +5 }, grade: "crit", narrative: "감사가 시작됐다. 회사는 흔들렸지만 나는 '양심'의 상징이 됐다.", flag: {"add": ["co_whistle"]} },
          { chance: 0.55, effects: { happy: -10, money: -1500, social: -4 }, grade: "bad", narrative: "보복 인사. 결국 회사를 나왔다. 재판은 3년이 걸렸다.", life: {"careerEnd": true}, flag: {"add": ["co_whistle"]} },
        ] },
      { id: "report_up", emoji: "📤", text: "직속 상사에게만 보고", grade: "mid", effects: { social: +2, happy: -2 }, narratives: ["'알아서 처리하겠다'는 답이 왔다. 아무 일도 처리되지 않았다."] },
      { id: "ignore", emoji: "🙈", text: "모른 척한다", grade: "bad", effects: { happy: -5 }, narratives: ["2년 뒤 뉴스에 회사 이름이 나왔다. 그때 그 숫자였다."] },
    ],
  }),
  E({
    id: "cr_co_exec", career: "corporate", step: [3, 3], age: [42, 58], emoji: "🏅", title: "임원 승진 도전",
    desc: "'별'을 다는 임원 인사가 다가온다. 동기 중 남은 사람은 셋.", minYears: 12, weight: 1.4, repeat: 5, flagBanned: ["co_exec"],
    choices: [
      { id: "push", emoji: "🔥", text: "마지막 승부 — 신사업을 맡겠다", grade: "good",
        outcomes: [
          { chance: 0.45, effects: { happy: +12, social: +5, health: -4 }, grade: "crit", narrative: "상무 승진. 기사에 이름이 실렸다. 운전기사가 딸린 차가 나왔다.", life: {"step": 4, "job": {"title": "대기업 상무", "salary": 16000}}, flag: {"add": ["co_exec"]} },
          { chance: 0.55, effects: { happy: -9 }, grade: "bad", narrative: "명단에 내 이름은 없었다. 후배가 상무가 됐다.", flag: {"add": ["co_exec_fail"]}, next: {"id": "cr_co_crossroad", "after": 1} },
        ] },
      { id: "content", emoji: "☕", text: "부장으로 정년까지 가겠다", grade: "mid", flag: {"add": ["co_content"]}, effects: { happy: +4, health: +3 }, narratives: ["욕심을 내려놨다. 퇴근 후 저녁이 생겼다."] },
    ],
  }),
  E({
    id: "cr_co_ceo", career: "corporate", step: [4, 4], age: [50, 62], emoji: "🏙️", title: "사장 후보",
    desc: "그룹 회장이 독대를 청했다. '다음 사장 후보로 자네를 생각하고 있네.'", flagRequired: ["co_exec"], repeat: 5, flagBanned: ["co_ceo"],
    choices: [
      { id: "accept", emoji: "🤵", text: "받아들인다", grade: "crit",
        outcomes: [
          { chance: 0.5, effects: { happy: +14, social: +8, health: -5 }, grade: "crit", narrative: "대표이사 취임. 신입 연수 때 장기자랑 하던 그 무대 위에 다시 섰다.", life: {"step": 5, "job": {"title": "대기업 사장", "salary": 30000}}, flag: {"add": ["co_ceo"]} },
          { chance: 0.5, effects: { happy: -8, health: -3 }, grade: "bad", narrative: "막판에 외부 인사가 영입됐다. 계열사 고문 자리가 남았다." },
        ] },
      { id: "decline", emoji: "🙏", text: "사양하고 후배를 추천한다", grade: "mid", effects: { social: +6, happy: +4 }, narratives: ["후배가 사장이 됐다. 취임식에서 나를 향해 고개를 숙였다."] },
    ],
  }),
  E({
    id: "cr_co_crossroad", career: "corporate", step: [1, 4], age: [32, 56], emoji: "🛤️", title: "갈림길",
    desc: "15년 다닌 회사. 경쟁사 스카우트, 창업 아이템, 그리고 익숙한 내 책상.", minYears: 8, repeat: 5,
    choices: [
      { id: "jump", emoji: "🔀", text: "연봉 30% 올려 경쟁사로 이직", grade: "good", life: {"raise": 1.3}, effects: { money: +1000, happy: +4, social: -2 }, narratives: ["새 회사의 명함이 어색했다. 통장은 확실히 달라졌다."] },
      { id: "startup", emoji: "🚀", text: "퇴사하고 창업한다", grade: "crit", career: "business", life: {"step": 0, "job": {"title": "창업자", "salary": 2000}}, flag: {"add": ["co_to_biz"]}, effects: { happy: +6, money: -3000 }, narratives: ["사표를 냈다. 퇴직금으로 사무실 보증금을 냈다. 사업가로서의 첫날이다."] },
      { id: "stay", emoji: "🪑", text: "남는다", grade: "mid", effects: { happy: +1 }, narratives: ["익숙한 의자에 다시 앉았다. 안정도 하나의 선택이었다."] },
    ],
  }),
  E({
    id: "cr_wk_unpaid", career: "worker", step: [0, 2], age: [23, 58], emoji: "💸", title: "밀린 월급",
    desc: "이번 달 월급이 안 들어왔다. 사장님은 '다음 달에 한꺼번에'라고 한다.", repeat: 5,
    choices: [
      { id: "wait", emoji: "⏳", text: "믿고 기다린다", grade: "mid", effects: { money: -300, happy: -4 }, narratives: ["두 달 뒤 반만 들어왔다. 카드값이 밀렸다."] },
      { id: "report", emoji: "🏛️", text: "노동청에 신고한다", grade: "good",
        outcomes: [
          { chance: 0.7, effects: { happy: +4, social: -2 }, grade: "good", narrative: "체불 임금을 다 받았다. 회사 분위기는 싸해졌다." },
          { chance: 0.3, effects: { happy: -5, money: -500 }, grade: "bad", narrative: "회사가 그사이 문을 닫았다. 대지급금 절차가 남았다.", life: {"quit": true} },
        ] },
      { id: "leave", emoji: "🚪", text: "바로 다른 회사로 옮긴다", grade: "good", life: {"raise": 1.05}, effects: { happy: +3 }, narratives: ["면접 세 번 만에 새 직장을 구했다. 연봉도 조금 올랐다."] },
    ],
  }),
  E({
    id: "cr_wk_multi", career: "worker", step: [0, 1], age: [23, 50], emoji: "🧑‍💻", title: "혼자 3인분",
    desc: "퇴사자 자리를 안 뽑는다. 회계, 총무, 영업 지원까지 다 내 일이 됐다.", repeat: 5,
    choices: [
      { id: "grind", emoji: "🔨", text: "묵묵히 다 해낸다", grade: "good", life: {"stepUp": 1}, effects: { intel: +4, health: -4 }, narratives: ["회사 일을 제일 잘 아는 사람이 됐다. 사장님이 나 없이는 안 된다고 한다."] },
      { id: "ask", emoji: "🙋", text: "사람을 더 뽑아 달라고 한다", grade: "good",
        outcomes: [
          { chance: 0.5, effects: { happy: +5, social: +2 }, grade: "good", narrative: "후배가 들어왔다. 처음으로 사수가 됐다.", life: {"stepUp": 1} },
          { chance: 0.5, effects: { happy: -4 }, grade: "mid", narrative: "'요즘 다 어렵잖아.' 대답은 그게 끝이었다." },
        ] },
      { id: "slack", emoji: "😮‍💨", text: "할 수 있는 만큼만 한다", grade: "mid", effects: { health: +2, social: -2 }, narratives: ["정시 퇴근을 지켰다. 일은 쌓였지만 내 몸은 지켰다."] },
    ],
  }),
  E({
    id: "cr_wk_side", career: "worker", step: [1, 3], age: [25, 56], emoji: "🌙", title: "퇴근 후의 부업",
    desc: "월급만으로는 빠듯하다. 퇴근 후 시간을 어디에 쓸까?", repeat: 5,
    choices: [
      { id: "shop", emoji: "📦", text: "온라인 쇼핑몰을 연다", grade: "good",
        outcomes: [
          { chance: 0.3, effects: { money: +2000, happy: +8 }, grade: "crit", narrative: "부업 매출이 월급을 넘었다. 사표를 쓰고 사업가가 됐다.", career: "business", life: {"step": 1, "job": {"title": "온라인몰 대표", "salary": 4500}} },
          { chance: 0.7, effects: { money: -200, health: -3 }, grade: "mid", narrative: "재고만 쌓였다. 베란다가 창고가 됐다." },
        ] },
      { id: "channel", emoji: "🎥", text: "취미 유튜브 채널을 키운다", grade: "good",
        outcomes: [
          { chance: 0.3, effects: { internet: +8, happy: +8, money: +500 }, grade: "crit", narrative: "구독자 10만. MCN에서 전업 제안이 왔다. 회사를 나와 유튜버가 됐다.", career: "streamer", life: {"step": 1} },
          { chance: 0.7, effects: { internet: +3, health: -2 }, grade: "mid", narrative: "구독자 312명. 그래도 댓글 하나하나가 즐거웠다." },
        ] },
      { id: "rest", emoji: "🛋️", text: "저녁은 쉬는 시간이다", grade: "mid", effects: { health: +3, happy: +3 }, narratives: ["넷플릭스와 치킨. 내일 출근할 힘은 남았다."] },
    ],
  }),
  E({
    id: "cr_wk_promo", career: "worker", step: [1, 1], age: [29, 52], emoji: "📈", title: "과장 승진",
    desc: "작은 회사지만 과장 자리가 생겼다. 후보는 나와 경력직 한 명.", minYears: 4, repeat: 5,
    choices: [
      { id: "prove", emoji: "💪", text: "성과로 보여 준다", grade: "good",
        outcomes: [
          { chance: 0.55, effects: { happy: +8, money: +300 }, grade: "crit", narrative: "과장이 됐다. 명함에 직함이 하나 붙었다.", life: {"step": 2, "job": {"title": "중소기업 과장", "salary": 4800}} },
          { chance: 0.45, effects: { happy: -6 }, grade: "bad", narrative: "경력직이 됐다. '다음엔 꼭'이라는 말을 들었다." },
        ] },
      { id: "skip", emoji: "🙂", text: "승진보다 워라밸", grade: "mid", effects: { happy: +4, health: +2 }, narratives: ["과장 대신 저녁을 택했다. 동네 배드민턴 모임에 나가기 시작했다."] },
    ],
  }),
  E({
    id: "cr_wk_nepo", career: "worker", step: [1, 3], age: [27, 56], emoji: "👶", title: "사장 아들 낙하산",
    desc: "사장 아들이 '본부장'으로 왔다. 업무는 모르는데 지시는 많다.", repeat: 5,
    choices: [
      { id: "teach", emoji: "🧑‍🏫", text: "차근차근 가르쳐 준다", grade: "good", flag: {"add": ["wk_heir_ally"]}, effects: { social: +5, happy: -2 }, narratives: ["본부장이 의외로 고마워했다. '형님'이라 부르기 시작했다."] },
      { id: "clash", emoji: "💥", text: "틀린 건 틀렸다고 한다", grade: "bad", effects: { happy: +3, social: -4 }, narratives: ["회의실이 조용해졌다. 다음 인사에서 한직으로 밀렸다."] },
      { id: "leave", emoji: "🚶", text: "이참에 이직 준비", grade: "mid", life: {"raise": 1.08}, effects: { intel: +2, happy: +2 }, narratives: ["이력서를 업데이트했다. 쓸 게 생각보다 많았다."] },
    ],
  }),
  E({
    id: "cr_wk_crisis", career: "worker", step: [2, 2], age: [33, 58], emoji: "🌊", title: "회사가 흔들린다",
    desc: "큰 거래처가 끊겼다. 사장님이 '같이 살려 보자'며 고개를 숙였다.", weight: 0.8, repeat: 5,
    choices: [
      { id: "save", emoji: "🛟", text: "남아서 회사를 살린다", grade: "crit",
        outcomes: [
          { chance: 0.5, effects: { happy: +10, social: +6, money: +1000 }, grade: "crit", narrative: "새 거래처를 뚫었다. 회사가 살아났다. 사장님이 지분 일부를 나눠 줬다.", life: {"step": 3, "job": {"title": "중소기업 이사", "salary": 7000}} },
          { chance: 0.5, effects: { happy: -8, money: -1000 }, grade: "bad", narrative: "버텼지만 결국 폐업했다. 퇴직금은 반만 받았다.", life: {"quit": true, "step": 1} },
        ] },
      { id: "jump", emoji: "🪂", text: "퇴직금 챙겨 먼저 나간다", grade: "mid", life: {"quit": true}, effects: { money: +500, social: -3 }, narratives: ["석 달 뒤 회사는 문을 닫았다. 빠른 판단이었다."] },
    ],
  }),
  E({
    id: "cr_wk_skill", career: "worker", step: [1, 4], age: [28, 55], emoji: "🧰", title: "새 기술을 배울까",
    desc: "회사 업무가 자동화되고 있다. 이대로면 10년 뒤 내 자리는?", repeat: 5,
    choices: [
      { id: "code", emoji: "💻", text: "야간 코딩 학원에 다닌다", grade: "good",
        outcomes: [
          { chance: 0.45, effects: { intel: +6, happy: +6 }, grade: "crit", narrative: "1년 만에 개발자로 전직했다. 연봉이 확 뛰었다.", career: "developer", life: {"step": 1, "job": {"title": "주니어 개발자", "salary": 4200}} },
          { chance: 0.55, effects: { intel: +3, health: -3 }, grade: "mid", narrative: "어려웠다. 그래도 업무 자동화 스크립트 정도는 짤 수 있게 됐다.", life: {"raise": 1.05} },
        ] },
      { id: "cert", emoji: "📜", text: "직무 자격증을 딴다", grade: "good", life: {"raise": 1.06, "stepUp": 1}, effects: { intel: +4, money: -100 }, narratives: ["자격증 수당이 붙었다. 사내에서 대체 불가능한 사람이 됐다."] },
      { id: "no", emoji: "🤷", text: "지금도 충분히 바쁘다", grade: "mid", effects: { happy: +1 }, narratives: ["그럭저럭 지나갔다. 신입이 엑셀 매크로를 쓰는 걸 보며 조금 불안해졌다."] },
    ],
  }),
  E({
    id: "cr_wk_long", career: "worker", step: [2, 4], age: [45, 59], emoji: "🎖️", title: "20년 근속",
    desc: "근속 20주년 기념패를 받았다. 사장님이 '이제 뭘 하고 싶나?' 하고 묻는다.", minYears: 15, repeat: 5,
    choices: [
      { id: "stay", emoji: "🪴", text: "정년까지 이 회사에서", grade: "good", life: {"step": 4}, flag: {"add": ["wk_loyal"]}, effects: { happy: +5, social: +3 }, narratives: ["후배들이 '회사의 역사'라고 불렀다. 그 말이 싫지 않았다."] },
      { id: "own", emoji: "🏪", text: "퇴직금으로 내 가게를 연다", grade: "mid", career: "business", life: {"step": 1, "job": {"title": "가게 사장", "salary": 3500}}, effects: { money: -2000, happy: +6 }, narratives: ["20년 모은 경험으로 가게를 열었다. 사장님이 첫 손님으로 왔다."] },
    ],
  }),
  E({
    id: "cr_cv_exam", age: [21, 34], emoji: "📚", title: "공무원 시험",
    desc: "'철밥통'이 되고 싶다. 노량진 학원 등록 상담을 받고 왔다.", careerEntry: "civil", weight: 0.8, cond: p => p.stats.intel >= 45,
    choices: [
      { id: "allin", emoji: "🔥", text: "2년 올인", grade: "good",
        outcomes: [
          { chance: 0.45, effects: { happy: +10, intel: +4 }, grade: "crit", narrative: "합격자 명단에 내 수험번호가 있었다. 엄마가 울었다.", career: "civil", life: {"job": {"title": "9급 공무원", "salary": 3300}} },
          { chance: 0.55, effects: { happy: -9, health: -4, money: -800 }, grade: "bad", narrative: "0.5점 차 불합격. 학원비와 2년이 남았다.", flag: {"add": ["cv_failed"]} },
        ] },
      { id: "no", emoji: "🙅", text: "나랑은 안 맞는다", grade: "mid", effects: { happy: +1 }, narratives: ["상담실을 나오며 다른 길을 찾기로 했다."] },
    ],
  }),
  E({
    id: "cr_cv_complaint", career: "civil", step: [0, 3], age: [22, 60], emoji: "📞", title: "악성 민원",
    desc: "같은 민원인이 오늘도 왔다. 벌써 37번째다. 목소리가 커진다.", repeat: 6,
    choices: [
      { id: "calm", emoji: "🧘", text: "끝까지 친절하게 응대", grade: "good", effects: { social: +4, happy: -3 }, narratives: ["2시간 뒤 민원인이 '고생 많네' 하고 갔다. 그날 저녁 아무 말도 하기 싫었다."] },
      { id: "rule", emoji: "📏", text: "규정대로 단호하게", grade: "mid", effects: { happy: +2, social: -2 }, narratives: ["민원이 상급기관으로 올라갔다. 해명서를 세 장 썼다."] },
      { id: "help", emoji: "🤝", text: "진짜 문제를 찾아 해결한다", grade: "crit", flag: {"add": ["cv_kind"]}, effects: { social: +5, intel: +3, happy: +4 }, narratives: ["알고 보니 보조금 신청을 몰라서였다. 서류를 같이 써 줬다. 다음 날 귤 한 봉지가 왔다."] },
    ],
  }),
  E({
    id: "cr_cv_disaster", career: "civil", step: [1, 3], age: [24, 60], emoji: "🌀", title: "태풍 비상근무",
    desc: "태풍 경보. 주민센터에 비상이 걸렸다. 사흘째 집에 못 갔다.", repeat: 5,
    choices: [
      { id: "field", emoji: "🦺", text: "침수 지역에 직접 나간다", grade: "crit", life: {"stepUp": 1}, flag: {"add": ["cv_hero"]}, effects: { social: +6, health: -5, happy: +4 }, narratives: ["홀몸 어르신을 업고 나왔다. 지역 신문에 사진이 실렸다."] },
      { id: "desk", emoji: "🖥️", text: "상황실에서 지원을 조율", grade: "good", effects: { intel: +4, health: -3 }, narratives: ["구호물자가 제때 도착했다. 아무도 몰랐지만 내 엑셀 덕분이었다."] },
    ],
  }),
  E({
    id: "cr_cv_promo", career: "civil", step: [1, 1], age: [28, 58], emoji: "🗂️", title: "승진 심사",
    desc: "6급 승진 대상이 됐다. 근무평정은 비슷비슷하다. 차이는 어디서 날까?", minYears: 6, repeat: 5,
    choices: [
      { id: "work", emoji: "📂", text: "기피 업무를 자원한다", grade: "good",
        outcomes: [
          { chance: 0.6, effects: { happy: +6, social: +3 }, grade: "crit", narrative: "힘든 부서를 버텨 낸 점이 인정받았다. 6급 주무관이 됐다.", life: {"step": 2, "job": {"title": "6급 주무관", "salary": 4800}} },
          { chance: 0.4, effects: { health: -5, happy: -4 }, grade: "bad", narrative: "고생만 하고 순위에서 밀렸다." },
        ] },
      { id: "wait", emoji: "⏳", text: "순서를 기다린다", grade: "mid", life: {"step": 2, "job": {"title": "6급 주무관", "salary": 4800}}, effects: { happy: +1 }, narratives: ["2년 뒤 순서대로 승진했다. 공무원다운 속도였다."] },
    ],
  }),
  E({
    id: "cr_cv_order", career: "civil", step: [2, 4], age: [30, 59], emoji: "⚖️", title: "위에서 내려온 지시",
    desc: "국장이 특정 업체에 유리하게 서류를 고치라고 한다. '다들 이렇게 해.'", weight: 0.7, repeat: 5,
    choices: [
      { id: "refuse", emoji: "✋", text: "거부하고 기록을 남긴다", grade: "crit",
        outcomes: [
          { chance: 0.6, effects: { happy: +5, social: +3 }, grade: "good", narrative: "감사에서 내 기록이 결정적 증거가 됐다. 국장은 징계, 나는 표창.", flag: {"add": ["cv_integrity"]} },
          { chance: 0.4, effects: { happy: -6 }, grade: "bad", narrative: "시골 출장소로 발령이 났다. 그래도 떳떳했다.", flag: {"add": ["cv_integrity"]} },
        ] },
      { id: "obey", emoji: "🙇", text: "시키는 대로 한다", grade: "bad",
        outcomes: [
          { chance: 0.5, effects: { happy: -4 }, grade: "mid", narrative: "아무 일도 없었다. 마음 한구석이 계속 불편했다." },
          { chance: 0.5, effects: { happy: -12, money: -1500, social: -6 }, grade: "bad", narrative: "감사에 걸렸다. 지시한 사람은 빠지고 나만 징계를 받았다.", life: {"step": 1} },
        ] },
    ],
  }),
  E({
    id: "cr_cv_chief", career: "civil", step: [2, 4], age: [44, 59], emoji: "🏅", title: "사무관 승진",
    desc: "5급 사무관 승진 시험 공고가 떴다. 이번이 마지막 기회일지 모른다.", minYears: 15, repeat: 5, flagBanned: ["cv_chief"],
    choices: [
      { id: "study", emoji: "📖", text: "퇴근 후 다시 수험생", grade: "good",
        outcomes: [
          { chance: 0.45, effects: { happy: +10, intel: +4 }, grade: "crit", narrative: "합격. 사무관이 됐다. 30년 전 노량진의 나에게 말해 주고 싶었다.", life: {"step": 4, "job": {"title": "5급 사무관", "salary": 7200}}, flag: {"add": ["cv_chief"]} },
          { chance: 0.55, effects: { happy: -5, health: -3 }, grade: "bad", narrative: "떨어졌다. 그래도 공부하는 모습을 아이가 봤다." },
        ] },
      { id: "pass", emoji: "🌅", text: "지금 자리에서 정년을 맞는다", grade: "mid", life: {"step": 4}, effects: { happy: +4, health: +2 }, narratives: ["욕심 없이 내 일을 했다. 퇴근길 노을이 예뻤다."] },
    ],
  }),
  E({
    id: "cr_cv_run", career: "civil", step: [3, 5], age: [42, 60], emoji: "🗳️", title: "구청장 출마 권유",
    desc: "30년 지역 행정을 맡아 온 나에게, 주민 대표들이 구청장 출마를 권한다.", cond: p => p.stats.social >= 55, weight: 0.6, repeat: 5, flagBanned: ["cv_to_pol", "pol_local_win"],
    choices: [
      { id: "run", emoji: "🏛️", text: "명예퇴직하고 출마한다", grade: "crit",
        outcomes: [
          { chance: 0.45, effects: { social: +8, happy: +10 }, grade: "crit", narrative: "행정 전문가로 당선. 정치인이 됐다.", career: "politics", life: {"step": 2, "job": {"title": "구청장", "salary": 11000}}, flag: {"add": ["pol_local_win", "cv_to_pol"]} },
          { chance: 0.55, effects: { happy: -8, money: -2000 }, grade: "bad", narrative: "낙선. 연금과 함께 조용한 노후가 시작됐다.", life: {"careerEnd": true} },
        ] },
      { id: "no", emoji: "🙏", text: "공무원으로 남겠다", grade: "mid", effects: { happy: +2 }, narratives: ["'저는 뒤에서 일하는 게 맞아요.' 대표들이 아쉬워했다."] },
    ],
  }),
  E({
    id: "cr_dev_entry", age: [19, 40], emoji: "💻", title: "코딩을 배워 볼까",
    desc: "친구가 개발자로 이직해서 연봉이 확 올랐다고 한다. 나도 해 볼까?", careerEntry: "developer", weight: 0.9, cond: p => p.stats.intel >= 55 || p.stats.internet >= 55,
    choices: [
      { id: "bootcamp", emoji: "🏕️", text: "6개월 부트캠프", grade: "good",
        outcomes: [
          { chance: 0.55, effects: { intel: +6, happy: +6 }, grade: "crit", narrative: "수료 후 스타트업에 합격했다. 첫 커밋을 올리던 날 손이 떨렸다.", career: "developer" },
          { chance: 0.45, effects: { intel: +3, money: -500, happy: -4 }, grade: "bad", narrative: "취업 시장이 얼어붙었다. 포트폴리오만 남았다." },
        ] },
      { id: "self", emoji: "📘", text: "독학으로 천천히", grade: "mid", career: "developer", effects: { intel: +4, health: -2 }, narratives: ["1년간 밤마다 강의를 봤다. 작은 회사에 주니어로 들어갔다."] },
      { id: "no", emoji: "🙅", text: "나는 문과다", grade: "mid", effects: { happy: +1 }, narratives: ["'Hello World'까지만 쳐 보고 노트북을 덮었다."] },
    ],
  }),
  E({
    id: "cr_dev_outage", career: "developer", step: [0, 3], age: [21, 60], emoji: "🚨", title: "새벽 3시의 장애",
    desc: "서비스가 멈췄다. 슬랙 알림이 폭주한다. 내 코드가 원인일지도 모른다.", repeat: 5,
    choices: [
      { id: "fix", emoji: "🛠️", text: "바로 일어나 고친다", grade: "good", life: {"stepUp": 1}, effects: { intel: +4, health: -3 }, narratives: ["40분 만에 복구. 아침 회의에서 '장애 영웅'이 됐다."] },
      { id: "rollback", emoji: "⏪", text: "일단 롤백하고 잔다", grade: "mid", effects: { health: +1 }, narratives: ["서비스는 돌아왔다. 원인은 다음 날 찾았다. 그게 맞는 순서였다."] },
      { id: "hide", emoji: "🫣", text: "내 코드가 아니길 빌며 모른 척", grade: "bad", effects: { social: -4, happy: -3 }, narratives: ["내 코드였다. 회고 회의가 길었다."] },
    ],
  }),
  E({
    id: "cr_dev_bigtech", career: "developer", step: [1, 2], age: [24, 46], emoji: "🏢", title: "빅테크 면접",
    desc: "이름만 들어도 아는 IT 대기업에서 면접 제안이 왔다. 코딩 테스트는 5시간.", minYears: 2, repeat: 5, flagBanned: ["dev_bigtech"],
    choices: [
      { id: "prep", emoji: "📚", text: "석 달 동안 알고리즘 문제를 푼다", grade: "good",
        outcomes: [
          { chance: 0.45, effects: { happy: +10, intel: +5 }, grade: "crit", narrative: "합격. 사원증을 목에 걸고 셀카를 찍었다.", life: {"step": 2, "job": {"title": "빅테크 개발자", "salary": 9500}}, flag: {"add": ["dev_bigtech"]} },
          { chance: 0.55, effects: { happy: -6 }, grade: "bad", narrative: "최종 면접에서 떨어졌다. 피드백은 '컬처 핏'." },
        ] },
      { id: "stay", emoji: "🧑‍💻", text: "지금 팀이 좋다", grade: "mid", life: {"step": 2, "raise": 1.1}, effects: { happy: +3, social: +3 }, narratives: ["익숙한 동료들과 남았다. 대신 팀에서 가장 중요한 사람이 됐다."] },
    ],
  }),
  E({
    id: "cr_dev_ai", career: "developer", step: [1, 4], age: [26, 62], emoji: "🤖", title: "AI가 코드를 짠다",
    desc: "AI 코딩 도구가 주니어 3명 몫을 한다. 회사가 채용을 멈췄다. 나는?", repeat: 5,
    choices: [
      { id: "master", emoji: "🧠", text: "AI를 누구보다 잘 다룬다", grade: "crit", life: {"raise": 1.15, "stepUp": 1}, effects: { intel: +6, happy: +4 }, narratives: ["AI와 함께 혼자서 팀 하나만큼 일했다. 몸값이 올랐다."] },
      { id: "depth", emoji: "🔬", text: "AI가 못 하는 설계 쪽으로", grade: "good", effects: { intel: +5 }, narratives: ["시스템 설계와 사람 사이 조율을 맡았다. 대체되지 않는 자리였다."] },
      { id: "deny", emoji: "🙈", text: "손으로 짜는 게 진짜다", grade: "bad",
        outcomes: [
          { chance: 0.5, effects: { happy: +2 }, grade: "mid", narrative: "고집스러운 장인으로 남았다. 레거시 시스템엔 그런 사람이 필요했다." },
          { chance: 0.5, effects: { happy: -8, money: -500 }, grade: "bad", narrative: "구조조정 명단에 올랐다.", life: {"quit": true, "step": 1} },
        ] },
    ],
  }),
  E({
    id: "cr_dev_side", career: "developer", step: [1, 3], age: [25, 52], emoji: "📱", title: "사이드 프로젝트",
    desc: "주말에 만든 서비스가 입소문을 탔다. 가입자 10만. 서버비가 월급만큼 나온다.", weight: 0.9, repeat: 5, flagBanned: ["dev_to_biz"],
    choices: [
      { id: "found", emoji: "🚀", text: "퇴사하고 창업한다", grade: "crit",
        outcomes: [
          { chance: 0.5, effects: { happy: +10, money: +3000 }, grade: "crit", narrative: "투자를 받았다. 개발자에서 대표가 됐다.", career: "business", life: {"step": 1, "job": {"title": "스타트업 대표", "salary": 6000}}, flag: {"add": ["dev_to_biz"]} },
          { chance: 0.5, effects: { happy: -6, money: -2000 }, grade: "bad", narrative: "투자 유치에 실패했다. 1년 만에 서비스를 접고 회사로 돌아갔다." },
        ] },
      { id: "sell", emoji: "💰", text: "서비스를 팔아 버린다", grade: "good", effects: { money: +3000, happy: +5 }, narratives: ["큰 회사가 인수했다. 목돈과 함께 원래 자리로 돌아왔다."] },
      { id: "shut", emoji: "🔌", text: "감당이 안 돼 서버를 끈다", grade: "mid", effects: { happy: -2, health: +2 }, narratives: ["공지에 '그동안 감사했습니다'를 올렸다. 아쉬움이 오래 남았다."] },
    ],
  }),
  E({
    id: "cr_dev_lead", career: "developer", step: [2, 3], age: [31, 56], emoji: "🧭", title: "테크리드냐 매니저냐",
    desc: "팀장 제안이 왔다. 코드를 계속 짤까, 사람을 이끌까?", minYears: 7, repeat: 5,
    choices: [
      { id: "ic", emoji: "⌨️", text: "최고의 엔지니어로 남는다", grade: "good", life: {"step": 3, "job": {"title": "수석 엔지니어", "salary": 13000}}, effects: { intel: +5, happy: +4 }, narratives: ["수석 엔지니어가 됐다. 어려운 문제는 다 내 책상으로 왔다."] },
      { id: "manager", emoji: "👥", text: "팀을 맡는다", grade: "mid",
        outcomes: [
          { chance: 0.6, effects: { social: +6, happy: +3 }, grade: "good", narrative: "팀원들이 나를 믿고 따랐다. 회의가 코드보다 많아졌다.", life: {"step": 3, "job": {"title": "개발 팀장", "salary": 12000}} },
          { chance: 0.4, effects: { happy: -6, health: -4 }, grade: "bad", narrative: "사람 관리는 코드보다 어려웠다. 1년 만에 내려놨다.", life: {"step": 2} },
        ] },
    ],
  }),
  E({
    id: "cr_dev_cto", career: "developer", step: [3, 4], age: [36, 60], emoji: "🏆", title: "CTO 제안",
    desc: "성장하는 회사에서 CTO 자리를 제안했다. 스톡옵션까지 준다고 한다.", minYears: 10, repeat: 5, flagBanned: ["dev_cto"],
    choices: [
      { id: "take", emoji: "🚀", text: "받아들인다", grade: "crit",
        outcomes: [
          { chance: 0.5, effects: { happy: +12, money: +4000, social: +5 }, grade: "crit", narrative: "회사가 상장했다. 스톡옵션이 터졌다. 개발자 인생의 정점.", life: {"step": 5, "job": {"title": "CTO", "salary": 18000}}, flag: {"add": ["dev_cto"]} },
          { chance: 0.5, effects: { happy: -6, health: -5 }, grade: "bad", narrative: "회사가 2년 만에 무너졌다. 스톡옵션은 종이가 됐다.", life: {"step": 3} },
        ] },
      { id: "no", emoji: "🙏", text: "지금 자리에서 만족한다", grade: "mid", life: {"step": 4}, effects: { happy: +4 }, narratives: ["정시에 퇴근하는 수석 엔지니어. 그것도 꽤 괜찮은 정점이었다."] },
    ],
  }),
  E({
    id: "cr_doc_entry", age: [18, 23], emoji: "🩺", title: "의대에 갈까",
    desc: "성적표를 본 담임 선생님이 말했다. '너 의대 갈 수 있어.' 6년, 그리고 수련 몇 년.", careerEntry: "doctor", weight: 1.0, statMin: {"intel": 75},
    choices: [
      { id: "go", emoji: "🏥", text: "의대에 지원한다", grade: "good",
        outcomes: [
          { chance: 0.6, effects: { happy: +10, intel: +5 }, grade: "crit", narrative: "합격. 흰 가운을 입은 내 모습을 상상했다.", career: "doctor" },
          { chance: 0.4, effects: { happy: -6 }, grade: "bad", narrative: "아슬아슬하게 떨어졌다. 다른 길을 찾았다." },
        ] },
      { id: "no", emoji: "🙅", text: "피를 못 본다", grade: "mid", effects: { happy: +2 }, narratives: ["주사 맞을 때도 눈을 감는다. 의사는 내 길이 아니었다."] },
    ],
  }),
  E({
    id: "cr_doc_exam", career: "doctor", step: [0, 0], age: [23, 32], emoji: "📝", title: "의사 국가고시",
    desc: "6년의 끝. 국가고시가 일주일 남았다.", minYears: 5, weight: 2.0, repeat: 1,
    choices: [
      { id: "cram", emoji: "📚", text: "마지막까지 붙잡는다", grade: "good",
        outcomes: [
          { chance: 0.85, effects: { happy: +10, intel: +3 }, grade: "crit", narrative: "합격. 이름 앞에 '의사'가 붙었다. 이제 전공을 고를 차례.", life: {"step": 1, "job": {"title": "인턴", "salary": 4200}}, next: {"id": "cr_doc_major", "after": 1} },
          { chance: 0.15, effects: { happy: -10 }, grade: "bad", narrative: "떨어졌다. 1년을 더 공부해야 한다." },
        ] },
    ],
  }),
  E({
    id: "cr_doc_major", career: "doctor", age: [24, 34], emoji: "🔀", title: "전공 선택",
    desc: "인턴 1년이 끝났다. 평생 할 전공을 고를 시간이다.", followup: true,
    choices: [
      { id: "surgery", emoji: "🔪", text: "외과 — 사람을 직접 살린다", grade: "crit", flag: {"add": ["doc_surgeon"]}, effects: { power: +3, health: -3, happy: +4 }, narratives: ["수술실의 긴장이 좋았다. 36시간 당직이 기다린다."] },
      { id: "derm", emoji: "✨", text: "피부과 — 워라밸과 수입", grade: "good", flag: {"add": ["doc_derm"]}, effects: { happy: +4, money: +300 }, narratives: ["경쟁이 치열했지만 붙었다. 저녁이 있는 의사가 될 것 같다."] },
      { id: "peds", emoji: "🧸", text: "소아과 — 아이들 곁에서", grade: "good", flag: {"add": ["doc_peds"]}, effects: { happy: +5, social: +3 }, narratives: ["소아과는 지원자가 적었다. 그래서 더 필요한 자리였다."] },
    ],
  }),
  E({
    id: "cr_doc_resident", career: "doctor", step: [1, 1], age: [25, 36], emoji: "🌙", title: "전공의의 밤",
    desc: "36시간째 깨어 있다. 응급실에 환자가 또 들어온다. 졸음이 쏟아진다.", minYears: 1, weight: 1.6, repeat: 5,
    choices: [
      { id: "stay", emoji: "💉", text: "끝까지 버틴다", grade: "good",
        outcomes: [
          { chance: 0.7, effects: { intel: +5, health: -6, happy: +4 }, grade: "crit", narrative: "수련을 마쳤다. 전문의 자격증을 받았다.", life: {"step": 2, "job": {"title": "전문의", "salary": 10000}} },
          { chance: 0.3, effects: { health: -10, happy: -8 }, grade: "bad", narrative: "쓰러져 링거를 맞았다. 1년을 쉬고 다시 시작했다." },
        ] },
      { id: "help", emoji: "🙋", text: "동료에게 도움을 요청한다", grade: "mid", effects: { social: +5, health: -2 }, narratives: ["선배가 대신 콜을 받아 줬다. 30분 쪽잠이 사람을 살렸다."] },
    ],
  }),
  E({
    id: "cr_doc_er", career: "doctor", step: [2, 4], age: [29, 68], emoji: "🚑", title: "위험한 수술",
    desc: "성공률 30%의 수술. 하지 않으면 환자는 일주일을 못 버틴다. 보호자가 내 손을 잡는다.", weight: 1.2, repeat: 5, flagBanned: ["doc_saved"],
    choices: [
      { id: "operate", emoji: "🔪", text: "수술한다", grade: "crit",
        outcomes: [
          { chance: 0.45, effects: { happy: +12, social: +5, intel: +3 }, grade: "crit", narrative: "환자가 눈을 떴다. 1년 뒤 그 환자가 감사 편지를 보냈다.", flag: {"add": ["doc_saved"]} },
          { chance: 0.55, effects: { happy: -12, health: -3 }, grade: "bad", narrative: "최선을 다했지만 살리지 못했다. 그날 밤 병원 옥상에 오래 서 있었다." },
        ] },
      { id: "refer", emoji: "🏥", text: "더 큰 병원으로 전원한다", grade: "mid", effects: { happy: -2 }, narratives: ["이송은 무사했다. 결과는 나중에 전해 들었다."] },
    ],
  }),
  E({
    id: "cr_doc_suit", career: "doctor", step: [2, 4], age: [30, 70], emoji: "⚖️", title: "의료 소송",
    desc: "수술 후 합병증이 생긴 환자 가족이 소송을 걸었다. 기록은 문제가 없어 보인다.", weight: 0.7, repeat: 5,
    choices: [
      { id: "fight", emoji: "📂", text: "기록으로 끝까지 다툰다", grade: "good",
        outcomes: [
          { chance: 0.65, effects: { happy: +3, money: -500 }, grade: "good", narrative: "무죄 판결. 그래도 2년이 지옥이었다." },
          { chance: 0.35, effects: { happy: -8, money: -5000 }, grade: "bad", narrative: "일부 배상 판결. 보험으로도 다 막지 못했다." },
        ] },
      { id: "settle", emoji: "🤝", text: "합의하고 사과한다", grade: "mid", effects: { money: -2000, social: +3 }, narratives: ["유족이 '진심이 느껴졌다'고 했다. 마음이 조금 가벼워졌다."] },
    ],
  }),
  E({
    id: "cr_doc_path", career: "doctor", step: [2, 3], age: [34, 60], emoji: "🏨", title: "개원이냐 교수냐",
    desc: "대학병원에서 교수 자리를 제안했다. 동기들은 하나둘 개원하고 있다.", minYears: 8, repeat: 5, flagBanned: ["doc_clinic"],
    choices: [
      { id: "clinic", emoji: "🏪", text: "대출받아 개원한다", grade: "good",
        outcomes: [
          { chance: 0.6, effects: { money: +6000, happy: +6 }, grade: "crit", narrative: "동네 명의가 됐다. 대기 번호표가 아침부터 동났다.", life: {"step": 3, "job": {"title": "개원의", "salary": 14000}}, flag: {"add": ["doc_clinic"]} },
          { chance: 0.4, effects: { money: -15000, happy: -10 }, grade: "bad", narrative: "길 건너에 대형 병원이 들어왔다. 대출 이자만 쌓였다.", life: {"step": 3} },
        ] },
      { id: "prof", emoji: "🎓", text: "교수가 되어 연구한다", grade: "good", life: {"step": 3, "job": {"title": "의대 교수", "salary": 12000}}, flag: {"add": ["doc_prof"]}, effects: { intel: +6, happy: +4 }, narratives: ["논문과 수술과 강의. 셋을 다 하느라 머리가 빨리 셌다."] },
    ],
  }),
  E({
    id: "cr_doc_volunteer", career: "doctor", step: [2, 5], age: [32, 75], emoji: "🌍", title: "해외 의료봉사",
    desc: "의사가 한 명도 없는 마을이 있다고 한다. 3개월 휴가를 내고 갈까?", weight: 0.7, repeat: 5,
    choices: [
      { id: "go", emoji: "✈️", text: "간다", grade: "crit", flag: {"add": ["doc_mission"]}, effects: { happy: +10, social: +5, money: -800, health: -3 }, narratives: ["천막 진료소에서 하루 200명을 봤다. 아이들이 이름을 외워 불렀다."] },
      { id: "donate", emoji: "💝", text: "대신 후원금을 보낸다", grade: "good", effects: { money: -500, happy: +3 }, narratives: ["내가 보낸 돈으로 약상자가 도착했다는 사진이 왔다."] },
    ],
  }),
  E({
    id: "cr_doc_research", career: "doctor", step: [3, 4], age: [42, 72], emoji: "🧬", title: "치료법 연구",
    desc: "10년 매달린 연구가 결실 직전이다. 마지막 임상 결과를 기다린다.", flagRequired: ["doc_prof"], minYears: 15, repeat: 5, flagBanned: ["doc_breakthrough"],
    choices: [
      { id: "wait", emoji: "🔬", text: "결과를 확인한다", grade: "crit",
        outcomes: [
          { chance: 0.4, effects: { happy: +14, intel: +6, social: +6, money: +5000 }, grade: "crit", narrative: "효과 입증. 세계 학회에서 기조연설을 했다. 교과서에 내 이름이 실렸다.", life: {"step": 5}, flag: {"add": ["doc_breakthrough"]} },
          { chance: 0.6, effects: { happy: -6 }, grade: "bad", narrative: "유의미한 차이 없음. 다시 처음부터.", life: {"step": 4} },
        ] },
    ],
  }),
  E({
    id: "cr_law_entry", age: [21, 32], emoji: "⚖️", title: "로스쿨 입학",
    desc: "법학적성시험 점수가 잘 나왔다. 3년간 학비만 수천만 원. 도전할까?", careerEntry: "lawyer", weight: 0.9, statMin: {"intel": 70},
    choices: [
      { id: "go", emoji: "📚", text: "로스쿨에 간다", grade: "good", career: "lawyer", effects: { intel: +5, money: -2000 }, narratives: ["첫 학기 판례만 400개. 도서관이 집이 됐다."] },
      { id: "no", emoji: "🙅", text: "법보다 자유", grade: "mid", effects: { happy: +2 }, narratives: ["원서를 접었다. 법정 드라마는 계속 재밌게 봤다."] },
    ],
  }),
  E({
    id: "cr_law_bar", career: "lawyer", step: [0, 0], age: [24, 36], emoji: "📜", title: "변호사시험",
    desc: "변호사시험 합격률은 절반. 닷새 동안 시험을 치른다.", minYears: 3, weight: 2.0, repeat: 1,
    choices: [
      { id: "take", emoji: "✍️", text: "시험장에 들어간다", grade: "good",
        outcomes: [
          { chance: 0.6, effects: { happy: +10, intel: +4 }, grade: "crit", narrative: "합격. 변호사 배지를 받았다. 이제 어디서 일할지 정해야 한다.", life: {"step": 1, "job": {"title": "신입 변호사", "salary": 7000}}, next: {"id": "cr_law_firm", "after": 0} },
          { chance: 0.4, effects: { happy: -10, health: -3 }, grade: "bad", narrative: "떨어졌다. 응시 기회는 다섯 번뿐이다." },
        ] },
    ],
  }),
  E({
    id: "cr_law_firm", career: "lawyer", age: [25, 40], emoji: "🏢", title: "첫 직장 선택",
    desc: "대형 로펌, 공익 재단, 그리고 작은 내 사무실. 어디서 시작할까?", followup: true,
    choices: [
      { id: "bigfirm", emoji: "🏙️", text: "대형 로펌", grade: "good", life: {"step": 2, "job": {"title": "로펌 변호사", "salary": 12000}}, flag: {"add": ["law_bigfirm"]}, effects: { money: +1000, health: -4 }, narratives: ["연봉은 높았고 퇴근은 없었다. 새벽 2시 택시가 일상이 됐다."] },
      { id: "public", emoji: "🕊️", text: "공익 변호사", grade: "crit", life: {"step": 2, "job": {"title": "공익 변호사", "salary": 4500}}, flag: {"add": ["law_public"]}, effects: { happy: +6, social: +5 }, narratives: ["월급은 적었다. 대신 의뢰인이 울면서 고맙다고 했다."] },
      { id: "own", emoji: "🚪", text: "바로 개업한다", grade: "mid",
        outcomes: [
          { chance: 0.45, effects: { money: +1500, happy: +6 }, grade: "good", narrative: "동네 상가에 간판을 걸었다. 입소문으로 사건이 들어왔다.", life: {"step": 2, "job": {"title": "개업 변호사", "salary": 8000}} },
          { chance: 0.55, effects: { money: -1500, happy: -5 }, grade: "bad", narrative: "월세만 나갔다. 국선 사건으로 버텼다.", life: {"step": 2, "job": {"title": "개업 변호사", "salary": 4000}} },
        ] },
    ],
  }),
  E({
    id: "cr_law_case", career: "lawyer", step: [2, 4], age: [27, 68], emoji: "🧑‍⚖️", title: "큰 사건",
    desc: "두 사건이 동시에 들어왔다. 재벌 2세의 변호, 그리고 산업재해 피해자의 무료 변론.", weight: 1.4, repeat: 5, flagBanned: ["law_justice"],
    choices: [
      { id: "rich", emoji: "💼", text: "재벌 사건을 맡는다", grade: "mid",
        outcomes: [
          { chance: 0.6, effects: { money: +8000, happy: +2, social: -3 }, grade: "good", narrative: "이겼다. 수임료로 집 대출을 갚았다. 뉴스 댓글은 차가웠다.", flag: {"add": ["law_rich_case"]} },
          { chance: 0.4, effects: { money: +3000, happy: -5 }, grade: "bad", narrative: "져서 의뢰인이 화를 냈다. 수임료 일부를 돌려줬다." },
        ] },
      { id: "victim", emoji: "🦺", text: "피해자를 무료로 변론한다", grade: "crit",
        outcomes: [
          { chance: 0.5, effects: { happy: +12, social: +7, internet: +4 }, grade: "crit", narrative: "대기업을 상대로 이겼다. 판결이 법을 바꾸는 계기가 됐다.", life: {"stepUp": 1}, flag: {"add": ["law_justice"]} },
          { chance: 0.5, effects: { happy: -6, money: -500 }, grade: "bad", narrative: "졌다. 그래도 피해자 가족은 끝까지 함께해 줘서 고맙다고 했다." },
        ] },
    ],
  }),
  E({
    id: "cr_law_ethics", career: "lawyer", step: [2, 4], age: [28, 68], emoji: "🧪", title: "위험한 증거",
    desc: "의뢰인이 '이 자료면 이긴다'며 USB를 내민다. 출처가 의심스럽다.", weight: 0.7, repeat: 5,
    choices: [
      { id: "refuse", emoji: "✋", text: "쓰지 않는다", grade: "good", flag: {"add": ["law_clean"]}, effects: { happy: +3, social: +2 }, narratives: ["다른 방법을 찾았다. 시간은 더 걸렸지만 떳떳하게 이겼다."] },
      { id: "use", emoji: "😈", text: "법정에 제출한다", grade: "bad",
        outcomes: [
          { chance: 0.4, effects: { money: +3000, happy: +2 }, grade: "mid", narrative: "이겼다. 아무도 출처를 묻지 않았다." },
          { chance: 0.6, effects: { money: -5000, happy: -12, social: -8 }, grade: "bad", narrative: "증거 조작이 드러났다. 변호사 자격 정지.", life: {"careerEnd": true}, flag: {"add": ["law_disbarred"]} },
        ] },
    ],
  }),
  E({
    id: "cr_law_partner", career: "lawyer", step: [2, 3], age: [35, 58], emoji: "🤝", title: "파트너 변호사",
    desc: "로펌 파트너 심사가 열린다. 매출 실적과 '사람'을 본다고 한다.", flagRequired: ["law_bigfirm"], minYears: 8, repeat: 5, flagBanned: ["law_partner"],
    choices: [
      { id: "push", emoji: "📈", text: "큰 고객을 끌어온다", grade: "good",
        outcomes: [
          { chance: 0.55, effects: { happy: +10, money: +3000 }, grade: "crit", narrative: "파트너가 됐다. 사무실 창밖으로 한강이 보였다.", life: {"step": 4, "job": {"title": "파트너 변호사", "salary": 20000}}, flag: {"add": ["law_partner"]} },
          { chance: 0.45, effects: { happy: -7, health: -4 }, grade: "bad", narrative: "심사에서 밀렸다. 10년 젊음을 바친 곳이었다.", life: {"step": 3} },
        ] },
      { id: "leave", emoji: "🚪", text: "독립해서 내 사무소를 연다", grade: "mid", life: {"step": 3, "job": {"title": "법률사무소 대표", "salary": 15000}}, effects: { happy: +6, money: -1000 }, narratives: ["후배 둘이 따라 나왔다. 간판에 내 이름이 들어갔다."] },
    ],
  }),
  E({
    id: "cr_law_next", career: "lawyer", step: [3, 5], age: [40, 66], emoji: "🏛️", title: "새로운 제안",
    desc: "정당에서 공천을, 시민단체에서 대표직을 제안해 왔다. 법정 밖에서 세상을 바꿀 수 있을까?", minYears: 12, repeat: 5,
    choices: [
      { id: "politics", emoji: "🏛️", text: "정치에 뛰어든다", grade: "crit", career: "politics", life: {"step": 1}, flag: {"add": ["law_to_pol"]}, effects: { social: +6, happy: +3 }, narratives: ["'법을 고치는 변호사가 되겠다.' 출마 선언문을 직접 썼다."] },
      { id: "ngo", emoji: "🕊️", text: "시민단체 대표", grade: "good", life: {"step": 5}, flag: {"add": ["law_justice"]}, effects: { happy: +6, social: +5, money: -500 }, narratives: ["작은 사무실에서 큰 싸움을 이어 갔다."] },
      { id: "stay", emoji: "⚖️", text: "변호사로 남는다", grade: "mid", life: {"step": 5}, effects: { happy: +2 }, narratives: ["법정이 내 자리였다. 후배들에게 변론하는 법을 가르쳤다."] },
    ],
  }),
  E({
    id: "cr_tch_entry", age: [22, 33], emoji: "🍎", title: "임용고시",
    desc: "교생 실습 때 아이들이 써 준 편지를 아직 갖고 있다. 임용고시에 도전할까?", careerEntry: "teacher", weight: 0.9, cond: p => p.stats.intel >= 55 && p.stats.social >= 40,
    choices: [
      { id: "exam", emoji: "📖", text: "임용고시에 도전한다", grade: "good",
        outcomes: [
          { chance: 0.45, effects: { happy: +10, intel: +3 }, grade: "crit", narrative: "합격. 3월 2일, 첫 교실 문을 열었다.", career: "teacher", life: {"job": {"title": "정교사", "salary": 3800}} },
          { chance: 0.55, effects: { happy: -5 }, grade: "mid", narrative: "떨어졌다. 기간제 교사로 먼저 교단에 섰다.", career: "teacher" },
        ] },
      { id: "no", emoji: "🙅", text: "다른 길로 간다", grade: "mid", effects: { happy: +1 }, narratives: ["편지는 상자에 넣었다. 가끔 꺼내 읽었다."] },
    ],
  }),
  E({
    id: "cr_tch_homeroom", career: "teacher", step: [0, 2], age: [23, 60], emoji: "🏫", title: "첫 담임",
    desc: "우리 반에 매일 지각하고 엎드려 자는 아이가 있다. 다른 선생님들은 포기하라고 한다.", repeat: 5, flagBanned: ["tch_saved_kid"],
    choices: [
      { id: "talk", emoji: "🫂", text: "방과 후 따로 이야기한다", grade: "crit",
        outcomes: [
          { chance: 0.6, effects: { happy: +10, social: +5 }, grade: "crit", narrative: "밤마다 동생들을 돌보느라 그랬다. 도움을 연결해 줬다. 아이가 웃기 시작했다.", life: {"stepUp": 1}, flag: {"add": ["tch_saved_kid"]} },
          { chance: 0.4, effects: { happy: -4 }, grade: "mid", narrative: "마음을 열지 않았다. 졸업식 날 꾸벅 인사만 하고 갔다." },
        ] },
      { id: "rule", emoji: "📏", text: "규칙대로 벌점을 준다", grade: "mid", effects: { social: -2 }, narratives: ["지각은 줄었다. 눈빛은 더 차가워졌다."] },
    ],
  }),
  E({
    id: "cr_tch_parent", career: "teacher", step: [0, 4], age: [24, 62], emoji: "📱", title: "학부모 민원",
    desc: "밤 11시, 학부모에게 전화가 왔다. '우리 애가 왜 반장이 아니죠?'", repeat: 6,
    choices: [
      { id: "calm", emoji: "☎️", text: "차분히 설명한다", grade: "mid", effects: { social: +3, happy: -4 }, narratives: ["40분 통화 끝에 끊었다. 잠이 오지 않았다."] },
      { id: "school", emoji: "🏫", text: "학교 공식 창구로 안내", grade: "good", effects: { happy: +2 }, narratives: ["교감 선생님이 대신 응대해 줬다. 제도가 나를 지켜 줬다."] },
      { id: "burn", emoji: "🔥", text: "참다 참다 폭발한다", grade: "bad",
        outcomes: [
          { chance: 0.5, effects: { happy: +3, social: -3 }, grade: "mid", narrative: "속은 시원했다. 다음 날 교장실에 불려 갔다." },
          { chance: 0.5, effects: { happy: -8, health: -4 }, grade: "bad", narrative: "아동학대로 신고당했다. 무혐의가 나오기까지 6개월이 걸렸다." },
        ] },
    ],
  }),
  E({
    id: "cr_tch_class", career: "teacher", step: [1, 2], age: [26, 56], emoji: "🎬", title: "수업을 바꿔 보자",
    desc: "교과서대로 하니 아이들이 존다. 새 수업 방식을 시도해 볼까?", minYears: 3, repeat: 5, flagBanned: ["tch_award", "tch_youtube"],
    choices: [
      { id: "project", emoji: "🧪", text: "프로젝트 수업", grade: "good",
        outcomes: [
          { chance: 0.6, effects: { happy: +8, intel: +4 }, grade: "crit", narrative: "아이들 눈빛이 달라졌다. 수업 사례가 교육청 우수상을 받았다.", life: {"step": 2}, flag: {"add": ["tch_award"]} },
          { chance: 0.4, effects: { happy: -3 }, grade: "mid", narrative: "준비만 세 배로 들고 진도가 밀렸다." },
        ] },
      { id: "youtube", emoji: "📹", text: "수업 영상을 유튜브에 올린다", grade: "mid",
        outcomes: [
          { chance: 0.35, effects: { internet: +8, happy: +8, money: +800 }, grade: "crit", narrative: "전국 학생들이 보는 채널이 됐다. 교육 유튜버로 전업 제안이 왔다.", life: {"step": 2}, flag: {"add": ["tch_youtube"]}, next: {"id": "cr_tch_youtube_offer", "after": 1} },
          { chance: 0.65, effects: { internet: +3 }, grade: "mid", narrative: "조회수 200. 우리 반 아이들만 봤다.", life: {"step": 2} },
        ] },
    ],
  }),
  E({
    id: "cr_tch_youtube_offer", career: "teacher", age: [27, 60], emoji: "🎥", title: "교단이냐 채널이냐",
    desc: "교육 채널 구독자가 50만이 됐다. 겸직 허가는 한계가 있다. 하나를 골라야 한다.", followup: true,
    choices: [
      { id: "go", emoji: "🎬", text: "학교를 나와 유튜버가 된다", grade: "good", career: "streamer", life: {"step": 2, "job": {"title": "교육 유튜버", "salary": 5000}}, effects: { money: +2000, happy: +4 }, narratives: ["마지막 종례 시간, 아이들이 '구독할게요!' 하고 외쳤다."] },
      { id: "stay", emoji: "🍎", text: "교사로 남고 채널은 취미로", grade: "good", effects: { happy: +4, social: +3 }, narratives: ["교실의 웃음이 조회수보다 좋았다."] },
    ],
  }),
  E({
    id: "cr_tch_visit", career: "teacher", step: [2, 5], age: [35, 75], emoji: "💐", title: "찾아온 제자",
    desc: "스승의 날, 15년 전 제자가 꽃을 들고 찾아왔다. '선생님 때문에 교사가 됐어요.'", minYears: 10, weight: 1.2, repeat: 5,
    choices: [
      { id: "hug", emoji: "🫂", text: "꼭 안아 준다", grade: "crit", flag: {"add": ["tch_legacy"]}, effects: { happy: +12, social: +4 }, narratives: ["그날 저녁 오래된 출석부를 꺼내 봤다. 모든 이름이 기억났다."] },
    ],
  }),
  E({
    id: "cr_tch_principal", career: "teacher", step: [2, 4], age: [48, 62], emoji: "🏫", title: "교감·교장의 길",
    desc: "교감 승진 점수가 찼다. 교실을 떠나 학교 전체를 맡을까?", minYears: 20, repeat: 5, flagBanned: ["tch_principal"],
    choices: [
      { id: "up", emoji: "🗝️", text: "승진한다", grade: "good",
        outcomes: [
          { chance: 0.6, effects: { happy: +8, social: +5 }, grade: "crit", narrative: "몇 년 뒤 교장이 됐다. 첫 조회에서 아이들 이름을 불렀다.", life: {"step": 5, "job": {"title": "교장", "salary": 9500}}, flag: {"add": ["tch_principal"]} },
          { chance: 0.4, effects: { happy: -4, health: -3 }, grade: "bad", narrative: "서류와 회의에 파묻혔다. 교실이 그리웠다.", life: {"step": 4, "job": {"title": "교감", "salary": 8000}} },
        ] },
      { id: "stay", emoji: "✏️", text: "평교사로 정년까지", grade: "good", life: {"step": 5}, effects: { happy: +6 }, narratives: ["마지막 날까지 분필을 들었다. 그게 내 자리였다."] },
    ],
  }),
  E({
    id: "cr_id_entry", age: [15, 26], emoji: "🎤", title: "오디션",
    desc: "대형 기획사 공개 오디션 공고가 떴다. 거울 앞에서 몇 번이나 연습했다.", careerEntry: "idol", weight: 1.0, cond: p => p.stats.social >= 55 || p.routes.has("idol"),
    choices: [
      { id: "audition", emoji: "🎶", text: "오디션을 본다", grade: "good",
        outcomes: [
          { chance: 0.45, effects: { happy: +10, social: +4 }, grade: "crit", narrative: "합격 문자. 내일부터 연습생이다.", career: "idol" },
          { chance: 0.55, effects: { happy: -6 }, grade: "bad", narrative: "심사위원이 고개를 저었다. '다음 기회에.'" },
        ] },
      { id: "show", emoji: "📺", text: "서바이벌 오디션 프로그램에 나간다", grade: "crit", career: "idol", flag: {"add": ["id_show"]}, effects: { internet: +6, social: +4 }, narratives: ["첫 방송부터 '그 참가자'로 화제가 됐다. 기획사에서 연습생 계약을 내밀었다."] },
      { id: "no", emoji: "🙅", text: "꿈은 노래방에서만", grade: "mid", effects: { happy: +2 }, narratives: ["노래방 98점. 그걸로 충분했다."] },
    ],
  }),
  E({
    id: "cr_id_trainee", career: "idol", step: [0, 0], age: [15, 28], emoji: "🩰", title: "연습생 월말평가",
    desc: "데뷔조 발표가 걸린 월말평가. 연습실 불은 새벽 4시까지 켜져 있다.", weight: 1.6, repeat: 1,
    choices: [
      { id: "practice", emoji: "💦", text: "밤새 안무를 맞춘다", grade: "good",
        outcomes: [
          { chance: 0.55, effects: { power: +4, happy: +8, health: -4 }, grade: "crit", narrative: "데뷔조에 뽑혔다. 화장실에서 몰래 울었다.", life: {"step": 1}, next: {"id": "cr_id_debut", "after": 1} },
          { chance: 0.45, effects: { happy: -8, health: -4 }, grade: "bad", narrative: "탈락. 숙소 짐을 쌌다가, 다시 풀었다. 한 번만 더." },
        ] },
      { id: "quit", emoji: "🚪", text: "연습생을 그만둔다", grade: "mid", life: {"careerEnd": true}, effects: { happy: +3, health: +3 }, narratives: ["평범한 학생으로 돌아갔다. 가끔 무대 영상을 보면 마음이 저렸다."] },
    ],
  }),
  E({
    id: "cr_id_debut", career: "idol", age: [16, 30], emoji: "✨", title: "데뷔 무대",
    desc: "음악방송 데뷔 무대. 무대 뒤에서 멤버들과 손을 잡았다.", followup: true,
    choices: [
      { id: "perfect", emoji: "🌟", text: "연습한 대로 완벽하게", grade: "crit",
        outcomes: [
          { chance: 0.5, effects: { happy: +12, internet: +6, social: +5 }, grade: "crit", narrative: "직캠이 100만 뷰를 넘었다. 팬카페가 생겼다.", life: {"step": 2, "job": {"title": "신인 가수", "salary": 1500}}, next: {"id": "cr_id_fandom", "after": 1} },
          { chance: 0.5, effects: { happy: -4 }, grade: "mid", narrative: "무난했다. 그날 데뷔한 팀만 다섯이었다.", life: {"step": 2, "job": {"title": "신인 가수", "salary": 800}}, next: {"id": "cr_id_fandom", "after": 2} },
        ] },
      { id: "adlib", emoji: "🎙️", text: "즉흥 애드리브로 시선을 끈다", grade: "good",
        outcomes: [
          { chance: 0.4, effects: { happy: +10, internet: +8 }, grade: "crit", narrative: "애드리브 한 줄이 밈이 됐다.", life: {"step": 2, "job": {"title": "신인 가수", "salary": 1500}}, next: {"id": "cr_id_fandom", "after": 1} },
          { chance: 0.6, effects: { happy: -6, social: -2 }, grade: "bad", narrative: "음이탈. '방송사고'로 검색어에 올랐다.", life: {"step": 2, "job": {"title": "신인 가수", "salary": 800}}, next: {"id": "cr_id_fandom", "after": 2} },
        ] },
    ],
  }),
  E({
    id: "cr_id_fandom", career: "idol", age: [17, 34], emoji: "💖", title: "팬덤",
    desc: "팬들이 생기기 시작했다. 팬사인회 줄이 조금씩 길어진다.", followup: true,
    choices: [
      { id: "service", emoji: "🫶", text: "팬 한 명 한 명 이름을 외운다", grade: "good", flag: {"add": ["id_loyal_fans"]}, effects: { social: +7, happy: +5 }, narratives: ["'얘는 진짜다'라는 입소문. 팬덤이 단단해졌다."] },
      { id: "skill", emoji: "🎧", text: "실력으로 승부한다", grade: "good", flag: {"add": ["id_artist"]}, effects: { intel: +3, power: +3, happy: +3 }, narratives: ["자작곡을 수록곡에 넣었다. 평론가들이 주목했다."] },
      { id: "sns", emoji: "📱", text: "SNS 소통에 올인", grade: "mid", effects: { internet: +7, health: -2 }, narratives: ["라이브 방송 동시 접속 5만. 대신 사생활이 없어졌다."] },
    ],
  }),
  E({
    id: "cr_id_variety", career: "idol", step: [2, 3], age: [18, 45], emoji: "📺", title: "예능 섭외",
    desc: "인기 예능에서 섭외가 왔다. 콘셉트는 '허당 막내'.", repeat: 5,
    choices: [
      { id: "go", emoji: "😂", text: "망가질 각오로 나간다", grade: "good",
        outcomes: [
          { chance: 0.55, effects: { internet: +8, social: +6, happy: +6, money: +500 }, grade: "crit", narrative: "방송 다음 날 음원 순위가 역주행했다.", life: {"stepUp": 1} },
          { chance: 0.45, effects: { happy: -5, internet: +2 }, grade: "bad", narrative: "편집이 이상하게 됐다. '태도 논란'이 붙었다." },
        ] },
      { id: "no", emoji: "🎤", text: "음악에만 집중한다", grade: "mid", effects: { intel: +2, happy: +2 }, narratives: ["무대 위에서만 보이는 사람. 신비주의도 나쁘지 않았다."] },
    ],
  }),
  E({
    id: "cr_id_chart", career: "idol", step: [2, 3], age: [18, 42], emoji: "📈", title: "컴백",
    desc: "1년 만의 컴백. 이번 앨범에 그룹의 운명이 걸렸다.", minYears: 2, repeat: 3, flagBanned: ["id_no1"],
    choices: [
      { id: "concept", emoji: "🔥", text: "파격 콘셉트에 도전", grade: "crit",
        outcomes: [
          { chance: 0.45, effects: { happy: +14, internet: +8, money: +3000 }, grade: "crit", narrative: "음원 차트 1위. 음악방송 1위 트로피를 들고 울었다.", life: {"step": 3, "job": {"title": "인기 가수", "salary": 6000}}, flag: {"add": ["id_no1"]} },
          { chance: 0.55, effects: { happy: -8, money: -500 }, grade: "bad", narrative: "반응이 싸늘했다. 차트 50위권 밖.", flag: {"add": ["id_flop"]} },
        ] },
      { id: "safe", emoji: "🎵", text: "팬들이 좋아하는 스타일로", grade: "good",
        outcomes: [
          { chance: 0.6, effects: { happy: +6, money: +1000 }, grade: "good", narrative: "팬덤 덕에 초동 기록을 경신했다.", life: {"step": 3, "job": {"title": "인기 가수", "salary": 6000}} },
          { chance: 0.4, effects: { happy: -3 }, grade: "mid", narrative: "'늘 같은 노래'라는 평을 들었다." },
        ] },
    ],
  }),
  E({
    id: "cr_id_contract", career: "idol", step: [2, 4], age: [20, 40], emoji: "📃", title: "소속사와의 갈등",
    desc: "데뷔 4년 차. 정산서를 보니 아직도 '빚'이 남아 있다고 한다.", repeat: 5,
    choices: [
      { id: "sue", emoji: "⚖️", text: "계약 해지 소송", grade: "mid",
        outcomes: [
          { chance: 0.5, effects: { happy: +6, money: +2000 }, grade: "good", narrative: "승소. 1인 기획사를 세웠다.", flag: {"add": ["id_indie"]} },
          { chance: 0.5, effects: { happy: -10, money: -3000, social: -3 }, grade: "bad", narrative: "소송이 길어지며 활동을 못 했다. 2년이 사라졌다.", life: {"step": 2} },
        ] },
      { id: "renew", emoji: "🤝", text: "조건을 고쳐 재계약", grade: "good", effects: { money: +1500, happy: +3 }, narratives: ["정산 비율을 올렸다. 회사와 다시 손을 잡았다."] },
      { id: "leave", emoji: "🚪", text: "연예계를 떠난다", grade: "mid", life: {"careerEnd": true}, effects: { happy: +4, health: +4 }, narratives: ["마지막 팬미팅에서 고개를 숙였다. 평범한 삶이 시작됐다."] },
    ],
  }),
  E({
    id: "cr_id_scandal", career: "idol", step: [2, 5], age: [19, 55], emoji: "📸", title: "열애설",
    desc: "새벽에 찍힌 사진 한 장. 기사 제목은 '열애'. 팬들이 술렁인다.", weight: 0.9, repeat: 5,
    choices: [
      { id: "admit", emoji: "💌", text: "솔직하게 인정한다", grade: "good",
        outcomes: [
          { chance: 0.55, effects: { happy: +6, social: +3 }, grade: "good", narrative: "'축하해요'가 더 많았다. 응원받는 연애가 됐다." },
          { chance: 0.45, effects: { happy: -8, internet: -3 }, grade: "bad", narrative: "팬카페 탈퇴 러시. 앨범 판매량이 반토막 났다.", life: {"step": 2} },
        ] },
      { id: "deny", emoji: "🙊", text: "'친한 동료일 뿐'", grade: "mid", effects: { happy: -3 }, narratives: ["소문은 잦아들었다. 그 사람과는 결국 멀어졌다."] },
    ],
  }),
  E({
    id: "cr_id_top", career: "idol", step: [3, 4], age: [22, 50], emoji: "👑", title: "톱스타 도전",
    desc: "월드투어 제안과 영화 주연 제안이 동시에 들어왔다.", minYears: 4, repeat: 5, flagBanned: ["id_actor", "id_top"],
    choices: [
      { id: "tour", emoji: "🌍", text: "월드투어", grade: "crit",
        outcomes: [
          { chance: 0.5, effects: { happy: +14, social: +8, money: +6000, health: -5 }, grade: "crit", narrative: "30개 도시 매진. 이름 하나로 스타디움을 채우는 톱스타가 됐다.", life: {"step": 5, "job": {"title": "톱스타", "salary": 15000}}, flag: {"add": ["id_top"]} },
          { chance: 0.5, effects: { health: -8, happy: -4, money: +2000 }, grade: "bad", narrative: "투어 도중 성대 결절. 남은 공연을 취소했다.", life: {"step": 3} },
        ] },
      { id: "film", emoji: "🎬", text: "배우로 전향", grade: "good",
        outcomes: [
          { chance: 0.45, effects: { happy: +12, intel: +4, money: +4000 }, grade: "crit", narrative: "신인상. '가수 출신'이라는 꼬리표가 떨어졌다.", life: {"step": 5, "job": {"title": "배우", "salary": 10000}}, flag: {"add": ["id_top", "id_actor"]} },
          { chance: 0.55, effects: { happy: -6 }, grade: "bad", narrative: "'발연기' 논란. 다시 무대로 돌아왔다." },
        ] },
    ],
  }),
  E({
    id: "cr_id_later", career: "idol", step: [2, 5], age: [33, 75], emoji: "🎞️", title: "시간이 흘러",
    desc: "전성기가 지났다. 옛 멤버들 단톡방에 '우리 한 번 더?'라는 메시지가 올라왔다.", minYears: 8, repeat: 5, flagBanned: ["id_reunion"],
    choices: [
      { id: "reunion", emoji: "🎤", text: "재결합 콘서트", grade: "crit",
        outcomes: [
          { chance: 0.6, effects: { happy: +14, social: +6, money: +3000 }, grade: "crit", narrative: "팬들이 아이를 데리고 왔다. 2세대 팬이 생겼다.", flag: {"add": ["id_reunion"]} },
          { chance: 0.4, effects: { happy: -3, money: -500 }, grade: "mid", narrative: "객석이 반만 찼다. 그래도 무대는 뜨거웠다." },
        ] },
      { id: "agency", emoji: "🏢", text: "후배를 키우는 기획사를 차린다", grade: "good", career: "business", life: {"step": 1, "job": {"title": "기획사 대표", "salary": 6000}}, effects: { money: -3000, social: +5, happy: +4 }, narratives: ["연습실 불을 켜며 옛날의 나를 봤다. 이제는 사장님이다."] },
      { id: "retire", emoji: "🌅", text: "조용히 은퇴한다", grade: "mid", life: {"careerEnd": true}, effects: { health: +4, happy: +4 }, narratives: ["마지막 인사를 SNS에 남겼다. 팬들은 아직도 생일 광고를 건다."] },
    ],
  }),
  E({
    id: "cr_bz_entry", age: [24, 58], emoji: "💡", title: "사업 아이템",
    desc: "자려고 누웠는데 아이템 하나가 머리를 떠나지 않는다. 이거 되겠는데?", careerEntry: "business", weight: 0.5,
    choices: [
      { id: "cafe", emoji: "☕", text: "동네 카페", grade: "mid", career: "business", next: {"id": "cr_bz_fund", "after": 1}, flag: {"add": ["bz_cafe"]}, effects: { happy: +4 }, narratives: ["인테리어 견적을 받아 왔다. 생각보다 0이 하나 더 붙어 있었다."] },
      { id: "online", emoji: "📦", text: "온라인 쇼핑몰", grade: "good", career: "business", next: {"id": "cr_bz_fund", "after": 1}, flag: {"add": ["bz_online"]}, effects: { internet: +4, intel: +2 }, narratives: ["공급처를 찾고 상세 페이지를 만들었다. 사업자등록증이 나왔다."] },
      { id: "tech", emoji: "🧠", text: "기술 스타트업", grade: "crit", career: "business", next: {"id": "cr_bz_fund", "after": 1}, flag: {"add": ["bz_tech"]}, effects: { intel: +5, happy: +4 }, narratives: ["공동창업자를 구했다. 사업계획서 20쪽을 밤새 썼다."] },
      { id: "no", emoji: "😴", text: "꿈이었다", grade: "mid", effects: { happy: +1 }, narratives: ["아침이 되자 아이템은 흐릿해졌다. 출근했다."] },
    ],
  }),
  E({
    id: "cr_bz_fund", career: "business", age: [24, 70], emoji: "🏦", title: "창업 자금",
    desc: "필요한 돈은 1억. 통장에는 그 절반도 없다.", followup: true,
    choices: [
      { id: "loan", emoji: "🏦", text: "정책 대출을 받는다", grade: "mid", next: {"id": "cr_bz_open", "after": 1}, effects: { money: -2000, happy: -2 }, narratives: ["서류 40장 끝에 대출이 나왔다. 이자 날짜가 달력에 생겼다."] },
      { id: "family", emoji: "👪", text: "가족에게 빌린다", grade: "mid", next: {"id": "cr_bz_open", "after": 1}, effects: { money: -800, social: -2 }, narratives: ["엄마가 적금을 깼다. 반드시 성공해야 할 이유가 생겼다."] },
      { id: "angel", emoji: "😇", text: "엔젤 투자자를 찾는다", grade: "good",
        outcomes: [
          { chance: 0.45, effects: { happy: +6, social: +4 }, grade: "good", narrative: "발표 열 번 만에 투자자가 나타났다. 지분 20%를 넘겼다.", next: {"id": "cr_bz_open", "after": 1} },
          { chance: 0.55, effects: { happy: -5, money: -1500 }, grade: "bad", narrative: "투자는 실패. 결국 신용대출로 메웠다.", next: {"id": "cr_bz_open", "after": 1} },
        ] },
    ],
  }),
  E({
    id: "cr_bz_open", career: "business", age: [25, 72], emoji: "🎉", title: "오픈 첫 달",
    desc: "드디어 오픈. 첫 달 매출이 앞으로를 말해 줄 것이다.", followup: true,
    choices: [
      { id: "hustle", emoji: "🏃", text: "직접 발로 뛰며 홍보", grade: "good",
        outcomes: [
          { chance: 0.5, effects: { happy: +10, money: +1500 }, grade: "crit", narrative: "손익분기점을 석 달 만에 넘었다. 사업가로 자리 잡았다.", life: {"step": 1, "job": {"title": "사장", "salary": 5000}} },
          { chance: 0.5, effects: { happy: -8, money: -2000, health: -3 }, grade: "bad", narrative: "손님이 없었다. 월세가 밀리기 시작했다.", next: {"id": "cr_bz_crisis", "after": 1} },
        ] },
      { id: "ads", emoji: "📣", text: "광고비를 크게 쓴다", grade: "mid",
        outcomes: [
          { chance: 0.45, effects: { happy: +8, money: +1000, internet: +3 }, grade: "good", narrative: "광고가 먹혔다. 주문이 밀려들었다.", life: {"step": 1, "job": {"title": "사장", "salary": 5000}} },
          { chance: 0.55, effects: { money: -3000, happy: -8 }, grade: "bad", narrative: "광고비만 날렸다.", next: {"id": "cr_bz_crisis", "after": 1} },
        ] },
    ],
  }),
  E({
    id: "cr_bz_hire", career: "business", step: [1, 2], age: [25, 72], emoji: "🧑‍🤝‍🧑", title: "첫 직원",
    desc: "혼자서는 더 이상 감당이 안 된다. 직원을 뽑아야 한다.", repeat: 5,
    choices: [
      { id: "friend", emoji: "🤝", text: "믿을 만한 친구를 데려온다", grade: "mid",
        outcomes: [
          { chance: 0.55, effects: { social: +5, happy: +5 }, grade: "good", narrative: "호흡이 척척 맞았다. 회사의 2번 직원이 됐다.", life: {"stepUp": 1} },
          { chance: 0.45, effects: { social: -6, happy: -6 }, grade: "bad", narrative: "돈 문제로 크게 싸웠다. 친구도 직원도 잃었다." },
        ] },
      { id: "pro", emoji: "🧑‍💼", text: "경력자를 제대로 뽑는다", grade: "good", life: {"stepUp": 1}, effects: { money: -500, intel: +2 }, narratives: ["월급은 부담됐지만 회사가 체계를 갖췄다."] },
    ],
  }),
  E({
    id: "cr_bz_invest", career: "business", step: [1, 2], age: [26, 72], emoji: "💹", title: "투자 유치",
    desc: "매출이 꾸준히 오른다. 벤처캐피털이 미팅을 잡자고 한다.", minYears: 2, repeat: 5, flagBanned: ["bz_funded"],
    choices: [
      { id: "pitch", emoji: "📊", text: "시리즈A 피칭", grade: "crit",
        outcomes: [
          { chance: 0.45, effects: { happy: +10, money: +5000, social: +4 }, grade: "crit", narrative: "50억 투자 유치. 기사에 회사 이름이 나왔다.", life: {"step": 2, "raise": 1.5}, flag: {"add": ["bz_funded"]} },
          { chance: 0.55, effects: { happy: -5 }, grade: "bad", narrative: "'아직 이르다'는 답. 다시 매출로 증명해야 한다." },
        ] },
      { id: "boot", emoji: "🥾", text: "투자 없이 내 힘으로", grade: "good", life: {"step": 2}, effects: { happy: +4, money: +1000 }, narratives: ["느렸지만 지분 100%를 지켰다."] },
    ],
  }),
  E({
    id: "cr_bz_rival", career: "business", step: [2, 3], age: [27, 75], emoji: "⚔️", title: "경쟁 업체 등장",
    desc: "대기업이 똑같은 서비스를 반값에 내놨다.", repeat: 5,
    choices: [
      { id: "price", emoji: "💸", text: "가격 전쟁", grade: "bad",
        outcomes: [
          { chance: 0.3, effects: { money: +1000, happy: +4 }, grade: "good", narrative: "버텼다. 대기업이 먼저 손을 뗐다." },
          { chance: 0.7, effects: { money: -5000, happy: -8 }, grade: "bad", narrative: "자금이 바닥났다. 출혈이 너무 컸다.", next: {"id": "cr_bz_crisis", "after": 1} },
        ] },
      { id: "niche", emoji: "🎯", text: "우리만의 차별화", grade: "good",
        outcomes: [
          { chance: 0.6, effects: { happy: +8, money: +2000, intel: +3 }, grade: "crit", narrative: "충성 고객이 남았다. 오히려 브랜드가 단단해졌다.", life: {"step": 3} },
          { chance: 0.4, effects: { happy: -4, money: -1000 }, grade: "mid", narrative: "차별화가 먹히지 않았다. 매출이 줄었다." },
        ] },
    ],
  }),
  E({
    id: "cr_bz_expand", career: "business", step: [2, 2], age: [28, 75], emoji: "🏗️", title: "사업 확장",
    desc: "2호점, 해외 진출, 신사업. 지금이 키울 때일까?", minYears: 4, repeat: 5,
    choices: [
      { id: "big", emoji: "🌏", text: "해외로 확장", grade: "crit",
        outcomes: [
          { chance: 0.45, effects: { happy: +12, money: +4000, social: +5 }, grade: "crit", narrative: "해외 매출이 국내를 넘었다. 직원이 200명이 됐다.", life: {"step": 3, "job": {"title": "기업 대표", "salary": 15000}} },
          { chance: 0.55, effects: { money: -8000, happy: -10 }, grade: "bad", narrative: "현지 규제에 막혔다. 확장이 독이 됐다.", next: {"id": "cr_bz_crisis", "after": 1} },
        ] },
      { id: "steady", emoji: "🧱", text: "지금 규모를 단단히", grade: "good", life: {"step": 3}, effects: { happy: +3, money: +1500 }, narratives: ["작지만 망하지 않는 회사. 그것도 실력이었다."] },
    ],
  }),
  E({
    id: "cr_bz_crisis", career: "business", step: [0, 4], age: [25, 78], emoji: "🌪️", title: "자금난",
    desc: "다음 달 직원 월급을 줄 돈이 없다. 통장 잔고 0원.", weight: 0.7, repeat: 5,
    choices: [
      { id: "borrow", emoji: "🩸", text: "사채까지 끌어온다", grade: "bad",
        outcomes: [
          { chance: 0.35, effects: { money: +2000, happy: +2 }, grade: "mid", narrative: "고비를 넘겼다. 이자가 무서웠다." },
          { chance: 0.65, effects: { money: -10000, happy: -12, health: -5 }, grade: "bad", narrative: "빚이 빚을 불렀다. 결국 폐업 신고를 했다.", life: {"careerEnd": true}, flag: {"add": ["bz_bankrupt"]} },
        ] },
      { id: "cut", emoji: "✂️", text: "구조조정한다", grade: "mid",
        outcomes: [
          { chance: 0.55, effects: { happy: -4, social: -4, money: +1000 }, grade: "good", narrative: "살아남았다. 떠난 직원들 얼굴이 오래 남았다." },
          { chance: 0.45, effects: { happy: -8, money: -3000 }, grade: "bad", narrative: "줄여도 모자랐다. 사업을 접었다.", life: {"careerEnd": true}, flag: {"add": ["bz_bankrupt"]} },
        ] },
      { id: "close", emoji: "🏳️", text: "깔끔하게 폐업한다", grade: "mid", life: {"careerEnd": true}, flag: {"add": ["bz_closed"]}, effects: { happy: -4, money: -1000 }, narratives: ["간판을 내렸다. 다음엔 더 잘할 수 있을 것 같았다."] },
    ],
  }),
  E({
    id: "cr_bz_mna", career: "business", step: [3, 4], age: [33, 80], emoji: "🏦", title: "인수합병 제안",
    desc: "대기업이 회사를 인수하겠다고 한다. 동시에 다른 회사를 인수할 기회도 왔다.", minYears: 6, repeat: 5, flagBanned: ["bz_group"],
    choices: [
      { id: "sell", emoji: "💰", text: "회사를 판다 — 엑시트", grade: "good", life: {"careerEnd": true}, flag: {"add": ["bz_exit"]}, effects: { money: +15000, happy: +10 }, narratives: ["계약서에 사인한 날, 첫 사무실 사진을 꺼내 봤다."] },
      { id: "buy", emoji: "🦈", text: "오히려 인수해서 키운다", grade: "crit",
        outcomes: [
          { chance: 0.45, effects: { money: +18000, happy: +12, social: +6 }, grade: "crit", narrative: "계열사가 열 개가 됐다. 사람들이 '그룹'이라 불렀다.", life: {"step": 5, "job": {"title": "그룹 회장", "salary": 25000}}, flag: {"add": ["bz_group"]} },
          { chance: 0.55, effects: { money: -12000, happy: -10 }, grade: "bad", narrative: "인수한 회사가 부실이었다. 빚더미에 올랐다.", life: {"step": 2} },
        ] },
    ],
  }),
  E({
    id: "cr_at_entry", age: [16, 23], emoji: "🏟️", title: "프로 입단 테스트",
    desc: "프로팀 스카우트가 경기를 보러 왔다. 입단 테스트에 와 보라고 한다.", careerEntry: "athlete", weight: 1.0, cond: p => p.stats.power >= 60 || p.routes.has("athlete"),
    choices: [
      { id: "try", emoji: "⚽", text: "테스트를 본다", grade: "good",
        outcomes: [
          { chance: 0.5, effects: { happy: +10, power: +4 }, grade: "crit", narrative: "합격. 등번호 37번 유니폼을 받았다.", career: "athlete" },
          { chance: 0.5, effects: { happy: -6 }, grade: "bad", narrative: "마지막 관문에서 떨어졌다." },
        ] },
      { id: "no", emoji: "📚", text: "공부를 택한다", grade: "mid", effects: { intel: +3 }, narratives: ["운동화는 동아리용이 됐다."] },
    ],
  }),
  E({
    id: "cr_at_rookie", career: "athlete", step: [0, 0], age: [16, 27], emoji: "🥅", title: "주전 경쟁",
    desc: "2군 생활 2년째. 감독이 다음 경기 선발 한 자리를 두고 고민 중이다.", weight: 1.6, repeat: 2,
    choices: [
      { id: "train", emoji: "🏋️", text: "개인 훈련을 두 배로", grade: "good",
        outcomes: [
          { chance: 0.55, effects: { power: +5, happy: +8 }, grade: "crit", narrative: "선발 출전해 데뷔골. 주전이 됐다.", life: {"step": 1, "job": {"title": "프로 선수", "salary": 6000}} },
          { chance: 0.45, effects: { health: -5, happy: -4 }, grade: "bad", narrative: "무리하다 햄스트링을 다쳤다." },
        ] },
      { id: "wait", emoji: "🪑", text: "기회를 기다린다", grade: "mid", effects: { happy: -2 }, narratives: ["벤치에서 한 시즌을 보냈다. 경기를 보는 눈은 길러졌다."] },
    ],
  }),
  E({
    id: "cr_at_injury", career: "athlete", step: [1, 3], age: [18, 38], emoji: "🩼", title: "큰 부상",
    desc: "십자인대 파열. 의사는 '1년'이라고 했다.", weight: 0.9, repeat: 5,
    choices: [
      { id: "surgery", emoji: "🏥", text: "수술하고 재활한다", grade: "good",
        outcomes: [
          { chance: 0.6, effects: { health: -4, power: +2, happy: +6 }, grade: "good", narrative: "1년 뒤 그라운드에 돌아왔다. 관중이 기립박수를 쳤다." },
          { chance: 0.4, effects: { health: -8, power: -6, happy: -8 }, grade: "bad", narrative: "예전 같지 않았다. 몸이 기억하던 속도가 사라졌다.", life: {"step": 1} },
        ] },
      { id: "play", emoji: "💉", text: "진통제 맞고 뛴다", grade: "bad",
        outcomes: [
          { chance: 0.3, effects: { happy: +8, health: -6 }, grade: "mid", narrative: "결승전을 이겼다. 대가는 나중에 왔다." },
          { chance: 0.7, effects: { health: -15, happy: -10, power: -8 }, grade: "bad", narrative: "부상이 악화됐다. 선수 생명이 위태롭다.", life: {"step": 1} },
        ] },
    ],
  }),
  E({
    id: "cr_at_national", career: "athlete", step: [1, 2], age: [19, 33], emoji: "🇰🇷", title: "국가대표 발탁",
    desc: "국가대표 예비 명단에 이름이 올랐다. 최종 명단까지 남은 건 한 달.", repeat: 5, flagBanned: ["at_national"],
    choices: [
      { id: "prove", emoji: "🔥", text: "소집 훈련에서 전부 보여 준다", grade: "good",
        outcomes: [
          { chance: 0.5, effects: { happy: +10, social: +5 }, grade: "crit", narrative: "최종 명단 발표. 가슴에 태극기를 달았다.", life: {"step": 2}, flag: {"add": ["at_national"]} },
          { chance: 0.5, effects: { happy: -6 }, grade: "bad", narrative: "마지막에 빠졌다. 다음 대회를 노린다." },
        ] },
    ],
  }),
  E({
    id: "cr_at_olympic", career: "athlete", step: [2, 3], age: [20, 36], emoji: "🥇", title: "올림픽 결승",
    desc: "4년을 이날을 위해 살았다. 결승 출발선에 섰다.", flagRequired: ["at_national"], repeat: 5, flagBanned: ["at_gold"],
    choices: [
      { id: "go", emoji: "🏃", text: "모든 걸 쏟아붓는다", grade: "crit",
        outcomes: [
          { chance: 0.35, effects: { happy: +16, social: +8, money: +5000, internet: +6 }, grade: "crit", narrative: "금메달. 시상대 위에서 애국가가 울렸다.", life: {"step": 3}, flag: {"add": ["at_gold"]} },
          { chance: 0.35, effects: { happy: +8, social: +4, money: +1000 }, grade: "good", narrative: "은메달. 0.03초 차이였다.", life: {"step": 3}, flag: {"add": ["at_medal"]} },
          { chance: 0.3, effects: { happy: -8 }, grade: "bad", narrative: "4위. 메달은 없었지만 인생 최고의 기록이었다.", life: {"step": 3} },
        ] },
    ],
  }),
  E({
    id: "cr_at_transfer", career: "athlete", step: [2, 3], age: [21, 33], emoji: "✈️", title: "해외 이적 제안",
    desc: "유럽 구단에서 이적 제안이 왔다. 연봉은 세 배, 주전은 보장 못 한다.", repeat: 5, flagBanned: ["at_abroad"],
    choices: [
      { id: "go", emoji: "🌍", text: "간다", grade: "good",
        outcomes: [
          { chance: 0.5, effects: { happy: +10, money: +6000, social: +4 }, grade: "crit", narrative: "현지 팬들이 내 이름을 연호했다.", life: {"job": {"title": "해외파 선수", "salary": 12000}}, flag: {"add": ["at_abroad"]} },
          { chance: 0.5, effects: { happy: -6, money: +1500 }, grade: "bad", narrative: "벤치만 지켰다. 1년 만에 돌아왔다." },
        ] },
      { id: "stay", emoji: "🏠", text: "국내 리그의 에이스로 남는다", grade: "mid", effects: { happy: +4, social: +3 }, narratives: ["팀의 상징이 됐다. 영구결번 이야기까지 나왔다."] },
    ],
  }),
  E({
    id: "cr_at_retire", career: "athlete", step: [1, 5], age: [29, 42], emoji: "🌅", title: "은퇴의 기로",
    desc: "몸이 예전 같지 않다. 구단이 은퇴식을 제안했다. 그다음은?", minYears: 8, repeat: 5,
    choices: [
      { id: "coach", emoji: "📋", text: "지도자 자격증을 따고 코치로", grade: "good", life: {"step": 4, "job": {"title": "코치", "salary": 5000}}, flag: {"add": ["at_coach"]}, effects: { intel: +4, social: +4 }, narratives: ["자격증을 따고 친정팀 코치가 됐다. 새 도전의 시작."] },
      { id: "tv", emoji: "🎙️", text: "해설위원이 된다", grade: "mid", career: "streamer", life: {"step": 1, "job": {"title": "스포츠 해설위원", "salary": 5000}}, effects: { internet: +5, social: +4 }, narratives: ["마이크 앞에서 후배들의 경기를 봤다. 말솜씨가 의외로 좋았다."] },
      { id: "biz", emoji: "🏋️", text: "이름을 건 체육관을 연다", grade: "mid", career: "business", life: {"step": 1, "job": {"title": "체육관 대표", "salary": 4500}}, effects: { money: -3000, happy: +4 }, narratives: ["회원들이 사인을 받으러 왔다. 사업가로서의 새 출발."] },
      { id: "more", emoji: "💪", text: "한 시즌만 더", grade: "bad", effects: { health: -6, happy: +3 }, narratives: ["마지막 시즌은 힘들었다. 그래도 내 발로 걸어 나왔다."] },
    ],
  }),
  E({
    id: "cr_at_manager", career: "athlete", step: [4, 4], age: [36, 66], emoji: "🏆", title: "감독 제안",
    desc: "코치 생활 몇 년. 하위권 팀에서 감독을 맡아 달라고 한다.", flagRequired: ["at_coach"], minYears: 3, repeat: 5, flagBanned: ["at_manager"],
    choices: [
      { id: "take", emoji: "📣", text: "감독을 맡는다", grade: "crit",
        outcomes: [
          { chance: 0.45, effects: { happy: +14, social: +6, money: +3000 }, grade: "crit", narrative: "꼴찌 팀을 우승으로 이끌었다. 헹가래를 받았다.", life: {"step": 5, "job": {"title": "감독", "salary": 12000}}, flag: {"add": ["at_manager"]} },
          { chance: 0.55, effects: { happy: -8 }, grade: "bad", narrative: "성적 부진으로 1년 만에 경질됐다.", life: {"step": 4} },
        ] },
      { id: "no", emoji: "🙂", text: "코치로 남는다", grade: "mid", effects: { happy: +3 }, narratives: ["선수들 곁이 좋았다."] },
    ],
  }),
  E({
    id: "cr_ar_entry", age: [19, 45], emoji: "🎨", title: "작업실",
    desc: "반지하 작업실 월세 30만 원. 캔버스를 사면 밥값이 없다. 그래도 그리고 싶다.", careerEntry: "artist", weight: 0.9, cond: p => p.routes.has("artist") || (p.stats.happy >= 55 && p.stats.intel >= 50),
    choices: [
      { id: "go", emoji: "🖌️", text: "작업실을 계약한다", grade: "good", career: "artist", effects: { happy: +6, money: -300 }, narratives: ["물감 냄새가 집 냄새가 됐다. 전업 작가의 시작."] },
      { id: "no", emoji: "🖼️", text: "주말 화가로 만족", grade: "mid", effects: { happy: +3 }, narratives: ["거실 벽에 그림이 하나둘 늘었다."] },
    ],
  }),
  E({
    id: "cr_ar_exhibit", career: "artist", step: [0, 1], age: [20, 55], emoji: "🖼️", title: "첫 개인전",
    desc: "작은 갤러리에서 첫 개인전 제안이 왔다. 대관료는 내가 내야 한다.", weight: 1.4, repeat: 5,
    choices: [
      { id: "do", emoji: "🎨", text: "빚을 내서라도 연다", grade: "good",
        outcomes: [
          { chance: 0.45, effects: { happy: +10, money: +1000, social: +4 }, grade: "crit", narrative: "첫날 그림 세 점이 팔렸다. 미술 잡지에 짧은 기사가 실렸다.", life: {"step": 2} },
          { chance: 0.55, effects: { happy: -6, money: -500 }, grade: "bad", narrative: "방명록에는 가족과 친구 이름뿐이었다.", life: {"step": 1} },
        ] },
      { id: "group", emoji: "👥", text: "단체전부터 참여한다", grade: "mid", life: {"step": 1}, effects: { social: +4 }, narratives: ["다른 작가들과 친해졌다. 작업실 공동 임대 이야기가 나왔다."] },
    ],
  }),
  E({
    id: "cr_ar_poor", career: "artist", step: [0, 3], age: [21, 65], emoji: "🍜", title: "생활고",
    desc: "라면만 일주일째. 월세가 두 달 밀렸다.", repeat: 7,
    choices: [
      { id: "job", emoji: "🧾", text: "미술 학원 강사 알바", grade: "mid", effects: { money: +600, happy: -2 }, narratives: ["아이들 그림을 봐 주며 월세를 냈다. 내 그림 시간은 줄었다."] },
      { id: "contest", emoji: "🏅", text: "공모전에 승부를 건다", grade: "good",
        outcomes: [
          { chance: 0.35, effects: { happy: +10, money: +2000 }, grade: "crit", narrative: "대상. 상금으로 1년을 버틸 수 있게 됐다.", life: {"stepUp": 1} },
          { chance: 0.65, effects: { happy: -5 }, grade: "bad", narrative: "낙선. 그래도 그 그림은 내가 가장 아끼는 그림이 됐다." },
        ] },
      { id: "quit", emoji: "🚪", text: "붓을 꺾는다", grade: "bad", life: {"careerEnd": true}, effects: { happy: -6, money: +300 }, narratives: ["작업실을 뺐다. 캔버스들은 창고로 갔다."] },
    ],
  }),
  E({
    id: "cr_ar_collector", career: "artist", step: [1, 3], age: [24, 75], emoji: "💎", title: "큰손 컬렉터",
    desc: "유명 컬렉터가 작업실을 찾아왔다. '전부 사겠소. 대신 앞으로 5년간 나에게만 팔아요.'", weight: 0.8, repeat: 5,
    choices: [
      { id: "accept", emoji: "🤝", text: "계약한다", grade: "mid", life: {"step": 2}, effects: { money: +3000, happy: +4, social: -2 }, narratives: ["통장이 처음으로 넉넉해졌다. 작품이 세상에 보이지 않게 됐다."] },
      { id: "refuse", emoji: "🕊️", text: "내 그림은 모두가 봐야 한다", grade: "good", life: {"stepUp": 1}, effects: { happy: +5, intel: +2 }, narratives: ["가난은 계속됐다. 대신 전시 때마다 사람들이 그림 앞에 오래 머물렀다."] },
    ],
  }),
  E({
    id: "cr_ar_ai", career: "artist", step: [1, 4], age: [25, 80], emoji: "🤖", title: "AI 그림 논란",
    desc: "AI가 내 화풍을 똑같이 흉내 낸 그림이 인터넷에 쏟아진다.", repeat: 5,
    choices: [
      { id: "fight", emoji: "📢", text: "작가들과 함께 목소리를 낸다", grade: "good", effects: { social: +6, internet: +4 }, narratives: ["저작권 토론회에 패널로 나갔다. 내 이름이 기사에 실렸다."] },
      { id: "use", emoji: "🧪", text: "AI를 도구로 써 본다", grade: "mid", effects: { intel: +4, happy: +2 }, narratives: ["새로운 실험작이 나왔다. 반응은 극과 극이었다."] },
      { id: "brush", emoji: "🖌️", text: "더 손맛 나는 그림으로", grade: "good", effects: { happy: +4 }, narratives: ["두꺼운 물감 덩어리. 기계가 못 내는 질감을 찾았다."] },
    ],
  }),
  E({
    id: "cr_ar_biennale", career: "artist", step: [2, 3], age: [30, 80], emoji: "🌐", title: "해외 비엔날레 초청",
    desc: "세계적인 비엔날레에서 초청장이 왔다. 대형 신작이 필요하다.", minYears: 5, repeat: 5, flagBanned: ["ar_world"],
    choices: [
      { id: "make", emoji: "🏛️", text: "1년을 걸고 대작을 만든다", grade: "crit",
        outcomes: [
          { chance: 0.5, effects: { happy: +14, social: +8, money: +3000 }, grade: "crit", narrative: "전시장 앞에 줄이 섰다. 해외 미술관이 작품을 소장했다.", life: {"step": 4, "job": {"title": "세계적인 미술가", "salary": 6000}}, flag: {"add": ["ar_world"]} },
          { chance: 0.5, effects: { happy: -6, money: -2000, health: -4 }, grade: "bad", narrative: "평론은 차가웠다. 운송비만 빚으로 남았다." },
        ] },
    ],
  }),
  E({
    id: "cr_ar_retro", career: "artist", step: [3, 5], age: [50, 95], emoji: "🏛️", title: "미술관 회고전",
    desc: "국립미술관에서 평생의 작업을 모은 회고전을 열자고 한다.", minYears: 20, repeat: 5,
    choices: [
      { id: "yes", emoji: "🕯️", text: "반지하 시절 그림부터 건다", grade: "crit", life: {"step": 5}, flag: {"add": ["ar_master"]}, effects: { happy: +14, social: +6 }, narratives: ["첫 전시실에 라면 먹던 시절의 그림이 걸렸다. 젊은 화가들이 그 앞에서 울었다."] },
    ],
  }),
  E({
    id: "cr_st_first", career: "streamer", step: [0, 0], age: [16, 60], emoji: "📹", title: "구독자 1,000명의 벽",
    desc: "영상 50개째. 구독자 812명. 수익 창출 조건이 아직 멀다.", weight: 1.6, repeat: 2,
    choices: [
      { id: "daily", emoji: "📅", text: "매일 업로드한다", grade: "good",
        outcomes: [
          { chance: 0.55, effects: { internet: +6, happy: +8, health: -3 }, grade: "crit", narrative: "100일째 되는 날 1,000명을 넘었다. 첫 광고 수익 3만 원.", life: {"step": 1} },
          { chance: 0.45, effects: { health: -5, happy: -5 }, grade: "bad", narrative: "번아웃이 왔다. 구독자는 그대로였다." },
        ] },
      { id: "pivot", emoji: "🔄", text: "콘셉트를 바꾼다", grade: "mid",
        outcomes: [
          { chance: 0.45, effects: { internet: +8, happy: +8 }, grade: "crit", narrative: "새 콘셉트 첫 영상이 터졌다. 하루 만에 1만 명.", life: {"step": 1} },
          { chance: 0.55, effects: { happy: -4 }, grade: "mid", narrative: "기존 구독자마저 떠났다." },
        ] },
      { id: "quit", emoji: "🚪", text: "유튜브를 접는다", grade: "mid", life: {"careerEnd": true}, effects: { happy: +2 }, narratives: ["채널을 비공개로 돌렸다. 가끔 옛 영상을 혼자 봤다."] },
    ],
  }),
  E({
    id: "cr_st_silver", career: "streamer", step: [1, 1], age: [17, 65], emoji: "🥈", title: "실버 버튼",
    desc: "구독자 9만 8천. 10만까지 2천 명 남았다. 기념 이벤트를 할까?", repeat: 5,
    choices: [
      { id: "collab", emoji: "🤝", text: "인기 유튜버와 합방", grade: "good",
        outcomes: [
          { chance: 0.6, effects: { internet: +8, happy: +10, social: +4 }, grade: "crit", narrative: "하루 만에 10만 돌파. 실버 버튼이 택배로 왔다.", life: {"step": 2, "job": {"title": "인기 유튜버", "salary": 4500}} },
          { chance: 0.4, effects: { happy: -4, social: -2 }, grade: "bad", narrative: "합방 상대가 논란에 휩싸였다. 덩달아 욕을 먹었다." },
        ] },
      { id: "fans", emoji: "💌", text: "구독자 사연 읽기 방송", grade: "good", life: {"step": 2, "job": {"title": "인기 유튜버", "salary": 4500}}, effects: { social: +5, happy: +6 }, narratives: ["눈물 섞인 생방송. 천천히, 단단하게 10만이 됐다."] },
    ],
  }),
  E({
    id: "cr_st_controversy", career: "streamer", step: [2, 4], age: [18, 70], emoji: "🔥", title: "논란",
    desc: "예전 영상 속 발언이 캡처되어 돌고 있다. 댓글창이 불타고 있다.", weight: 0.9, repeat: 5,
    choices: [
      { id: "apology", emoji: "🙇", text: "진심으로 사과 영상", grade: "good",
        outcomes: [
          { chance: 0.6, effects: { social: +3, happy: -3 }, grade: "good", narrative: "진정성이 전해졌다. 오히려 응원이 늘었다." },
          { chance: 0.4, effects: { internet: -4, happy: -8 }, grade: "bad", narrative: "'사과문도 대본'이라는 비난. 구독자 3만 명이 떠났다.", life: {"step": 2} },
        ] },
      { id: "hide", emoji: "🫥", text: "잠수한다", grade: "bad", life: {"step": 2}, effects: { happy: -6, internet: -3 }, narratives: ["석 달 뒤 돌아왔을 때 조회수는 반토막이었다."] },
    ],
  }),
  E({
    id: "cr_st_ad", career: "streamer", step: [2, 4], age: [18, 70], emoji: "💰", title: "광고 제안",
    desc: "건강식품 회사에서 광고 제안이 왔다. 조건: '광고 표시는 작게'.", repeat: 5,
    choices: [
      { id: "honest", emoji: "✅", text: "광고 표시를 크게 하고 받는다", grade: "good", effects: { money: +800, social: +3 }, narratives: ["광고비는 깎였다. 구독자들이 '양심 유튜버'라 불렀다."] },
      { id: "hidden", emoji: "🤫", text: "뒷광고로 받는다", grade: "bad",
        outcomes: [
          { chance: 0.4, effects: { money: +2500 }, grade: "mid", narrative: "아무도 몰랐다. 아직은." },
          { chance: 0.6, effects: { money: -1500, internet: -6, happy: -10 }, grade: "bad", narrative: "뒷광고가 들통났다. 공정위 제재와 구독 취소 러시.", life: {"step": 2} },
        ] },
      { id: "no", emoji: "🙅", text: "거절한다", grade: "mid", effects: { happy: +2 }, narratives: ["아직은 내 콘텐츠만으로 충분했다."] },
    ],
  }),
  E({
    id: "cr_st_gold", career: "streamer", step: [2, 4], age: [20, 75], emoji: "🥇", title: "골드 버튼",
    desc: "구독자 80만. 100만이 보인다. 다음 단계는?", minYears: 4, repeat: 5, flagBanned: ["st_gold"],
    choices: [
      { id: "big", emoji: "🎬", text: "대형 기획 콘텐츠", grade: "crit",
        outcomes: [
          { chance: 0.5, effects: { happy: +14, internet: +8, money: +3000 }, grade: "crit", narrative: "100만 돌파. 골드 버튼을 들고 부모님 집에 갔다.", life: {"step": 5, "job": {"title": "100만 유튜버", "salary": 9000}}, flag: {"add": ["st_gold"]} },
          { chance: 0.5, effects: { money: -3000, happy: -6 }, grade: "bad", narrative: "제작비만 날렸다. 조회수가 기대에 못 미쳤다." },
        ] },
      { id: "steady", emoji: "🙂", text: "지금처럼 꾸준히", grade: "good", life: {"step": 5}, flag: {"add": ["st_gold"]}, effects: { happy: +4 }, narratives: ["3년 뒤 조용히 100만이 됐다."] },
    ],
  }),
  E({
    id: "cr_st_decline", career: "streamer", step: [2, 5], age: [28, 80], emoji: "📉", title: "조회수 하락",
    desc: "새 플랫폼, 새 유튜버들. 내 영상 조회수가 해마다 줄고 있다.", minYears: 6, repeat: 5,
    choices: [
      { id: "reinvent", emoji: "🔄", text: "새로운 장르에 도전", grade: "good",
        outcomes: [
          { chance: 0.45, effects: { happy: +8, internet: +5 }, grade: "crit", narrative: "'중년 유튜버의 반란'이 화제가 됐다.", life: {"stepUp": 1} },
          { chance: 0.55, effects: { happy: -4 }, grade: "mid", narrative: "새 장르도 잘 안 됐다." },
        ] },
      { id: "retire", emoji: "👋", text: "마지막 영상을 올린다", grade: "mid", life: {"careerEnd": true}, effects: { happy: +4 }, narratives: ["'그동안 고마웠어요.' 댓글이 2만 개 달렸다."] },
    ],
  }),
  E({
    id: "cr_gm_entry", age: [16, 23], emoji: "🎮", title: "프로팀 테스트",
    desc: "랭킹 1위를 찍었더니 프로팀에서 연락이 왔다. 엄마는 반대한다.", careerEntry: "gamer", weight: 1.0, cond: p => p.stats.internet >= 55 || p.routes.has("gamer"),
    choices: [
      { id: "go", emoji: "🖱️", text: "테스트를 본다", grade: "good",
        outcomes: [
          { chance: 0.5, effects: { happy: +10, internet: +4 }, grade: "crit", narrative: "합격. 팀 숙소에 짐을 풀었다.", career: "gamer" },
          { chance: 0.5, effects: { happy: -6 }, grade: "bad", narrative: "팀 게임 소통에서 떨어졌다." },
        ] },
      { id: "no", emoji: "📚", text: "엄마 말을 듣는다", grade: "mid", effects: { intel: +3, happy: -2 }, narratives: ["게임은 주말에만 했다. 랭킹은 점점 내려갔다."] },
    ],
  }),
  E({
    id: "cr_gm_rookie", career: "gamer", step: [0, 0], age: [16, 25], emoji: "🕹️", title: "데뷔전",
    desc: "리그 데뷔전. 상대는 작년 우승팀이다.", weight: 1.8, repeat: 1,
    choices: [
      { id: "carry", emoji: "⚔️", text: "내가 캐리한다", grade: "crit",
        outcomes: [
          { chance: 0.45, effects: { happy: +12, internet: +8 }, grade: "crit", narrative: "POG. 하이라이트가 수십만 뷰를 찍었다.", life: {"step": 1, "job": {"title": "프로게이머", "salary": 5000}} },
          { chance: 0.55, effects: { happy: -6, internet: +2 }, grade: "bad", narrative: "실수가 클립으로 돌았다. '그 신인'이 됐다.", life: {"step": 1, "job": {"title": "프로게이머", "salary": 3000}} },
        ] },
      { id: "team", emoji: "🗣️", text: "팀 콜에 충실하게", grade: "good", life: {"step": 1, "job": {"title": "프로게이머", "salary": 4000}}, effects: { social: +4, happy: +5 }, narratives: ["팀이 이겼다. 선배들이 '얘 쓸 만하다'고 했다."] },
    ],
  }),
  E({
    id: "cr_gm_toxic", career: "gamer", step: [0, 3], age: [16, 30], emoji: "💢", title: "솔로랭크 막말",
    desc: "솔로랭크에서 트롤을 만나 욕이 튀어나왔다. 방송 중이었다.", weight: 0.8, repeat: 5,
    choices: [
      { id: "apologize", emoji: "🙇", text: "바로 사과한다", grade: "good", effects: { social: +3, happy: -3 }, narratives: ["징계는 벌금으로 끝났다. 감정 조절 상담을 받기 시작했다."] },
      { id: "excuse", emoji: "😤", text: "'트롤이 먼저였다'", grade: "bad", life: {"step": 1}, effects: { internet: -4, social: -5 }, narratives: ["출전 정지 3경기. 팬들이 실망했다."] },
    ],
  }),
  E({
    id: "cr_gm_worlds", career: "gamer", step: [1, 2], age: [17, 30], emoji: "🏆", title: "월드 챔피언십",
    desc: "월드 챔피언십 결승. 수만 명의 함성이 헤드셋을 뚫고 들어온다.", minYears: 1, repeat: 5, flagBanned: ["gm_champ"],
    choices: [
      { id: "final", emoji: "🌍", text: "마지막 한타", grade: "crit",
        outcomes: [
          { chance: 0.4, effects: { happy: +16, internet: +10, money: +3000, social: +6 }, grade: "crit", narrative: "우승. 소환사의 컵을 들어 올렸다.", life: {"step": 3}, flag: {"add": ["gm_champ"]} },
          { chance: 0.6, effects: { happy: -10 }, grade: "bad", narrative: "준우승. 무대 위에서 고개를 숙였다.", life: {"step": 2} },
        ] },
    ],
  }),
  E({
    id: "cr_gm_wrist", career: "gamer", step: [1, 3], age: [18, 30], emoji: "🖐️", title: "손목 부상",
    desc: "하루 14시간 연습. 손목이 비명을 지른다. 다음 주가 플레이오프다.", repeat: 5,
    choices: [
      { id: "rest", emoji: "🧊", text: "쉬면서 치료한다", grade: "good", effects: { health: +5, happy: -3 }, narratives: ["플레이오프는 후보 선수가 뛰었다. 손목은 지켰다."] },
      { id: "play", emoji: "💉", text: "주사 맞고 뛴다", grade: "bad",
        outcomes: [
          { chance: 0.4, effects: { happy: +8 }, grade: "good", narrative: "플레이오프를 이겼다." },
          { chance: 0.6, effects: { health: -10, happy: -8 }, grade: "bad", narrative: "손목 터널 증후군 진단. 선수 생명이 짧아졌다.", life: {"step": 3} },
        ] },
    ],
  }),
  E({
    id: "cr_gm_retire", career: "gamer", step: [1, 5], age: [22, 34], emoji: "🎧", title: "은퇴 후의 길",
    desc: "반응 속도가 예전 같지 않다. 은퇴 기자회견을 앞두고 있다. 그다음은?", minYears: 4, repeat: 5,
    choices: [
      { id: "stream", emoji: "📺", text: "개인 방송을 시작한다", grade: "good", career: "streamer", life: {"step": 1, "job": {"title": "게임 스트리머", "salary": 4500}}, effects: { internet: +6, happy: +5 }, narratives: ["첫 방송 동시 시청자 3만. 프로 시절 팬들이 따라왔다."] },
      { id: "coach", emoji: "📋", text: "코치가 된다", grade: "good", life: {"step": 4, "job": {"title": "e스포츠 코치", "salary": 4500}}, flag: {"add": ["gm_coach"]}, effects: { intel: +4, social: +4 }, narratives: ["후배들의 플레이를 분석했다. 보는 눈은 여전했다."] },
      { id: "school", emoji: "🎓", text: "다시 공부를 시작한다", grade: "mid", life: {"careerEnd": true}, effects: { intel: +5, happy: +2 }, narratives: ["스물여섯 살 신입생. 교수님이 내 경기를 봤다고 했다."] },
    ],
  }),
  E({
    id: "cr_un_search", age: [20, 59], emoji: "📄", title: "구직 활동",
    desc: "일을 그만둔 지 몇 달. 구직 사이트 알림을 켰다.", unemployed: true, weight: 1.6,
    choices: [
      { id: "apply", emoji: "📨", text: "이력서를 50곳에 보낸다", grade: "good",
        outcomes: [
          { chance: 0.55, effects: { happy: +7 }, grade: "good", narrative: "면접 세 곳, 합격 한 곳. 다시 출근길에 올랐다.", life: {"job": {"title": "회사원", "salary": 3400}} },
          { chance: 0.45, effects: { happy: -6 }, grade: "bad", narrative: "연락 온 곳이 없다. 경력 공백을 묻는 질문이 무서워졌다." },
        ] },
      { id: "any", emoji: "🧾", text: "조건을 낮춰 바로 일한다", grade: "mid", life: {"job": {"title": "계약직 사원", "salary": 2700}}, effects: { happy: -2, money: +200 }, narratives: ["월급은 줄었지만 통장에 다시 돈이 들어온다."] },
      { id: "rest", emoji: "🛋️", text: "조금 더 쉰다", grade: "mid", effects: { health: +3, happy: +2, money: -200 }, narratives: ["늦잠을 잤다. 서두르지 않기로 했다."] },
    ],
  }),
  E({
    id: "cr_un_cert", age: [22, 59], emoji: "📜", title: "자격증 공부",
    desc: "새 출발을 위해 자격증을 따 볼까? 학원 상담 전단지가 책상 위에 있다.", unemployed: true, weight: 1.2,
    choices: [
      { id: "code", emoji: "💻", text: "코딩 국비 과정", grade: "good",
        outcomes: [
          { chance: 0.5, effects: { intel: +6, happy: +6 }, grade: "crit", narrative: "수료 후 개발자로 취업했다.", career: "developer" },
          { chance: 0.5, effects: { intel: +3, happy: -3 }, grade: "mid", narrative: "어려웠다. 수료증만 남았다." },
        ] },
      { id: "realtor", emoji: "🏠", text: "공인중개사 시험", grade: "good",
        outcomes: [
          { chance: 0.4, effects: { happy: +8, intel: +3 }, grade: "crit", narrative: "합격. 동네에 부동산 사무소를 냈다.", career: "business", life: {"job": {"title": "공인중개사", "salary": 4000}} },
          { chance: 0.6, effects: { happy: -5, money: -100 }, grade: "bad", narrative: "2점 차로 떨어졌다." },
        ] },
      { id: "care", emoji: "🤲", text: "요양보호사 자격증", grade: "mid", life: {"job": {"title": "요양보호사", "salary": 2600}}, effects: { social: +4, happy: +3 }, narratives: ["석 달 만에 자격증을 땄다. 요양원에서 일을 시작했다."] },
    ],
  }),
  E({
    id: "cr_un_startup", age: [25, 59], emoji: "🏪", title: "창업 준비",
    desc: "이참에 내 일을 해 볼까? 퇴직금이 통장에 그대로 있다.", unemployed: true, weight: 1.0,
    choices: [
      { id: "franchise", emoji: "🍗", text: "프랜차이즈 가게", grade: "mid", career: "business", life: {"job": {"title": "가게 사장", "salary": 3500}}, effects: { money: -3000, happy: +4 }, narratives: ["간판이 달렸다. 본사 교육을 받으며 사장님이 됐다."] },
      { id: "plan", emoji: "📝", text: "사업 계획부터 제대로", grade: "good", next: {"id": "cr_bz_entry", "after": 1}, effects: { intel: +4 }, narratives: ["시장 조사를 석 달 했다. 아이템이 하나로 좁혀졌다."] },
      { id: "no", emoji: "🙅", text: "사업은 무섭다", grade: "mid", effects: { happy: +1 }, narratives: ["퇴직금은 예금으로 넣어 뒀다."] },
    ],
  }),
  E({
    id: "cr_un_money", age: [20, 59], emoji: "🧮", title: "생활비가 바닥난다",
    desc: "수입이 끊기니 카드값이 무섭다. 이번 달 고정비만 200만 원.", unemployed: true, weight: 1.0,
    choices: [
      { id: "benefit", emoji: "🏛️", text: "실업급여를 신청한다", grade: "good", effects: { money: +600, happy: +2 }, narratives: ["고용센터에서 서류를 냈다. 한숨 돌렸다."] },
      { id: "parttime", emoji: "🛵", text: "배달 알바를 뛴다", grade: "mid", effects: { money: +500, health: -3 }, narratives: ["오토바이를 빌렸다. 비 오는 날이 제일 바빴다."] },
      { id: "loan", emoji: "💳", text: "대출로 버틴다", grade: "bad", effects: { money: -800, happy: -4 }, narratives: ["마이너스 통장이 깊어졌다."] },
    ],
  }),
  E({
    id: "cr_un_family", age: [20, 59], emoji: "🍲", title: "가족의 반응",
    desc: "일을 그만둔 걸 알게 된 가족들. 저녁 식탁에서 누군가 말을 꺼낸다.", unemployed: true, weight: 0.9,
    choices: [
      { id: "honest", emoji: "🗣️", text: "솔직하게 이야기한다", grade: "good", effects: { social: +4, happy: +4 }, narratives: ["'그동안 고생했다.' 그 한마디에 눈물이 났다."] },
      { id: "pretend", emoji: "🎭", text: "출근하는 척한다", grade: "bad", effects: { happy: -6, social: -2 }, narratives: ["매일 아침 양복을 입고 도서관에 갔다. 비밀은 무거웠다."] },
      { id: "spouse", emoji: "💑", text: "배우자에게 기댄다", grade: "good", married: true, effects: { happy: +5, social: +2 }, narratives: ["{spouse}가 말했다. '천천히 해. 내가 있잖아.'"] },
    ],
  }),
  E({
    id: "cr_un_rest", age: [20, 59], emoji: "🌿", title: "쉬어 가는 시간",
    desc: "알람 없는 아침. 오랜만에 나를 위한 시간이 생겼다.", unemployed: true, weight: 0.9,
    choices: [
      { id: "travel", emoji: "🧳", text: "혼자 여행을 떠난다", grade: "good", effects: { happy: +8, money: -300 }, narratives: ["낯선 바닷가에서 다음에 하고 싶은 일이 떠올랐다."] },
      { id: "gym", emoji: "🏃", text: "운동으로 몸을 만든다", grade: "good", effects: { health: +6, power: +3 }, narratives: ["매일 아침 공원을 달렸다. 몸이 가벼워졌다."] },
      { id: "read", emoji: "📚", text: "책을 읽으며 생각을 정리", grade: "good", effects: { intel: +5, happy: +3 }, narratives: ["도서관 대출 카드가 꽉 찼다."] },
    ],
  }),
  E({
    id: "cr_un_newpath", age: [20, 59], emoji: "🧭", title: "새로운 길",
    desc: "이번엔 정말 하고 싶은 일을 해 보고 싶다. 무엇을 할까?", unemployed: true, weight: 1.0,
    choices: [
      { id: "youtube", emoji: "🎥", text: "유튜브를 시작한다", grade: "good", career: "streamer", effects: { internet: +5, happy: +4 }, narratives: ["첫 영상의 조회수는 23. 그래도 시작이었다."] },
      { id: "write", emoji: "✍️", text: "글을 쓴다", grade: "good", career: "writer", effects: { intel: +4, happy: +4 }, narratives: ["그동안의 이야기를 원고로 옮기기 시작했다."] },
      { id: "civil", emoji: "📚", text: "공무원 시험을 준비한다", grade: "mid", next: {"id": "cr_cv_exam", "after": 1}, effects: { intel: +3 }, narratives: ["수험서를 샀다. 안정이 그리웠다."] },
    ],
  }),
  E({
    id: "cr_un_return", age: [20, 62], emoji: "📞", title: "예전 일터에서 온 연락",
    desc: "예전에 하던 일 쪽에서 연락이 왔다. '다시 같이 해 볼래요?'", unemployed: true, weight: 1.1, cond: p => p.careerHist.length > 0 && p.careerHist[p.careerHist.length - 1].state !== "COMPLETED",
    choices: [
      { id: "back", emoji: "↩️", text: "다시 돌아간다", grade: "good", careerReturn: true, effects: { happy: +6, social: +3 }, narratives: ["익숙한 일. 하지만 예전과는 다른 마음으로 시작했다."] },
      { id: "no", emoji: "🙏", text: "새 길을 찾겠다", grade: "mid", effects: { happy: +2 }, narratives: ["정중히 거절했다. 지나간 길은 지나간 대로."] },
    ],
  }),
  E({
    id: "cr_any_quit", age: [24, 59], emoji: "🤔", title: "이 일을 계속할까",
    desc: "요즘 출근길이 유난히 길다. 이 일을 계속하는 게 맞을까?", anyCareer: true, minYears: 4, repeat: 12, weight: 0.35,
    choices: [
      { id: "keep", emoji: "💪", text: "계속한다", grade: "good", effects: { happy: +2, power: +2 }, narratives: ["다시 마음을 다잡았다. 아직 해 보고 싶은 게 남았다."] },
      { id: "quit", emoji: "🚪", text: "그만둔다", grade: "mid", life: {"quit": true}, effects: { happy: +4, money: -300 }, narratives: ["마지막 날, 짐을 상자 하나에 담았다. 당분간은 쉬기로 했다."] },
    ],
  }),
  E({
    id: "cr_comeback", age: [20, 90], emoji: "🔁", title: "돌아온 자리",
    desc: "한동안 떠나 있던 일로 돌아왔다. 그새 많은 게 바뀌어 있었다.", comeback: true, weight: 3.0,
    choices: [
      { id: "fresh", emoji: "🌱", text: "초심으로 다시 배운다", grade: "good", effects: { intel: +4, happy: +4 }, narratives: ["예전에 몰랐던 게 보였다. 떠나 있던 시간도 경력이었다."] },
      { id: "old", emoji: "🧓", text: "예전 방식대로 한다", grade: "mid", effects: { happy: +1, social: -2 }, narratives: ["후배들이 '요즘은 그렇게 안 해요'라고 했다."] },
    ],
  }),
];

export const ENDINGS_CAREERS = [
  { id: "cr_end_president", emoji: "🇰🇷", title: "대통령의 삶", badge: "PRESIDENT", rarity: "rare", quote: "동네 구의원 선거 명함에서 청와대까지. 역사가 그 이름을 기억한다.", match: (s, r, c) => has(c, "pol_president") && !has(c, "pol_pres_scandal"), prio: 4.9 },
  { id: "cr_end_fallen_president", emoji: "⚖️", title: "몰락한 대통령", badge: "FALLEN", rarity: "rare", quote: "가장 높은 곳에 올랐다. 그래서 떨어질 때 더 아팠다.", match: (s, r, c) => has(c, "pol_president") && has(c, "pol_pres_scandal"), prio: 4.95 },
  { id: "cr_end_lawmaker", emoji: "🏛️", title: "여의도의 사람", badge: "LAWMAKER", rarity: "rare", quote: "법 몇 줄을 바꾸려고 평생을 싸웠다. 그 몇 줄이 누군가의 삶을 바꿨다.", match: (s, r, c) => has(c, "pol_mp") && !has(c, "pol_jailed"), prio: 4.6 },
  { id: "cr_end_pol_loser", emoji: "🎗️", title: "만년 후보", badge: "ALMOST", rarity: "rare", quote: "명함은 수만 장 돌렸다. 배지는 끝내 달지 못했다. 그래도 그 골목은 그를 기억한다.", match: (s, r, c) => has(c, "career_politics") && has(c, "pol_lost_once") && !has(c, "pol_local_win") && !has(c, "pol_mp"), prio: 4.4 },
  { id: "cr_end_pol_jail", emoji: "🔒", title: "배지 대신 수의", badge: "INDICTED", rarity: "rare", quote: "한 번의 쇼핑백이 모든 걸 앗아갔다.", match: (s, r, c) => has(c, "pol_jailed"), prio: 4.97 },
  { id: "cr_end_world_writer", emoji: "🌍", title: "세계가 읽은 작가", badge: "WORLD AUTHOR", rarity: "rare", quote: "50곳의 거절 메일에서 시작해 20개 언어로 끝났다. 문장은 국경을 넘었다.", match: (s, r, c) => has(c, "wr_world"), prio: 4.85 },
  { id: "cr_end_bestseller", emoji: "📚", title: "베스트셀러 작가", badge: "BESTSELLER", rarity: "rare", quote: "서점 맨 앞자리에 이름이 있었다. 누군가의 밤을 그의 문장이 지켰다.", match: (s, r, c) => has(c, "wr_best") || has(c, "wr_award"), prio: 4.7 },
  { id: "cr_end_unknown_writer", emoji: "🖋️", title: "끝까지 쓴 사람", badge: "STILL WRITING", rarity: "rare", quote: "유명해지지는 못했다. 그래도 매일 썼다. 그게 작가였다.", match: (s, r, c) => (c.career === "writer" && c.careerYearsNow >= 15) && !has(c, "wr_hit"), prio: 4.3 },
  { id: "cr_end_ceo", emoji: "🏙️", title: "신입에서 사장까지", badge: "CEO", rarity: "rare", quote: "연수원 장기자랑 무대에서 대표이사 취임식 무대까지. 30년이 한 계단씩이었다.", match: (s, r, c) => has(c, "co_ceo"), prio: 4.8 },
  { id: "cr_end_exec", emoji: "🏅", title: "별을 단 직장인", badge: "EXECUTIVE", rarity: "rare", quote: "동기 200명 중 단 몇 명만 오른 자리. 그 자리에 앉기까지 많은 저녁을 회사에 줬다.", match: (s, r, c) => has(c, "co_exec"), prio: 4.6 },
  { id: "cr_end_company_life", emoji: "👔", title: "회사와 함께한 청춘", badge: "LIFER", rarity: "rare", quote: "한 회사에서 정년까지. 명함은 바뀌었어도 출근길은 늘 같았다.", match: (s, r, c) => (c.careerHist || []).some(h => h.key === "corporate" && h.to - h.from >= 25), prio: 4.2 },
  { id: "cr_end_worker_life", emoji: "🧳", title: "평범해서 위대한 직장인", badge: "EVERYDAY HERO", rarity: "rare", quote: "이름 없는 작은 회사에서 수십 년. 그 월급으로 한 가족이 웃었다.", match: (s, r, c) => has(c, "wk_loyal") || (c.careerHist || []).some(h => h.key === "worker" && h.to - h.from >= 25), prio: 4.1 },
  { id: "cr_end_civil", emoji: "🗂️", title: "나라의 일꾼", badge: "PUBLIC SERVANT", rarity: "rare", quote: "화려하지 않았다. 하지만 그가 고친 서류 한 장에 누군가의 겨울이 따뜻해졌다.", match: (s, r, c) => has(c, "career_civil") && (has(c, "cv_kind") || has(c, "cv_hero") || has(c, "cv_integrity") || has(c, "cv_chief")), prio: 4.2 },
  { id: "cr_end_cto", emoji: "🛰️", title: "코드로 세상을 바꾼 사람", badge: "CTO", rarity: "rare", quote: "'Hello World'로 시작한 사람이 수백만 명이 쓰는 서비스를 만들었다.", match: (s, r, c) => has(c, "dev_cto"), prio: 4.7 },
  { id: "cr_end_doctor_legend", emoji: "🧬", title: "의학의 역사", badge: "BREAKTHROUGH", rarity: "rare", quote: "흰 가운을 처음 입던 날의 다짐을 끝까지 지켰다. 그 치료법으로 오늘도 누군가 산다.", match: (s, r, c) => has(c, "doc_breakthrough"), prio: 4.8 },
  { id: "cr_end_doctor", emoji: "🩺", title: "동네의 명의", badge: "HEALER", rarity: "rare", quote: "평생 몇만 명의 맥을 짚었다. '선생님 덕에 살았어요'라는 말을 들으며 살았다.", match: (s, r, c) => has(c, "career_doctor") && (has(c, "doc_saved") || has(c, "doc_mission") || has(c, "doc_clinic")), prio: 4.5 },
  { id: "cr_end_justice", emoji: "🕊️", title: "약자의 변호사", badge: "JUSTICE", rarity: "rare", quote: "돈이 되지 않는 사건만 골라 맡았다. 판결문 몇 장이 세상을 조금 바꿨다.", match: (s, r, c) => has(c, "law_justice") || (has(c, "law_public") && has(c, "career_lawyer")), prio: 4.6 },
  { id: "cr_end_partner", emoji: "💼", title: "로펌의 정상", badge: "PARTNER", rarity: "rare", quote: "한강이 보이는 사무실. 그 창가에 서기까지 수천 번의 야근이 있었다.", match: (s, r, c) => has(c, "law_partner"), prio: 4.5 },
  { id: "cr_end_disbarred", emoji: "🚫", title: "배지를 잃은 변호사", badge: "DISBARRED", rarity: "rare", quote: "한 번의 USB가 20년의 배지를 앗아갔다.", match: (s, r, c) => has(c, "law_disbarred"), prio: 4.9 },
  { id: "cr_end_teacher", emoji: "🍎", title: "스승", badge: "MENTOR", rarity: "rare", quote: "수천 명의 아이가 그 교실을 지나갔다. 그중 몇은 지금 교단에 서 있다.", match: (s, r, c) => has(c, "career_teacher") && (has(c, "tch_legacy") || has(c, "tch_saved_kid") || has(c, "tch_principal")), prio: 4.5 },
  { id: "cr_end_topstar", emoji: "👑", title: "시대의 톱스타", badge: "SUPERSTAR", rarity: "rare", quote: "새벽 4시 연습실에서 시작해 스타디움의 함성으로 끝났다.", match: (s, r, c) => has(c, "id_top"), prio: 4.8 },
  { id: "cr_end_idol_memory", emoji: "💿", title: "누군가의 청춘", badge: "IDOL", rarity: "rare", quote: "1위는 못 해 봤다. 그래도 누군가의 이어폰 속 청춘이었다.", match: (s, r, c) => has(c, "career_idol") && !has(c, "id_top") && (has(c, "id_loyal_fans") || has(c, "id_reunion")), prio: 4.3 },
  { id: "cr_end_tycoon", emoji: "🏢", title: "맨손의 그룹 회장", badge: "TYCOON", rarity: "rare", quote: "한밤중 떠오른 아이템 하나가 계열사 열 개가 됐다.", match: (s, r, c) => has(c, "bz_group"), prio: 4.85 },
  { id: "cr_end_exit", emoji: "🚀", title: "엑시트한 창업가", badge: "EXIT", rarity: "rare", quote: "키운 회사를 좋은 값에 보냈다. 그리고 다시 무엇을 만들지 고민했다.", match: (s, r, c) => has(c, "bz_exit"), prio: 4.7 },
  { id: "cr_end_bankrupt", emoji: "🧯", title: "폐업 신고서", badge: "BANKRUPT", rarity: "rare", quote: "간판을 내리던 날도 다음 아이템을 생각했다. 사업가는 그런 사람이었다.", match: (s, r, c) => has(c, "bz_bankrupt") && !has(c, "bz_exit") && !has(c, "bz_group"), prio: 4.4 },
  { id: "cr_end_gold", emoji: "🥇", title: "금메달리스트", badge: "GOLD", rarity: "rare", quote: "0.01초를 줄이려 청춘을 다 썼다. 시상대 위의 그 순간은 영원했다.", match: (s, r, c) => has(c, "at_gold"), prio: 4.85 },
  { id: "cr_end_coach", emoji: "📣", title: "명감독", badge: "COACH", rarity: "rare", quote: "선수로는 다 이루지 못했다. 감독으로 그 꿈을 제자들과 이뤘다.", match: (s, r, c) => has(c, "at_manager"), prio: 4.7 },
  { id: "cr_end_master_artist", emoji: "🖼️", title: "거장", badge: "MASTER", rarity: "rare", quote: "반지하 작업실의 물감 냄새가 국립미술관의 첫 전시실까지 이어졌다.", match: (s, r, c) => has(c, "ar_master") || has(c, "ar_world"), prio: 4.75 },
  { id: "cr_end_gold_button", emoji: "🥇", title: "100만 유튜버", badge: "GOLD BUTTON", rarity: "rare", quote: "구독자 812명에서 100만까지. 카메라 앞의 매일이 쌓였다.", match: (s, r, c) => has(c, "st_gold"), prio: 4.7 },
  { id: "cr_end_world_champ", emoji: "🏆", title: "월드 챔피언", badge: "CHAMPION", rarity: "rare", quote: "엄마가 반대하던 게임으로 세계 정상에 섰다. 결승전 날, 엄마가 객석에 있었다.", match: (s, r, c) => has(c, "gm_champ"), prio: 4.8 },
];
