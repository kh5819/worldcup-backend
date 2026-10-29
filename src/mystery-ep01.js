// =========================
// 플듀 미스터리 EP.01 「자정에 멈춘 시계」 — 사건 데이터 (서버 전용, 정답 포함)
// 설계서: docs/mystery-ep01-scenario.md
// 클라이언트에는 mystery.js가 solution/조건을 걸러낸 공개 정보만 보낸다.
// =========================

export const EP01 = {
  id: "ep01",
  title: "자정에 멈춘 시계",
  subtitle: "EPISODE 01",
  startScene: "square",
  introDialogue: "intro",

  characters: {
    detective: { name: "탐정", color: "#c9a96e" },
    isabel: { name: "이자벨", color: "#d98b6a", role: "시계공의 수제자" },
    mayor: { name: "홀름 시장", color: "#7a8fb5", role: "에셀 마을 시장" },
    lucien: { name: "루시앙", color: "#9c7bb8", role: "골동품상" },
    veronica: { name: "베로니카", color: "#c47a7a", role: "여관 '은방울' 주인" },
    penelope: { name: "페넬로페", color: "#7fb08a", role: "시청 비서" },
    basil: { name: "바실", color: "#c9a25a", role: "빵집 주인" },
    oskar: { name: "오스카", color: "#b59a6a", role: "에셀 마을의 시계공" },
    narrator: { name: "", color: "#e8dcc4" },
  },

  // ---------- 증거 ----------
  evidence: {
    E01: { name: "멈춘 공공 시계들", icon: "clock", key: true, topic: ["time"], desc: "시청·여관·약국·성당 시계가 모두 12시 00분에 멈춰 있다. 빵집의 태엽 괘종시계만 제대로 간다." },
    E02: { name: "동기 시계 배선도", icon: "wire", key: true, topic: ["mechanism", "tower"], desc: "마을의 공공 시계는 전부 시계탑 마스터 시계의 전기 신호로 움직인다. 마스터 시계가 멈추면 함께 멈춘다." },
    E03: { name: "안쪽에서 걸린 빗장", icon: "bolt", key: true, topic: ["room"], desc: "작업실 문의 빗장은 안쪽에서만 걸 수 있다. 억지로 연 흔적은 없다." },
    E04: { name: "깨진 회중시계", icon: "watch", key: true, topic: ["time", "oskar"], desc: "오스카의 회중시계. 유리가 깨진 채 11시 47분에 멈춰 있다. 태엽식이라 시계탑과는 상관없다." },
    E05: { name: "협박 편지", icon: "letter", key: true, topic: ["letter"], desc: "\"자정에 마스터 시계를 멈춰라. 그러지 않으면 네 제자가 대가를 치른다.\" 추신은 암호로 '탑 아래에서 기다린다'." },
    E06: { name: "시청 문장 편지지", icon: "seal", topic: ["letter", "mayor"], desc: "협박 편지는 시청 문장이 찍힌 공용 편지지에 쓰여 있다." },
    E07: { name: "기름 발자국", icon: "foot", key: true, topic: ["room", "oskar"], desc: "시계 기름을 밟은 구두 자국이 작업대에서 괘종시계 쪽으로 이어지다 벽 앞에서 끊긴다. 크기는 오스카의 구두와 같다." },
    E08: { name: "괘종시계 뒤 비밀 통로", icon: "door", key: true, topic: ["room", "tower"], desc: "괘종시계 뒤에 지하 통로가 있다. 시계탑 방향으로 이어지지만 저편에서 막혀 있다." },
    E09: { name: "대출 카드 'L.'", icon: "card", topic: ["person", "vault"], desc: "10월 20일, 『에셀 창건기』를 빌려 간 사람의 서명은 'L.' 뿐이다." },
    E10: { name: "창건자의 금고 도면", icon: "map", key: true, topic: ["vault", "tower"], desc: "시계탑 지하의 금고. '마스터 시계가 자정에 멈출 때 첫 문이 열리고, 둘째 문은 시계공의 종소리로 열린다.'" },
    E11: { name: "루시앙의 증언", icon: "speech", key: true, topic: ["time", "person"], desc: "\"여관을 나와 광장 시계를 보니 12시 반이라 서둘러 집에 갔소.\"" },
    E12: { name: "베로니카의 증언", icon: "speech", topic: ["time", "person"], desc: "\"루시앙 씨는 11시 40분쯤 식당을 나갔어요. 손님들이 계산하던 때라 기억해요.\"" },
    E13: { name: "시계탑 철거 계획서", icon: "doc", topic: ["mayor", "tower"], desc: "홀름 시장이 추진 중인 재개발 계획. 시계탑을 헐고 새 시청을 짓는다. 오스카가 공개적으로 반대했다." },
    E14: { name: "이자벨의 열쇠", icon: "key", topic: ["room", "person"], desc: "작업실 문 열쇠는 오스카와 이자벨만 가지고 있다. 하지만 빗장은 열쇠로 걸 수 없다." },
    E15: { name: "편지지 도난 메모", icon: "note", key: true, topic: ["letter", "person"], desc: "10월 25일 비서의 메모: '공용 편지지 한 묶음이 빔. 어제 세금 문제로 루시앙 씨 방문.'" },
    E16: { name: "탑 계단의 두 발자국", icon: "foot", topic: ["tower", "person"], desc: "계단 먼지 위에 두 사람의 발자국. 하나는 오스카의 구두, 하나는 굽 높은 가죽 구두." },
    E18: { name: "오스카의 작업 일지", icon: "doc", topic: ["oskar", "vault", "person"], desc: "10월 21일: 'L.이 또 찾아와 탑 아래 금고 이야기를 캐물었다. 모른다고 했다.' 10월 28일: '편지가 왔다. 이자벨만은 지킨다.'" },
    E19: { name: "보라색 코트 단추", icon: "seal", topic: ["tower", "person"], desc: "기계실 바닥에서 주운 보라색 천 단추. 루시앙이 입는 보라색 코트의 단추와 같다." },
    E20: { name: "탑으로 가는 뒷골목", icon: "map", topic: ["time", "place", "person"], desc: "여관에서 빵집·시청 앞을 피해 10분 안에 탑 아래 문에 닿는 길은 하나뿐이다. 11시 40분에 나섰다면 11시 50분에 탑 아래." },
    E21: { name: "바실의 증언", icon: "speech", topic: ["time", "person", "place"], desc: "\"자정 직전에 외상값 갚으러 온 여자 손님이 있었지. 시청 사람은 아니었어.\" — 빵집 주인 바실" },
    E22: { name: "진자 칸의 작은 손자국", icon: "foot", topic: ["room", "person"], desc: "괘종시계 진자 칸 유리 안쪽에 남은 작은 손자국. 오스카의 손보다 훨씬 작다. 손자국 위에 먼지가 얇게 앉아 있다." },
    E24: { name: "빈 편지지 상자", icon: "doc", topic: ["letter", "person"], desc: "비서 책상의 편지지 상자. 뚜껑의 재고표엔 '10/23 · 50장'이라 적혀 있는데 안은 텅 비었다. 맨 아래 한 장이 상자 바닥에 눌어붙어 있다." },
    E25: { name: "탑 아래 문의 빗장", icon: "bolt", key: true, topic: ["tower", "time"], desc: "탑 뒤편 '탑 아래 문'의 빗장은 안쪽에서만 풀린다. 빗장 손잡이에 묻은 시계 기름이 아직 끈적하다 — 어젯밤 누군가 안에서 열었다." },
    E26: { name: "끼워 넣은 한 장", icon: "doc", key: true, topic: ["letter", "person", "oskar"], desc: "오스카의 일지 사이에 끼워진 한 장. 다른 장은 모두 작업실 공책 종이인데, 이 장만 빛에 비추면 시청 문장이 보이는 편지지다." },
    E17: { name: "창건 기념 동판", icon: "plaque", topic: ["tower", "vault"], desc: "\"에셀 마을, 1847년 3월 15일 이 탑 아래 세우다.\"" },
  },

  // ---------- 장소 ----------
  // 좌표는 1600×900 화면 기준 비율(0~1). requires = 필요한 플래그, hideIf = 이 플래그가 있으면 숨김
  scenes: {
    square: {
      name: "에셀 마을 광장", art: "square", bgm: "town",
      hotspots: [
        { id: "sq_clocks", label: "광장 시계", x: 0.43, y: 0.12, w: 0.14, h: 0.2, action: { type: "talk", dialogue: "sq_clocks" } },
        { id: "sq_plaque", label: "창건 기념 동판", x: 0.44, y: 0.62, w: 0.12, h: 0.1, action: { type: "talk", dialogue: "sq_plaque" } },
        { id: "sq_box", label: "배전함", x: 0.62, y: 0.5, w: 0.06, h: 0.14, requires: ["met_isabel"], action: { type: "puzzle", puzzle: "P01" } },
        { id: "sq_fountain", label: "분수", x: 0.14, y: 0.6, w: 0.16, h: 0.18, action: { type: "puzzle", puzzle: "H2" } },
        { id: "sq_isabel", label: "이자벨", x: 0.7, y: 0.5, w: 0.07, h: 0.32, npc: "isabel", hideIf: ["d1"], action: { type: "talk", dialogue: "sq_isabel" } },
        { id: "sq_bakery", label: "빵집 '황금 밀'", x: 0.03, y: 0.3, w: 0.1, h: 0.3, action: { type: "talk", dialogue: "sq_basil" } },
      ],
      exits: [
        { to: "workshop_out", label: "시계공 작업실", requires: ["met_isabel"] },
        { to: "library", label: "오래된 서재", requires: ["twist1"] },
        { to: "inn", label: "여관 '은방울'", requires: ["twist1"] },
        { to: "townhall", label: "시청", requires: ["twist1"] },
        { to: "tower_back", label: "시계탑 뒤편", requires: ["tower_open"] },
      ],
    },
    workshop_out: {
      name: "작업실 앞", art: "workshop_out", bgm: "investigate",
      hotspots: [
        { id: "wo_door", label: "잠긴 문", x: 0.42, y: 0.25, w: 0.16, h: 0.55, action: { type: "puzzle", puzzle: "P02" } },
        { id: "wo_isabel", label: "이자벨", x: 0.68, y: 0.42, w: 0.08, h: 0.4, npc: "isabel", hideIf: ["p02"], action: { type: "talk", dialogue: "wo_isabel" } },
      ],
      exits: [
        { to: "square", label: "광장" },
        { to: "workshop", label: "작업실 안으로", requires: ["p02"] },
      ],
    },
    workshop: {
      name: "시계공 작업실", art: "workshop", bgm: "investigate",
      hotspots: [
        { id: "ws_bolt", label: "문 빗장", x: 0.05, y: 0.35, w: 0.07, h: 0.18, action: { type: "talk", dialogue: "ws_bolt" } },
        { id: "ws_watch", label: "깨진 회중시계", x: 0.4, y: 0.6, w: 0.07, h: 0.08, action: { type: "puzzle", puzzle: "P03" } },
        { id: "ws_letter", label: "편지", x: 0.52, y: 0.6, w: 0.08, h: 0.07, action: { type: "puzzle", puzzle: "P04" } },
        { id: "ws_floor", label: "바닥의 얼룩", x: 0.55, y: 0.82, w: 0.2, h: 0.1, action: { type: "talk", dialogue: "ws_floor" } },
        { id: "ws_clock", label: "커다란 괘종시계", x: 0.8, y: 0.15, w: 0.12, h: 0.7, hideIf: ["isabel_clock"], action: { type: "talk", dialogue: "ws_clock" } },
        { id: "ws_gears", label: "괘종시계 진자 칸", x: 0.8, y: 0.15, w: 0.12, h: 0.7, requires: ["d1", "isabel_clock"], action: { type: "puzzle", puzzle: "P05", after: "ws_clock" } },
        { id: "ws_isabel", label: "이자벨", x: 0.25, y: 0.42, w: 0.08, h: 0.42, npc: "isabel", action: { type: "talk", dialogue: "ws_isabel" } },
        { id: "ws_ask_isabel", label: "이자벨을 심문한다", x: 0.22, y: 0.22, w: 0.12, h: 0.14, requires: ["got_E22"], action: { type: "interrogate", id: "isabel" } },
        { id: "ws_drawer", label: "잠긴 작업대 서랍", x: 0.6, y: 0.7, w: 0.08, h: 0.06, action: { type: "puzzle", puzzle: "S1" } },
      ],
      exits: [{ to: "workshop_out", label: "밖으로" }],
    },
    library: {
      name: "오래된 서재", art: "library", bgm: "investigate",
      hotspots: [
        { id: "lb_cards", label: "대출 카드함", x: 0.18, y: 0.55, w: 0.12, h: 0.14, action: { type: "puzzle", puzzle: "P06" } },
        { id: "lb_shelf", label: "창건자의 책장", x: 0.55, y: 0.12, w: 0.25, h: 0.6, action: { type: "puzzle", puzzle: "P07" } },
        { id: "lb_book", label: "펼쳐진 그림책", x: 0.38, y: 0.68, w: 0.1, h: 0.08, action: { type: "puzzle", puzzle: "H3" } },
        { id: "lb_window", label: "창가", x: 0.86, y: 0.15, w: 0.1, h: 0.4, action: { type: "talk", dialogue: "lb_window" } },
      ],
      exits: [{ to: "square", label: "광장" }],
    },
    inn: {
      name: "여관 '은방울' 식당", art: "inn", bgm: "suspect",
      hotspots: [
        { id: "in_veronica", label: "베로니카", x: 0.22, y: 0.38, w: 0.08, h: 0.42, npc: "veronica", action: { type: "talk", dialogue: "in_veronica" } },
        { id: "in_lucien", label: "루시앙", x: 0.62, y: 0.4, w: 0.08, h: 0.42, npc: "lucien", hideIf: ["lucien_fled"], action: { type: "talk", dialogue: "in_lucien" } },
        { id: "in_board", label: "알리바이 정리 (탐정 수첩)", x: 0.42, y: 0.68, w: 0.12, h: 0.12, requires: ["got_E11", "veronica_confessed", "talked_mayor", "penelope_admit"], action: { type: "puzzle", puzzle: "P08" } },
        { id: "in_ask_veronica", label: "베로니카를 심문한다", x: 0.2, y: 0.2, w: 0.12, h: 0.14, requires: ["got_E12"], action: { type: "interrogate", id: "veronica" } },
        { id: "in_confront", label: "루시앙을 심문한다", x: 0.6, y: 0.2, w: 0.12, h: 0.14, requires: ["d3", "p08"], hideIf: ["lucien_fled"], action: { type: "interrogate", id: "lucien" } },
        { id: "in_clock", label: "식당 벽시계", x: 0.45, y: 0.1, w: 0.08, h: 0.14, action: { type: "talk", dialogue: "in_clock" } },
        { id: "in_map", label: "벽에 걸린 마을 지도", x: 0.8, y: 0.16, w: 0.1, h: 0.16, requires: ["got_E12"], action: { type: "puzzle", puzzle: "S3" } },
      ],
      exits: [{ to: "square", label: "광장" }],
    },
    townhall: {
      name: "시청 집무실", art: "townhall", bgm: "suspect",
      hotspots: [
        { id: "th_mayor", label: "홀름 시장", x: 0.46, y: 0.36, w: 0.09, h: 0.44, npc: "mayor", action: { type: "talk", dialogue: "th_mayor" } },
        { id: "th_penelope", label: "페넬로페", x: 0.75, y: 0.4, w: 0.08, h: 0.42, npc: "penelope", action: { type: "talk", dialogue: "th_penelope" } },
        { id: "th_ask_mayor", label: "시장을 심문한다", x: 0.46, y: 0.18, w: 0.12, h: 0.14, requires: ["talked_mayor", "got_E06"], action: { type: "interrogate", id: "mayor" } },
        { id: "th_plan", label: "책상 위 도면", x: 0.25, y: 0.62, w: 0.12, h: 0.09, action: { type: "talk", dialogue: "th_plan" } },
        { id: "th_desk", label: "비서의 책상", x: 0.86, y: 0.62, w: 0.11, h: 0.12, requires: ["talked_penelope"], action: { type: "talk", dialogue: "th_desk" } },
        { id: "th_ask_penelope", label: "페넬로페를 심문한다", x: 0.74, y: 0.2, w: 0.12, h: 0.14, requires: ["got_E24"], action: { type: "interrogate", id: "penelope" } },
      ],
      exits: [{ to: "square", label: "광장" }],
    },
    tower: {
      name: "시계탑 1층", art: "tower", bgm: "tension",
      hotspots: [
        { id: "tw_stairs", label: "먼지 쌓인 계단", x: 0.3, y: 0.55, w: 0.16, h: 0.3, action: { type: "talk", dialogue: "tw_stairs" } },
        { id: "tw_gate", label: "승강대 앞 철문", x: 0.6, y: 0.22, w: 0.17, h: 0.62, hideIf: ["t2"], action: { type: "puzzle", puzzle: "T2" } },
        { id: "tw_lift", label: "추 승강대", x: 0.62, y: 0.3, w: 0.14, h: 0.5, requires: ["t2"], action: { type: "puzzle", puzzle: "P10" } },
      ],
      exits: [
        { to: "tower_back", label: "탑 뒤편으로" },
        { to: "tower_top", label: "기계실로 올라간다", requires: ["p10"] },
      ],
    },
    tower_back: {
      name: "시계탑 뒤편", art: "tower_back", bgm: "tension",
      hotspots: [
        { id: "tb_door", label: "탑 아래 문 (크랭크 장치)", x: 0.42, y: 0.3, w: 0.18, h: 0.52, hideIf: ["t1"], action: { type: "puzzle", puzzle: "T1" } },
        { id: "tb_ground", label: "젖은 자갈길", x: 0.18, y: 0.82, w: 0.3, h: 0.12, action: { type: "talk", dialogue: "tb_ground" } },
        { id: "tb_hook", label: "벽의 등불 고리", x: 0.73, y: 0.36, w: 0.07, h: 0.12, action: { type: "talk", dialogue: "tb_hook" } },
      ],
      exits: [
        { to: "square", label: "광장" },
        { to: "tower", label: "탑 안으로", requires: ["t1"] },
      ],
    },
    tower_top: {
      name: "시계탑 기계실", art: "tower_top", bgm: "tension",
      hotspots: [
        { id: "tt_master", label: "마스터 시계", x: 0.38, y: 0.12, w: 0.24, h: 0.42, action: { type: "puzzle", puzzle: "P11" } },
        { id: "tt_gears", label: "멈춘 톱니바퀴", x: 0.08, y: 0.4, w: 0.18, h: 0.3, action: { type: "talk", dialogue: "tt_gears" } },
        { id: "tt_floor", label: "어질러진 바닥", x: 0.66, y: 0.74, w: 0.24, h: 0.14, action: { type: "puzzle", puzzle: "S2" } },
      ],
      exits: [
        { to: "tower", label: "1층으로" },
        { to: "underground", label: "지하로 내려간다", requires: ["p11"] },
      ],
    },
    underground: {
      name: "시계탑 지하", art: "underground", bgm: "tension",
      hotspots: [
        { id: "ug_mirrors", label: "거울 장치", x: 0.3, y: 0.3, w: 0.3, h: 0.45, hideIf: ["p12"], action: { type: "puzzle", puzzle: "P12" } },
        { id: "ug_oskar", label: "오스카", x: 0.7, y: 0.4, w: 0.08, h: 0.42, npc: "oskar", requires: ["p12"], action: { type: "talk", dialogue: "ug_oskar" } },
        { id: "ug_vault", label: "금고의 둘째 문", x: 0.42, y: 0.2, w: 0.16, h: 0.5, requires: ["rescued"], action: { type: "puzzle", puzzle: "H1" } },
        { id: "ug_wall", label: "창고 벽의 긁힌 숫자", x: 0.83, y: 0.36, w: 0.08, h: 0.2, requires: ["rescued"], action: { type: "puzzle", puzzle: "C1" } },
        { id: "ug_niche", label: "종 옆의 벽 틈", x: 0.6, y: 0.14, w: 0.06, h: 0.1, requires: ["c1"], action: { type: "puzzle", puzzle: "C2" } },
        { id: "ug_page", label: "일지 사이의 한 장", x: 0.28, y: 0.8, w: 0.1, h: 0.08, requires: ["c2"], action: { type: "puzzle", puzzle: "C3" } },
        { id: "ug_final", label: "모두를 모아 진실을 밝힌다", x: 0.05, y: 0.75, w: 0.2, h: 0.12, requires: ["rescued", "c3"], action: { type: "final" } },
      ],
      exits: [{ to: "tower_top", label: "기계실로" }],
    },
  },

  // ---------- 대화 ----------
  // 같은 id 안에 variants: 위에서부터 조건(when/not)이 맞는 첫 번째를 쓴다.
  // set = 켜는 플래그, give = 얻는 증거, move = 대화 후 이동
  dialogues: {
    intro: [{
      lines: [
        ["narrator", "", "다음 날 아침. 멈춘 시계 아래로 사람들이 웅성거린다."],
        ["isabel", "worried", "탐정님…! 와 주셨군요. 저는 오스카 선생님의 제자, 이자벨이에요."],
        ["isabel", "worried", "아침에 작업실에 갔더니 문이 안에서 잠겨 있고, 아무리 불러도 대답이 없어요."],
        ["detective", "", "(마을 시계가 전부 멈췄고, 같은 밤 시계공이 사라졌다… 우연일 리 없다.)"],
      ],
      set: ["intro_done"],
    }],

    sq_clocks: [
      { when: ["got_E01"], lines: [["detective", "", "광장 시계는 여전히 12시 00분. 마을 시계는 모두 같은 순간에 멈췄다."]] },
      {
        lines: [
          ["detective", "", "광장의 큰 시계가 12시 00분에 멈춰 있다."],
          ["detective", "", "광장을 둘러싼 시청·여관·약국·성당 시계도… 전부 12시 00분이다."],
          ["detective", "", "(시계마다 태엽 상태가 다를 텐데, 모두 1초도 틀리지 않고 같은 순간에 멈췄다.)"],
        ],
        give: ["E01"],
      },
    ],
    sq_plaque: [
      { when: ["got_E17"], lines: [["detective", "", "\"1847년 3월 15일 이 탑 아래 세우다.\" 마을의 생일이다."]] },
      {
        lines: [
          ["detective", "", "광장 바닥에 박힌 동판이다. 글씨가 닳아 있다."],
          ["narrator", "", "\"에셀 마을, 1847년 3월 15일 이 탑 아래 세우다.\""],
          ["detective", "", "(\"탑 아래\"… 마을을 탑 '옆'이 아니라 '아래'에 세웠다? 묘한 표현이군.)"],
        ],
        give: ["E17"],
      },
    ],
    sq_isabel: [
      { when: ["p01"], lines: [["isabel", "worried", "작업실은 광장 동쪽 골목 끝이에요. 문은 아직 손대지 않았어요."]] },
      { when: ["met_isabel"], lines: [["isabel", "thinking", "선생님은 늘 '마을의 시계는 하나의 심장으로 뛴다'고 하셨어요. 저 배전함을 보시면 아실 거예요."]] },
      {
        lines: [
          ["isabel", "worried", "어젯밤엔 선생님께 인사드리고 11시쯤 여관 하숙방으로 돌아갔어요. 그때까진 평소와 같으셨는데…"],
          ["isabel", "sad", "아니, 조금 이상하셨어요. 계속 회중시계를 보시면서 '오늘 밤만 지나면 된다'고 중얼거리셨거든요."],
          ["detective", "", "마을 시계가 전부 같은 순간에 멈춘 이유를 알 수 있을까?"],
          ["isabel", "thinking", "광장 배전함을 열어 보세요. 마을 시계는 전부 전선으로 이어져 있어요. 그런데 오늘 아침 보니 배선판이 엉망이에요."],
        ],
        set: ["met_isabel"],
      },
    ],
    sq_basil: [
      { when: ["p08"], lines: [["basil", "smile", "외상값은 잘 받았네. 베로니카가 자정 직전에 와서 마저 갚고 갔지."]] },
      {
        lines: [
          ["basil", "smile", "어서 오게! 빵 냄새 맡고 왔나? 마을 시계가 다 멈춰서 오늘은 다들 늦잠이야."],
          ["detective", "", "가게 괘종시계는 멀쩡히 가는군요."],
          ["basil", "smile", "우리 건 할아버지 때부터 쓰던 태엽 시계라 전선 같은 건 안 달렸지. 매일 아침 내가 감는다네."],
          ["basil", "thinking", "아, 그러고 보니 어젯밤 자정 직전에 손님이 하나 왔었지. 외상값 갚으러 온 여자 손님이었어. 시청 사람은 아니었고."],
          ["basil", "neutral", "그 길로 사람 지나가는 건 내 가게 창으로 다 보이거든. 그 여자 말고는 아무도 안 지나갔어."],
        ],
        set: ["talked_basil"], give: ["E21"],
      },
    ],
    wo_isabel: [
      { when: ["got_E14"], lines: [["isabel", "worried", "열쇠로 자물쇠는 열었는데, 안쪽 빗장이 걸려 있어서 문이 안 열려요."]] },
      {
        lines: [
          ["isabel", "worried", "여기예요. 제 열쇠로 자물쇠는 풀었는데 문이 꿈쩍도 안 해요. 안쪽 빗장이 걸린 거예요."],
          ["isabel", "thinking", "열쇠는 선생님과 저만 가지고 있어요. 하지만 빗장은 안에서 손으로만 걸 수 있어요."],
          ["isabel", "thinking", "문 아래 우편 투입구로 고리를 넣어 빗장 레버를 밀면 열릴지도 몰라요. 안쪽엔 공구 상자들이 놓여 있어서 길을 터야 하지만요."],
        ],
        give: ["E14"],
      },
    ],
    ws_bolt: [{
      lines: [
        ["detective", "", "빗장은 문 안쪽의 무쇠 막대다. 바깥에서 걸거나 풀 장치는 없다."],
        ["detective", "", "억지로 비틀린 흔적도 없다. 누군가 이 방 안에서 직접 빗장을 걸었다."],
      ],
      give: ["E03"],
    }],
    ws_floor: [{
      lines: [
        ["detective", "", "검은 얼룩… 시계 기름이다. 쏟아진 기름병 옆에서 구두 자국이 시작된다."],
        ["detective", "", "발자국은 작업대에서 괘종시계 쪽으로 이어지다가, 벽 바로 앞에서 끊긴다."],
        ["isabel", "surprised", "이 크기… 선생님 구두예요. 굽에 박은 징 무늬가 똑같아요."],
      ],
      give: ["E07"],
    }],
    ws_clock: [
      { when: ["p05"], lines: [["detective", "", "괘종시계 뒤의 통로. 시계탑 방향이지만 저편이 막혀 있다."]] },
      { when: ["got_E22"], lines: [["detective", "", "진자 칸 유리의 작은 손자국. 이 칸을 여는 법을 아는 사람이 오스카 말고 또 있다."], ["detective", "", "(손자국 위의 먼지… 어젯밤 생긴 자국은 아니다.)"]] },
      { when: ["d1"], lines: [
        ["detective", "", "이 괘종시계… 진자 칸 안쪽에 톱니가 빠진 자리가 있다. 칸은 안쪽 걸쇠로 잠겨 있다. 여는 요령이 따로 있는 모양이다."],
        ["detective", "", "유리 안쪽에 작은 손자국이 하나 있다. 오스카의 손이 아니다."],
        ["detective", "", "(이상하다. 발자국 주변은 기름투성이인데, 이 손자국 위에는 **먼지가 얇게 앉아 있다**.)"],
      ], give: ["E22"], set: ["p05_ready"] },
      { lines: [["detective", "", "사람 키보다 큰 괘종시계다. 오스카의 작품인 듯 정교하다."], ["detective", "", "(진자가 멈춰 있다. 진자 칸 안에 톱니가 몇 개 빠진 자리가 보인다.)"]] },
    ],
    ws_isabel: [
      { when: ["isabel_clock"], not: ["twist1"], lines: [["isabel", "sad", "선생님과 약속했어요. 무슨 일이 생기기 전엔 아무에게도 말하지 않겠다고… 그래서 거짓말을 했어요."]] },
      { when: ["twist1"], lines: [["isabel", "thinking", "선생님은 스스로 나가셨군요… 그럼 누가, 왜 선생님을 탑으로 부른 걸까요? 여관이나 시청에 가 보면 알 수 있을지도 몰라요."]] },
      { when: ["got_E05"], lines: [["isabel", "sad", "'네 제자가 대가를 치른다'… 저 때문에 선생님이…"]] },
      { lines: [["isabel", "worried", "선생님 작업대예요. 회중시계가… 깨져 있어요. 선생님은 저 시계를 절대 놓고 다니지 않으세요."]] },
    ],
    lb_window: [{ lines: [["detective", "", "창밖으로 시계탑이 보인다. 이 서재는 마을 창건 때부터 있던 건물이라고 한다."]] }],
    in_veronica: [
      { when: ["p08"], lines: [["veronica", "embarrassed", "외상값 받으러 나간 건 부끄러워서 말 못 했던 거예요. 죄송해요."]] },
      {
        lines: [
          ["veronica", "smile", "어서 오세요, 은방울 여관이에요. 이자벨은 우리 2층에 하숙하죠. 어젯밤엔 11시쯤 들어와서 방 불을 밤새 켜 두더군요. 걱정이 많은 아이라."],
          ["detective", "", "어젯밤 식당에 루시앙 씨도 있었나요?"],
          ["veronica", "thinking", "네, 저녁 내내요. 11시 40분쯤 나갔어요. 마지막 손님들이 계산하던 때라 기억해요."],
          ["detective", "", "그 뒤엔 여관에 계셨고요?"],
          ["veronica", "nervous", "저, 저요? …뭐, 대충요. 자정 무렵엔 잠깐 자리를 비웠던 것 같기도 하고…"],
        ],
        give: ["E12"],
      },
    ],
    in_lucien: [
      { when: ["got_E11"], lines: [["lucien", "smile", "더 물을 게 있소? 난 바쁜 사람이오."]] },
      {
        lines: [
          ["lucien", "smile", "탐정이라고? 오스카 영감이 사라졌다지. 안됐군. 그 영감 시계는 정말 탐났는데."],
          ["detective", "", "어젯밤 여관을 나간 뒤 어디에 계셨습니까?"],
          ["lucien", "smile", "곧장 집에 갔소. 여관을 나와 광장 시계를 보니 12시 반이라 서둘렀지. 혼자 사니 증인은 없소만."],
          ["lucien", "suspicious", "의심하려면 시장부터 의심하시오. 시계탑을 헐겠다고 영감과 싸운 게 누군데."],
        ],
        give: ["E11"],
      },
    ],
    in_clock: [{ lines: [["detective", "", "식당 벽시계도 12시 00분. 이것도 시계탑에 연결된 자시계다."]] }],
    th_mayor: [
      { when: ["tower_key"], lines: [["mayor", "thinking", "탑 열쇠는 드렸소. 오스카를 꼭 찾아 주시오. …고집쟁이라도 이 마을의 시계공이니."]] },
      { when: ["talked_mayor"], lines: [["mayor", "angry", "나는 어젯밤 11시부터 1시까지 페넬로페와 회의 중이었소. 할 말은 다 했소."]] },
      {
        lines: [
          ["mayor", "suspicious", "탐정? 오스카 일이라면 나는 모르오. 그 고집쟁이가 탑을 못 헐게 마을 사람들을 선동한 건 사실이지만."],
          ["detective", "", "협박 편지가 시청 편지지에 쓰여 있었습니다."],
          ["mayor", "surprised", "뭐요? 그럴 리가… 어젯밤 11시부터 1시까지 나는 여기서 페넬로페와 철거 회의를 했소. 물어보시오."],
        ],
        set: ["talked_mayor"],
      },
    ],
    th_penelope: [
      { when: ["penelope_admit"], lines: [["penelope", "sad", "메모는 드린 그대로예요. …시장님께는 제가 직접 말씀드릴게요."]] },
      { when: ["talked_penelope"], lines: [["penelope", "nervous", "편지지 일이라면 정말 아무것도 몰라요. 재고는 매일 세는걸요."]] },
      {
        lines: [
          ["penelope", "neutral", "시장님은 어젯밤 회의 내내 제 앞에 계셨어요. 자정에 벽시계가 멈춰서 둘 다 놀랐죠."],
          ["detective", "", "시청 편지지는 누구나 쓸 수 있습니까?"],
          ["penelope", "nervous", "아뇨, 제 책상 서랍에만 있어요. 그리고 **한 장도 없어진 적 없어요.** 재고는 제가 매일 세거든요."],
          ["detective", "", "(대답이 너무 빠르다. 묻지도 않은 '재고' 이야기까지.)"],
        ],
        set: ["talked_penelope"],
      },
    ],
    th_desk: [
      { when: ["got_E24"], lines: [["detective", "", "재고표엔 50장. 상자는 비었다. 바닥에 눌어붙은 마지막 한 장만 남았다."]] },
      {
        lines: [
          ["detective", "", "비서의 책상. 서류가 각을 맞춰 쌓여 있다. 꼼꼼한 사람이다."],
          ["detective", "", "서랍 속 편지지 상자. 뚜껑의 재고표엔 단정한 글씨로 '10/23 · 50장'."],
          ["detective", "", "…그런데 상자 안은 **텅 비어 있다**. 바닥에 눌어붙은 한 장만 빼고."],
          ["detective", "", "(매일 재고를 센다는 사람이 50장이 사라진 걸 몰랐을 리 없다.)"],
        ],
        give: ["E24"],
      },
    ],
    th_plan: [{ lines: [["detective", "", "시계탑 철거와 새 시청 건설 계획서다. 귀퉁이에 '오스카 반대 서명 300명'이라는 메모."]], give: ["E13"] }],
    tb_ground: [
      { when: ["looked_tb_ground"], lines: [["detective", "", "가는 굽 자국 두 개가 문 앞에서 오래 머물렀다. 누군가 여기서 기다렸다."]] },
      {
        lines: [
          ["detective", "", "탑 뒤편의 좁은 자갈길. 밤새 내린 비로 땅이 젖어 있다."],
          ["detective", "", "문 앞 자갈 사이에 **가늘고 깊은 굽 자국**이 여러 번 겹쳐 찍혀 있다. 한자리에서 오래 서성인 흔적이다."],
          ["detective", "", "(그런데 문에서 멀어지는 자국은 없다. 기다리던 사람은 결국 이 문 안으로 들어갔다.)"],
        ],
        set: ["looked_tb_ground"],
      },
    ],
    tb_hook: [
      { when: ["saw_lantern"], lines: [
        ["detective", "", "벽에 박힌 쇠고리 아래 돌이 그을려 있다. 등불을 여기 걸어 두었던 것이다."],
        ["detective", "", "(베로니카가 빵집 가는 길에 본 '탑 아래 문 앞에 멈춰 있던 등불' — 바로 이 자리다. 그 시각은 자정 직전.)"],
      ], set: ["lantern_place"] },
      { lines: [["detective", "", "벽에 박힌 쇠고리. 아래쪽 돌이 새로 그을려 있다. 누군가 여기 등불을 걸어 두었다."], ["detective", "", "(이 시각에 이 자리에서 불빛을 본 사람이 있을지도 모른다.)"]] },
    ],
    tw_stairs: [{
      lines: [
        ["detective", "", "오랫동안 아무도 오르지 않은 계단에 먼지가 쌓여 있다. 그 위로 새 발자국이 두 줄."],
        ["detective", "", "하나는 징 박힌 오스카의 구두. 다른 하나는… 굽이 높고 가는 가죽 구두다."],
      ],
      give: ["E16"],
    }],
    tt_gears: [{ lines: [["detective", "", "탑의 톱니바퀴가 멈춰 있다. 누군가 마스터 시계를 정확히 자정에 멈춘 것이다."]] }],
    ug_oskar: [
      { when: ["c3"], lines: [["oskar", "angry", "내 일지에 남의 글을 끼워 넣다니. 시계공의 기록은 시계만큼 정확해야 하는 법이네."]] },
      { when: ["rescued"], lines: [["oskar", "smile", "창고 벽의 숫자는 내 시계 버릇대로 적었네. 종소리 가락은 높은 종부터 다섯, 셋, 넷, 둘, 하나라네."]] },
      {
        lines: [
          ["oskar", "tired", "…누군가 왔군. 이자벨은, 이자벨은 무사한가?"],
          ["detective", "", "무사합니다. 오스카 씨, 어젯밤 무슨 일이 있었습니까?"],
          ["oskar", "sad", "편지를 받았네. 자정에 시계를 멈추지 않으면 이자벨이 다친다고. 아이를 끌어들이기 싫어 문을 안에서 잠그고 통로로 왔지."],
          ["oskar", "thinking", "마스터 시계는 내 태엽 열쇠로 탈진기를 풀어야 멈춘다네. 억지로 세우면 톱니가 부서져 금고도 영영 열리지 않지. 그래서 그자는 나를 써야 했던 걸세."],
          ["oskar", "sad", "편지에 적힌 대로 탑 아래 문을 안쪽에서 열어 주었더니, 그자가 들어오더군. 탑 열쇠 없이 들어올 길은 그것뿐이었지."],
          ["oskar", "sad", "서두르다 회중시계를 떨어뜨렸어. 11시 47분이었지. 그리고 자정에 마스터 시계를 멈췄네."],
          ["oskar", "angry", "금고 첫 문이 열리자 그자가 둘째 문의 종소리 가락을 대라더군. 거절했더니 여기 가둬 버렸지."],
          ["oskar", "thinking", "그자의 얼굴은 어두워 못 봤네. 다만 굽 높은 구두 소리가 계단에 울렸지."],
          ["oskar", "thinking", "갇혀 있는 동안 그날 밤 일을 적어 두었네. 그자가 볼까 봐 내 방식으로 숨겨 놓았지. 창고 벽을 보게."],
          ["oskar", "smile", "종소리 가락은 높은 종부터 다섯, 셋, 넷, 둘, 하나. 금고에 무엇이 있는지, 자네가 직접 보게."],
        ],
        set: ["rescued"],
      },
    ],
  },

  // ---------- 퍼즐 ----------
  // public: 클라이언트에 보내는 문제 데이터 / solution: 서버 전용
  puzzles: {
    P01: {
      title: "끊어진 시계 배선", type: "circuit", difficulty: 2,
      desc: "배전함의 배선판이 뒤틀려 있다. 타일을 돌려 시계탑 단자(⚡)에서 네 자시계 단자(시청·여관·약국·성당)까지 전선을 모두 이어라.",
      hints: ["단자 타일(⚡·시계 그림)은 돌릴 수 없다. 단자가 향한 방향부터 거꾸로 따라가 보자.", "가운데 줄이 '척추'다. 탑에서 오른쪽으로 곧게 뻗는 길을 먼저 만들어라.", "약국은 가운데 위, 시청·성당은 오른쪽 끝 위아래, 여관은 왼쪽 아래다. 오른쪽 끝 가운데 타일은 ㅓ 모양이어야 한다."],
      public: {
        size: 5,
        // 타일 기본 모양 비트마스크(N1 E2 S4 W8), 초기 회전(시계방향 90° 횟수), fixed=단자
        tiles: [
          [{ m: 6, r: 1 }, { m: 5, r: 0 }, { m: 4, r: 0, fixed: true, term: "약국" }, { m: 3, r: 2 }, { m: 4, r: 0, fixed: true, term: "시청" }],
          [{ m: 5, r: 1 }, { m: 14, r: 2 }, { m: 5, r: 1 }, { m: 9, r: 1 }, { m: 5, r: 1 }],
          [{ m: 2, r: 0, fixed: true, term: "탑" }, { m: 14, r: 1 }, { m: 11, r: 2 }, { m: 10, r: 1 }, { m: 13, r: 3 }],
          [{ m: 12, r: 0 }, { m: 5, r: 1 }, { m: 10, r: 0 }, { m: 7, r: 2 }, { m: 5, r: 0 }],
          [{ m: 5, r: 1 }, { m: 1, r: 0, fixed: true, term: "여관" }, { m: 9, r: 3 }, { m: 10, r: 0 }, { m: 1, r: 0, fixed: true, term: "성당" }],
        ],
      },
      solution: { source: [2, 0], targets: [[0, 2], [0, 4], [4, 1], [4, 4]] },
      onSolve: {
        give: ["E02"], set: ["p01"],
        lines: [
          ["detective", "", "전선이 이어지자 배선판 뒤 도면이 드러났다."],
          ["detective", "", "마을의 공공 시계는 전부 시계탑 마스터 시계의 신호로 움직인다. 탑이 멈추면… 마을의 시간이 멈춘다."],
          ["isabel", "surprised", "그럼 어젯밤 누군가 탑의 마스터 시계를 멈췄다는 거예요?"],
        ],
      },
    },
    P02: {
      title: "안쪽에서 잠긴 문", type: "slide", difficulty: 3,
      desc: "우편 투입구로 넣은 고리(금색)를 오른쪽 빗장 레버까지 밀어 보내라. 공구 상자는 긴 방향으로만 움직인다.",
      hints: ["고리 앞을 막은 세로 상자를 아래로 내려야 한다. 그러려면 아래쪽 가로 상자가 비켜야 한다.", "아래쪽 가로 상자를 오른쪽으로 보내려면 오른쪽 세로 상자를 먼저 위로 올려라.", "순서: 오른쪽 세로 상자 ↑ → 아래 가로 상자 → → 가운데 세로 상자 ↓ → 위 가로 상자 ← → 오른쪽 세로 상자 ↑ → 고리 →"],
      public: {
        w: 6, h: 6, exitRow: 2, target: "hook",
        pieces: [
          { id: "hook", r: 2, c: 0, len: 2, dir: "h" },
          { id: "a", r: 0, c: 2, len: 3, dir: "v" },
          { id: "b", r: 4, c: 0, len: 3, dir: "h" },
          { id: "c", r: 3, c: 4, len: 2, dir: "v" },
          { id: "d", r: 0, c: 3, len: 3, dir: "h" },
          { id: "e", r: 0, c: 0, len: 2, dir: "v" },
          { id: "f", r: 5, c: 3, len: 2, dir: "h" },
        ],
      },
      solution: {},
      onSolve: {
        set: ["p02"],
        lines: [
          ["narrator", "", "철컥. 고리가 빗장 레버를 밀어 올리자 문이 천천히 열렸다."],
          ["isabel", "worried", "선생님…? …아무도 없어요."],
          ["detective", "", "(문을 부수지 않고 열었다. 빗장이 안쪽에서 걸려 있었다는 사실을 그대로 확인할 수 있다.)"],
        ],
      },
    },
    P03: {
      title: "깨진 회중시계", type: "jigsaw", difficulty: 2,
      desc: "열두 조각으로 깨진 회중시계 문자판. 조각을 제자리에 놓고, 눌러서 방향을 맞춰라.",
      hints: ["숫자는 둘레를 따라 시계 방향으로 이어진다. 12는 맨 윗줄 가운데 두 칸 중 하나, 6은 맨 아랫줄 가운데다.", "바늘이 지나가는 가운데 줄 조각끼리는 바늘 선이 끊기지 않아야 한다. 유리에 간 금도 이어져야 한다.", "시침은 거의 12, 분침은 9를 조금 지난 곳. 가운데 줄 왼쪽 두 칸에 분침이 걸쳐 있다."],
      public: { cols: 4, rows: 3, initRot: [1, 0, 3, 2, 0, 1, 2, 3, 1, 0, 2, 1], order: [7, 2, 10, 0, 5, 11, 3, 8, 1, 6, 9, 4] },
      solution: {},
      onSolve: {
        give: ["E04"], set: ["p03"],
        lines: [
          ["detective", "", "문자판이 맞춰졌다. 바늘은 11시 47분에 멈춰 있다."],
          ["detective", "", "(마을 시계가 멈춘 자정보다 13분 이르다. 그리고 이건 태엽식이라 시계탑과 상관없이 멈췄다.)"],
          ["isabel", "thinking", "11시 47분이면… 제가 돌아가고 한참 뒤예요. 그때까지 선생님은 여기 계셨던 거예요."],
        ],
      },
    },
    P04: {
      title: "정체불명의 편지", type: "cipher", difficulty: 3, split: "cipher",
      desc: "편지의 추신은 숫자뿐이다. 작업대의 해독 원판(문자판 둘레에 글자 12개)을 쓰면 읽을 수 있을 것 같다. 편지 첫 줄엔 '이 편지의 바늘은 모두 세 시간 늦게 간다'고 적혀 있다.",
      hints: ["숫자 하나가 원판의 숫자 칸 하나다. 원판의 글자를 그대로 읽으면 말이 안 된다.", "'세 시간 늦게 간다' = 적힌 숫자는 진짜보다 3이 크다. 숫자에서 3을 빼라.", "첫 숫자 4 → 1 → '탑'. 나머지도 같은 방식으로. 답은 아홉 글자다."],
      public: {
        disc: ["탑", "아", "래", "에", "서", "기", "다", "린", "종", "문", "밤", "별"],
        body: "자정에 마스터 시계를 멈춰라.\n그러지 않으면 네 제자가 대가를 치른다.",
        cipher: [4, 5, 6, 7, 8, 9, 10, 11, 10],
        stamp: "시청 문장", header: "이 편지의 바늘은 모두 세 시간 늦게 간다.",
      },
      wrongMsg: "말이 되지 않는다. 원판의 숫자를 그대로 읽은 건 아닌지, 편지 첫 줄의 '바늘' 이야기를 다시 읽어 보자.",
      solution: { answers: ["탑아래에서기다린다"] },
      onSolve: {
        give: ["E05", "E06"], set: ["p04"],
        lines: [
          ["detective", "", "추신은 '탑 아래에서 기다린다'."],
          ["detective", "", "그리고 이 편지지… 귀퉁이에 시청 문장이 찍혀 있다."],
          ["isabel", "surprised", "시청이라면… 시계탑을 헐겠다는 홀름 시장님?"],
        ],
      },
    },
    P05: {
      title: "괘종시계의 톱니", type: "gears", difficulty: 4,
      desc: "진자 칸의 구동 톱니(왼쪽)는 시계 방향으로 돈다. 빈 축에 톱니를 끼워 오른쪽 아래 자물쇠 톱니까지 힘을 전하라. 자물쇠는 반시계 방향으로 돌아야 풀린다. 톱니는 이가 정확히 맞물릴 때만 돈다.",
      hints: ["맞물린 두 톱니는 서로 반대 방향으로 돈다. 자물쇠까지 몇 개를 거쳐야 반시계가 될지 세어 보자.", "두 축 사이 거리가 두 톱니 반지름의 합과 같아야 맞물린다.", "구동 톱니 바로 옆 축엔 가장 큰 쪽, 그 아래 축엔 가장 작은 톱니."],
      public: {
        driver: { x: 0, y: 0, r: 30 },
        lock: { x: 120, y: 60, r: 30 },
        pegs: [{ id: "A", x: 70, y: 0 }, { id: "B", x: 70, y: 60 }, { id: "C", x: 130, y: 0 }, { id: "D", x: 0, y: 80 }],
        gears: [{ id: "g20", r: 20 }, { id: "g40", r: 40 }, { id: "g50", r: 50 }],
        lockDir: -1,
      },
      solution: {},
      requires: ["d1", "isabel_clock"],
      onSolve: {
        give: ["E08"], set: ["p05", "twist1"],
        lines: [
          ["narrator", "", "자물쇠 톱니가 반시계로 돌자, 괘종시계 전체가 문처럼 옆으로 밀려났다."],
          ["isabel", "surprised", "이건… 통로? 선생님이 이런 걸 숨기고 계셨다니."],
          ["detective", "", "밀실이 아니었다. 오스카는 납치된 게 아니라 — **스스로 빗장을 걸고, 이 길로 나간 것이다.**"],
          ["detective", "", "통로는 시계탑 쪽으로 이어지지만 저편이 막혀 있다. 누군가 탑 쪽에서 막았다."],
          ["detective", "", "(협박 편지를 쓴 자를 찾아야 한다. 서재와 여관, 시청을 조사하자.)"],
        ],
      },
    },
    P06: {
      title: "흩어진 대출 카드", type: "order", difficulty: 2,
      desc: "누군가 대출 카드를 흩뜨려 놓았다. 날짜가 이른 순서대로 위에서부터 늘어놓아라. 표기 방식이 제각각이다.",
      hints: ["'시월 열닷새'는 10월 15일이다.", "점(.)과 빗금(/) 표기는 모두 '월.일'이다.", "가장 마지막 카드의 대출자를 보라."],
      public: {
        label: "대출 카드 (위가 가장 이른 날짜)",
        items: [
          { id: "c4", text: "10/20 · 『에셀 창건기』 · L." },
          { id: "c2", text: "10월 8일 · 『시계 수리 입문』 · 이자벨" },
          { id: "c6", text: "10월 17일 · 『별자리 이야기』 · P." },
          { id: "c1", text: "10.03 · 『마을 연보』 · B." },
          { id: "c3", text: "시월 열닷새 · 『약초 도감』 · V." },
          { id: "c5", text: "10.11 · 『탑의 역사』 · 홀름" },
        ],
      },
      solution: { order: ["c1", "c2", "c5", "c3", "c6", "c4"] },
      onSolve: {
        give: ["E09"], set: ["p06"],
        lines: [
          ["detective", "", "가장 최근은 10월 20일, 『에셀 창건기』. 대출자 서명은 'L.' 한 글자."],
          ["detective", "", "(누군가 마을의 창건 기록을 뒤졌다. 그리고 그걸 숨기려고 카드를 흩뜨렸다.)"],
        ],
      },
    },
    P07: {
      title: "창건자의 책장", type: "number", difficulty: 2,
      desc: "책장 맨 윗단의 책등에 시각이 하나씩 금박으로 찍혀 있다. 빈자리에 들어갈 책의 시각을 맞추면 숨은 칸이 열린다.\n12:00 · 1:05 · 2:10 · 3:15 · ? · 5:25",
      hints: ["시침이 한 칸 갈 때 분침은 어떻게 변하는가?", "분침은 늘 시침이 가리키는 숫자 × 5분이다.", "3:15 다음, 5:25 앞."],
      public: { format: "time" },
      solution: { answers: ["420"] },
      onSolve: {
        give: ["E10"], set: ["p07"],
        lines: [
          ["narrator", "", "'4:20' 책을 꽂자 책장 뒤 판자가 열리고 누렇게 바랜 도면이 나왔다."],
          ["detective", "", "시계탑 지하의 금고 도면이다. '마스터 시계가 자정에 멈출 때 첫 문이 열리고, 둘째 문은 시계공의 종소리로 열린다.'"],
          ["detective", "", "구석에 작은 글씨. '지하로 가는 문: 시침은 창건의 달을, 분침은 창건의 날을 가리킬 것.'"],
        ],
      },
    },
    P08: {
      title: "그날 밤의 알리바이", type: "grid", difficulty: 3, split: "clues",
      desc: "11시 45분부터 12시 30분까지, 네 사람은 각각 어디 있었을까? 모은 증언을 바탕으로 한 사람에 한 곳씩 정하라. '증인 없음'은 그 시간 누구도 그를 보지 못했다는 뜻이다.",
      hints: ["시장의 회의는 비서가 증언했다.", "빵집에 온 손님은 '시청 사람이 아닌 여자'였다. 여자는 두 사람. 그중 한 명은 밤새 방 불이 켜져 있었다.", "자정 무렵 자리를 비운 사람과 빵집 손님은 같은 사람이다."],
      public: {
        rows: [{ id: "isabel", name: "이자벨" }, { id: "mayor", name: "홀름 시장" }, { id: "veronica", name: "베로니카" }, { id: "lucien", name: "루시앙" }],
        cols: [{ id: "inn", name: "여관 2층" }, { id: "hall", name: "시청" }, { id: "bakery", name: "빵집" }, { id: "none", name: "증인 없음" }],
        clues: [
          "페넬로페: \"시장님은 회의 내내 제 앞에 계셨어요.\"",
          "바실: \"자정 직전에 외상값 갚으러 온 여자 손님이 있었지. 시청 사람은 아니었어.\"",
          "베로니카: \"이자벨은 11시쯤 들어와서 밤새 방 불을 켜 두었어요.\"",
          "베로니카 (심문 후): \"11시 45분쯤 나가서 12시 20분쯤 돌아왔어요.\"",
          "루시앙: \"혼자 사니 증인은 없소.\"",
        ],
      },
      solution: { map: { isabel: "inn", mayor: "hall", veronica: "bakery", lucien: "none" } },
      onSolve: {
        set: ["p08"],
        lines: [
          ["detective", "", "베로니카는 빵집에 외상값을 갚으러 갔다. 숨긴 건 그 부끄러움뿐이었다."],
          ["detective", "", "그 시간 누구도 보지 못한 사람은 단 한 명 — 루시앙."],
        ],
      },
    },
    P09: {
      title: "증언의 모순", type: "contradiction", difficulty: 4,
      desc: "루시앙의 진술 가운데 사실과 맞지 않는 말을 고르고, 그것을 깨뜨릴 증거를 제시하라.",
      hints: ["시간에 관한 말을 의심하라.", "어젯밤 자정 이후 광장 시계는 어떤 상태였는가?", "광장 시계는 12시 00분에 멈춰 있었다."],
      public: {
        speaker: "lucien",
        statements: [
          { id: "s1", text: "어젯밤엔 저녁 내내 여관 식당에 있었소." },
          { id: "s2", text: "11시 40분쯤 여관을 나왔소." },
          { id: "s3", text: "광장 시계를 보니 12시 반이라 서둘러 집에 갔지." },
          { id: "s4", text: "시계탑을 헐자는 시장과 영감은 늘 싸웠소." },
        ],
      },
      solution: { statement: "s3", evidence: ["E01"] },
      requires: ["d3", "p08"], viaInterrogation: "lucien",
      onSolve: {
        set: ["p09", "lucien_fled", "twist2"],
        lines: [
          ["detective", "", "광장 시계는 어젯밤 12시 00분에 멈췄습니다. 지금도요. **'12시 반'을 가리킨 적은 한 번도 없습니다.**"],
          ["lucien", "embarrassed", "…그, 그건 내 회중시계를 봤다는 말이었소."],
          ["detective", "", "방금 '광장 시계'라고 하셨죠. 그리고 여관을 나선 11시 40분부터 아무도 당신을 보지 못했습니다."],
          ["lucien", "angry", "……!"],
          ["narrator", "", "루시앙이 의자를 걷어차고 식당을 뛰쳐나갔다. 굽 높은 구두 소리가 광장 쪽으로 멀어진다."],
          ["veronica", "surprised", "시계탑 쪽이에요! 루시앙 씨가 시계탑으로 뛰어갔어요!"],
        ],
      },
    },
    P10: {
      title: "추 승강대", type: "weights", difficulty: 5,
      desc: "기계실로 올라가는 승강대는 무쇠 추 여덟 개로 균형을 잡는다. 그런데 추가 아홉 개다. 하나는 속이 빈 가짜라 조금 가볍다. 천칭은 정확히 두 번 쓸 수 있고, 두 번을 다 쓴 뒤에 가짜를 지목할 수 있다.",
      hints: ["아홉 개를 세 묶음으로 나눠 보자.", "첫 번째 저울질로 가짜가 어느 세 개 안에 있는지 알 수 있다.", "남은 세 개 중 두 개를 올려라. 기울지 않으면 남은 하나다."],
      public: { count: 9, maxWeighs: 2 },
      solution: {},
      onSolve: {
        set: ["p10"],
        lines: [
          ["narrator", "", "가짜 추를 빼자 승강대가 덜컹 소리를 내며 위로 올라가기 시작했다."],
          ["detective", "", "(가짜 추는 최근에 바꿔 놓은 것 같다. 누군가 뒤따라오는 사람을 막으려 했다.)"],
        ],
      },
    },
    P11: {
      title: "마스터 시계", type: "clock", difficulty: 2,
      desc: "멈춘 마스터 시계의 바늘을 직접 돌릴 수 있다. 도면의 구석 글씨를 떠올려라. '시침은 창건의 달을, 분침은 창건의 날을 가리킬 것.'",
      hints: ["창건일은 광장 동판에 있다.", "1847년 3월 15일. 달은 3, 날은 15.", "시침을 3에, 분침은 15분(숫자 3 자리)에."],
      public: {},
      solution: { h: 3, m: 15 },
      onSolve: {
        set: ["p11"],
        lines: [
          ["narrator", "", "바늘이 3시 15분에 닿자, 기계실 바닥의 쇠문이 무겁게 열렸다. 차가운 바람이 올라온다."],
          ["detective", "", "(1847년 3월 15일 — 마을의 생일이 지하로 가는 열쇠였다.)"],
        ],
      },
    },
    P12: {
      title: "등불과 거울", type: "mirror", difficulty: 3,
      desc: "어두운 지하. 창고 문의 감지판(★)에 등불 빛이 닿으면 문이 열린다. 거울을 눌러 방향을 바꿔라.",
      hints: ["빛은 거울에서 직각으로 꺾인다.", "곧장 가면 벽에 막힌다. 위로 꺾어야 한다.", "등불 줄의 세 번째 칸 거울을 '/'로, 맨 윗줄 같은 열 거울도 '/'로."],
      public: {
        w: 6, h: 6,
        source: { r: 2, c: -1, dir: "E" },
        target: { r: 0, c: 5 },
        walls: [[2, 5], [3, 0], [4, 2], [1, 1]],
        mirrors: [{ r: 2, c: 2, s: "\\" }, { r: 0, c: 2, s: "\\" }, { r: 4, c: 4, s: "/" }, { r: 1, c: 4, s: "/" }, { r: 3, c: 2, s: "/" }],
      },
      solution: {},
      onSolve: {
        set: ["p12"],
        lines: [
          ["narrator", "", "빛이 감지판에 닿자 창고 문이 열렸다. 안쪽 어둠 속에서 누군가 몸을 일으킨다."],
          ["oskar", "tired", "…거기 누군가?"],
        ],
      },
    },
    S1: {
      title: "작업대의 잠긴 서랍", type: "lock", difficulty: 2, optional: true,
      desc: "작업대 서랍에 숫자 다이얼 네 개짜리 자물쇠. 옆에 오스카의 쪽지가 붙어 있다. '빨간 점의 시계들이 순서를 안다. 시침만 읽을 것.'",
      hints: ["선반 위 작은 시계들 중 위에 빨간 점이 찍힌 것만 보자.", "빨간 점 시계는 네 개. 왼쪽부터 시침이 가리키는 숫자를 읽는다.", "다섯 시, 세 시, 여덟 시, 한 시."],
      public: { dials: 4, clocks: [{ h: 12, m: 0, dot: false }, { h: 5, m: 17, dot: true }, { h: 10, m: 34, dot: false }, { h: 3, m: 51, dot: true }, { h: 8, m: 8, dot: true }, { h: 1, m: 25, dot: true }] },
      solution: { code: [5, 3, 8, 1] },
      onSolve: {
        give: ["E18"], set: ["s1"],
        lines: [
          ["narrator", "", "딸깍. 서랍 안에서 손때 묻은 작업 일지가 나왔다."],
          ["detective", "", "10월 21일 — 'L.이 또 찾아와 탑 아래 금고 이야기를 캐물었다.' 10월 28일 — '편지가 왔다. 이자벨만은 지킨다.'"],
          ["isabel", "sad", "선생님…"],
        ],
      },
    },
    S2: {
      title: "기계실의 흩어진 부품", type: "hidden", difficulty: 3, optional: true,
      desc: "기계실 바닥에 부품이 어지럽게 흩어져 있다. 이곳에 있으면 안 되는 물건 다섯 개를 찾아라. 아무 데나 누르면 잠시 눈이 침침해진다.",
      hints: ["시계 부품이 아닌 것을 찾자. 사람이 떨어뜨린 물건이다.", "색이 다른 단추, 구두에서 떨어진 것, 종이 조각을 찾아보자.", "보라색 단추는 위쪽 가운데, 구두 굽은 오른쪽 아래, 편지지 조각은 왼쪽 위."],
      public: {
        w: 1000, h: 600,
        targets: [{ id: "key", name: "태엽 열쇠" }, { id: "heel", name: "부러진 구두 굽" }, { id: "button", name: "보라색 단추" }, { id: "oil", name: "기름병" }, { id: "paper", name: "시청 편지지 조각" }],
        // 그림 목록 (정답 여부는 서버만 안다)
        objects: [
          { k: "gear", x: 90, y: 90, s: 46, c: "#a7824a" }, { k: "gear", x: 460, y: 420, s: 60, c: "#8a6d3b" }, { k: "gear", x: 640, y: 120, s: 38, c: "#c9a96e" },
          { k: "gear", x: 910, y: 480, s: 52, c: "#a7824a" }, { k: "gear", x: 260, y: 520, s: 30, c: "#c9a96e" }, { k: "gear", x: 780, y: 330, s: 34, c: "#8a6d3b" },
          { k: "bolt", x: 150, y: 260, s: 26, c: "#7a7a80" }, { k: "bolt", x: 560, y: 300, s: 22, c: "#7a7a80" }, { k: "bolt", x: 840, y: 150, s: 24, c: "#6a6a70" }, { k: "bolt", x: 380, y: 260, s: 20, c: "#7a7a80" },
          { k: "spring", x: 260, y: 330, s: 30, c: "#9a9aa0" }, { k: "spring", x: 690, y: 420, s: 28, c: "#9a9aa0" }, { k: "spring", x: 950, y: 90, s: 26, c: "#9a9aa0" },
          { k: "button", x: 420, y: 520, s: 20, c: "#6a4a30" }, { k: "button", x: 600, y: 560, s: 18, c: "#3a3a40" }, { k: "button", x: 80, y: 400, s: 18, c: "#6a4a30" },
          { k: "block", x: 560, y: 60, s: 40, c: "#5a4030" }, { k: "block", x: 50, y: 540, s: 46, c: "#4a3322" }, { k: "block", x: 990, y: 330, s: 36, c: "#5a4030" },
          { k: "key", x: 180, y: 420, s: 34, c: "#d8b878" }, { k: "heel", x: 720, y: 500, s: 32, c: "#141016" }, { k: "button", x: 520, y: 180, s: 22, c: "#6a3a7a" },
          { k: "oil", x: 880, y: 260, s: 34, c: "#3a5a4a" }, { k: "paper", x: 330, y: 140, s: 40, c: "#efe3c8" },
        ],
      },
      solution: { targets: { key: [180, 420, 40], heel: [720, 500, 40], button: [520, 180, 30], oil: [880, 260, 40], paper: [330, 140, 44] } },
      onSolve: {
        give: ["E19"], set: ["s2"],
        lines: [
          ["detective", "", "구두 굽, 시청 편지지 조각, 그리고 보라색 단추… 이 단추는 **루시앙의 보라색 코트**와 같다."],
          ["detective", "", "(그날 밤 이 기계실에 오스카 말고 누군가 또 있었다.)"],
        ],
      },
    },
    S3: {
      title: "루시앙의 동선", type: "path", difficulty: 4, optional: true, split: "map",
      desc: "11시 40분, 루시앙은 여관을 나섰다. 빵집 앞(B)을 지났다면 바실이, 회의로 불이 켜진 시청 앞(H)을 지났다면 비서가 봤을 것이다. 한 칸은 1분. 11시 50분까지 시계탑 아래 문(T)에 닿는 길을 여관(S)에서부터 그려라.",
      hints: ["B와 H 칸은 밟으면 안 된다. 그리고 10칸 안에 닿아야 한다.", "아래로 크게 돌아가면 너무 오래 걸린다. 위쪽 길로 오른쪽으로 먼저 가 보자.", "오른쪽으로 두 칸 → 아래로 두 칸 → 오른쪽 두 칸 → 아래로 두 칸 → 오른쪽 두 칸."],
      public: {
        grid: [
          "#########",
          "#S..#...#",
          "#.#.#.#.#",
          "#.B...H.#",
          "#.#.#.#.#",
          "#...#..T#",
          "#########",
        ],
        maxSteps: 10, startTime: "23:40",
      },
      solution: {},
      requires: ["got_E12"],
      onSolve: {
        give: ["E20"], set: ["s3"],
        lines: [
          ["detective", "", "누구에게도 들키지 않는 길은 이것 하나. 11시 40분에 여관을 나선 사람은 **11시 50분에 탑 아래 문**에 닿는다."],
          ["detective", "", "(오스카가 탑 아래 문을 열어 준 건 자정 직전. 시간이 딱 맞는다.)"],
        ],
      },
    },
    T1: {
      title: "멈춘 크랭크", type: "gears", difficulty: 3,
      desc: "탑 아래 문은 손잡이를 돌려 빗장을 올리는 크랭크 장치다. 누군가 톱니 몇 개를 빼 갔다. 남은 톱니를 빈 축에 끼워 손잡이(구동)의 힘을 빗장 톱니까지 전하라. 빗장 톱니는 시계 방향으로 돌아야 올라간다.",
      hints: ["맞물린 톱니는 서로 반대로 돈다. 빗장 톱니가 구동 톱니와 같은 방향(시계 방향)이 되려면 사이에 톱니가 홀수 개 있어야 한다.", "축 사이 거리가 두 반지름의 합과 같아야 맞물린다. 구동 톱니 바로 옆 A 축까지는 60 — 구동 반지름은 25.", "A에 반지름 35, B에 20, C에 15. D·E 축은 쓰지 않아도 된다."],
      public: {
        driver: { x: 0, y: 0, r: 25, label: "손잡이" },
        lock: { x: 95, y: 95, r: 25, label: "빗장" },
        pegs: [{ id: "A", x: 60, y: 0 }, { id: "B", x: 60, y: 55 }, { id: "C", x: 95, y: 55 }, { id: "D", x: 0, y: 75 }, { id: "E", x: 135, y: 20 }],
        gears: [{ id: "g15", r: 15 }, { id: "g20", r: 20 }, { id: "g30", r: 30 }, { id: "g35", r: 35 }, { id: "g45", r: 45 }],
        lockDir: 1,
      },
      solution: {},
      requires: ["tower_open"],
      onSolve: {
        give: ["E25"], set: ["t1"],
        lines: [
          ["narrator", "", "손잡이가 돌자 빗장이 덜컹 올라가고, 무거운 문이 안쪽으로 열렸다."],
          ["detective", "", "빗장 손잡이에 시계 기름이 묻어 있다. 아직 끈적하다. 작업실 바닥의 기름과 같은 냄새."],
          ["detective", "", "(이 문은 안에서만 열린다. 그리고 어젯밤, **기름 묻은 손이 안에서 이 문을 열었다**.)"],
        ],
      },
    },
    T2: {
      title: "철문의 문장", type: "rings", difficulty: 3,
      desc: "승강대 앞을 막은 철문에 겹친 원판 네 개. 탑의 문장(◆)이 맨 위 표시선에 한 줄로 서면 문이 열린다. 원판 하나를 돌리면 바로 안쪽 원판도 한 칸 함께 돈다.",
      hints: ["바깥 원판은 다른 원판을 돌려도 움직이지 않는다. 바깥부터 맞추자.", "하나를 맞춘 뒤에는 그 원판을 다시 건드리지 말고, 그다음 안쪽 원판만 돌려라.", "바깥 6번, 둘째 4번, 셋째 1번, 안쪽 2번."],
      public: { rings: 4, steps: 8, init: [2, 6, 3, 5], symbol: "◆" },
      wrongMsg: "문장이 아직 한 줄로 서지 않았다. 바깥 원판부터 차례로 맞춰 보자.",
      solution: {},
      onSolve: {
        set: ["t2"],
        lines: [
          ["narrator", "", "문장 네 개가 한 줄로 서자 철문이 옆으로 미끄러졌다."],
          ["detective", "", "원판에 손때가 묻은 건 바깥 두 개뿐이다. 안쪽 원판은 먼지 그대로."],
          ["detective", "", "(이 문을 연 사람은 순서를 알고 있었다. 이리저리 돌려 본 게 아니라 — 정확히 필요한 만큼만 돌렸다.)"],
        ],
      },
    },
    C1: {
      title: "마지막 기록 ① 벽의 숫자", type: "cipher", difficulty: 3,
      desc: "창고 벽에 못으로 긁은 숫자들. 오스카가 갇혀 있는 동안 남긴 표시다. 옆에 작은 원판이 그려져 있다. 오스카: '내 시계 버릇대로 적었네.'",
      hints: ["숫자 위에 적힌 말을 보라. 느린 시계는 진짜 시각보다 작은 숫자를 가리킨다.", "적힌 숫자에 5를 더해 읽어라. 12를 넘으면 12를 뺀다. 안쪽 숫자판을 다섯 칸 돌리면 한눈에 보인다.", "9 → 2 → '일'. 여섯 글자다."],
      public: {
        disc: ["밤", "일", "별", "지", "탑", "는", "문", "종", "달", "뒤", "빛", "에"],
        header: "이 기록의 시계는 다섯 시간 느리게 간다.",
        body: "(못으로 긁은 자국. 서두른 글씨다.)",
        cipher: [9, 11, 1, 3, 5, 7],
        stamp: "O.",
      },
      wrongMsg: "말이 되지 않는다. '다섯 시간 느리다'는 건 적힌 숫자가 진짜보다 크다는 걸까, 작다는 걸까?",
      solution: { answers: ["일지는종뒤에"] },
      requires: ["rescued"],
      onSolve: {
        set: ["c1"],
        lines: [
          ["detective", "", "'일지는 종 뒤에.' 금고 문 위의 종들 — 그 옆 벽에 틈이 있다."],
          ["oskar", "smile", "역시 시계로 말하면 알아듣는군."],
        ],
      },
    },
    C2: {
      title: "마지막 기록 ② 찢어진 일지", type: "order", difficulty: 3,
      desc: "벽 틈에서 연필로 쓴 일지 여섯 장이 나왔다. 시각 표기가 제각각이다. 그날 밤 일어난 순서대로 위에서부터 늘어놓아라.",
      hints: ["밤 11시대 → 자정 → 자정 이후 순서다. '0시'는 자정 다음이다.", "'자정 5분 전'은 12:00보다 앞이다. '열한 시 사십칠 분'은 23:47이다.", "11:00 → 23:30 → 23:47 → 23:55 → 12:00 → 0:10."],
      public: {
        label: "일지 (위가 가장 이른 시각)",
        items: [
          { id: "o4", text: "자정 5분 전 — 탑 아래 문을 안에서 열었다. 굽 높은 구두 소리." },
          { id: "o1", text: "열한 시 정각 — 이자벨을 여관으로 돌려보냈다. 아이가 눈치채지 않게." },
          { id: "o6", text: "0시 10분 — 둘째 문의 가락을 대라는 걸 거절했다. 창고 문이 닫혔다." },
          { id: "o3", text: "열한 시 사십칠 분 — 서두르다 회중시계를 떨어뜨렸다. 빗장을 걸고 통로로." },
          { id: "o5", text: "12:00 — 태엽 열쇠로 탈진기를 풀었다. 마을이 조용해졌다." },
          { id: "o2", text: "23:30 — 편지를 다시 읽었다. 이자벨만은 지킨다." },
        ],
      },
      solution: { order: ["o1", "o2", "o3", "o4", "o5", "o6"] },
      requires: ["c1"],
      onSolve: {
        set: ["c2"],
        lines: [
          ["detective", "", "여섯 장이 이어진다. 그날 밤 오스카의 한 시간."],
          ["detective", "", "…그런데 틈 안쪽에 **한 장이 더** 있다. 연필이 아니라 잉크 글씨다."],
          ["oskar", "suspicious", "그런 걸 쓴 기억은 없네만."],
        ],
      },
    },
    C3: {
      title: "마지막 기록 ③ 끼워 넣은 한 장", type: "contradiction", difficulty: 4,
      desc: "일지 사이에 끼워진 한 장. 오스카의 글씨를 흉내 냈다. 적힌 문장 가운데 그날 밤의 사실과 맞지 않는 문장을 고르고, 그것을 깨뜨릴 증거를 제시하라.",
      hints: ["다른 장들은 오스카가 그날 밤 직접 겪은 일이다. 이 장은 누가, 누구에게 무엇을 믿게 하려고 썼을까?", "탑 아래 문은 안쪽에서만 열린다. 그 문에 남은 흔적을 떠올려라.", "'문은 한 번도 열리지 않았다'를 고르고, 탑 아래 문의 빗장을 내밀어라."],
      public: {
        speaker: "oskar",
        statements: [
          { id: "s1", text: "10월 21일 — L.이 또 찾아와 탑 아래 금고 이야기를 캐물었다." },
          { id: "s2", text: "10월 28일 — 편지가 왔다. 이자벨만은 지킨다." },
          { id: "s3", text: "그날 밤 탑 아래 문은 한 번도 열리지 않았다. 탑에 드나들 수 있는 건 열쇠를 가진 시장뿐이었다." },
          { id: "s4", text: "자정 — 태엽 열쇠로 마스터 시계를 멈췄다." },
        ],
      },
      solution: { statement: "s3", evidence: ["E25"] },
      requires: ["c2"],
      onSolve: {
        give: ["E26"], set: ["c3"],
        lines: [
          ["detective", "", "탑 아래 문은 어젯밤 안에서 열렸습니다. 빗장에 오스카 씨의 기름이 남아 있었죠. '한 번도 열리지 않았다'는 건 오스카 씨가 쓸 수 없는 문장입니다."],
          ["detective", "", "그리고 이 종이… 빛에 비추면 **시청 문장**이 보입니다. 오스카 씨의 일지는 전부 작업실 공책 종이인데."],
          ["oskar", "angry", "비서 책상에서 사라졌다는 그 편지지로군. 협박장과 같은 종이야."],
          ["detective", "", "(협박장도, 이 가짜 일지도 같은 손이 썼다. 누군가 끝까지 '시장만 탑에 들어올 수 있었다'고 믿게 만들고 싶었다. 열쇠 없이 들어온 사람은 — 문을 열어 준 오스카가 맞이한 손님뿐이다.)"],
        ],
      },
    },
    H1: {
      title: "시계공의 종소리", type: "melody", difficulty: 1, hidden: true,
      desc: "금고의 둘째 문 위에 크기가 다른 종 다섯 개. 오스카가 알려 준 가락대로 울려라. (1이 가장 낮은 종)",
      hints: ["오스카: '높은 종부터 다섯, 셋, 넷, 둘, 하나'.", "5 → 3 → 4 → 2 → 1.", "가장 큰(낮은) 종이 1이다."],
      public: { bells: 5 },
      solution: { seq: [5, 3, 4, 2, 1] },
      requires: ["rescued"],
      onSolve: {
        set: ["h1"],
        lines: [
          ["narrator", "", "다섯 번째 종소리가 지하에 울리자 금고 문이 열렸다. 안에는 금은보화 대신 낡은 편지 한 통."],
          ["oskar", "smile", "창건자의 편지로군. '이 마을의 보물은 같은 시간을 함께 사는 사람들이다. 시계가 멈춰도, 서로를 기다려라.'"],
          ["oskar", "smile", "루시앙이 이걸 위해 그 난리를 쳤다니. 보물은 처음부터 마을 위에 있었는데."],
        ],
      },
    },
    H2: {
      title: "분수의 별 문양", type: "rings", difficulty: 3, hidden: true,
      desc: "분수 바닥의 원판 세 개. 별 문양이 한 줄로 서도록 돌려라. 바깥 원판을 돌리면 가운데 원판도, 가운데 원판을 돌리면 안쪽 원판도 함께 한 칸 돈다.",
      hints: ["가장 바깥 원판부터 맞춰야 안쪽이 흐트러지지 않는다.", "바깥을 다 맞춘 뒤, 가운데를 돌려라. 안쪽은 마지막.", "바깥 5번, 가운데 6번, 안쪽 0번."],
      public: { rings: 3, steps: 8, init: [3, 5, 2], symbol: "★" },
      wrongMsg: "별 문양이 아직 한 줄로 서지 않았다.",
      solution: {},
      onSolve: {
        set: ["h2"],
        lines: [
          ["narrator", "", "별이 한 줄로 서자 분수 바닥에서 옛 은화 한 닢이 떠올랐다. 1847이라는 숫자가 새겨져 있다."],
        ],
      },
    },
    H3: {
      title: "그림책 속 미로", type: "maze", difficulty: 1, hidden: true,
      desc: "아이들이 보던 그림책. '시계탑 아래 길' 그림의 미로를 따라 시계(S)에서 탑(T)까지 길을 그려라.",
      hints: ["막다른 길을 피하려면 출구(T)에서 거꾸로 찾아보자.", "처음엔 아래로 내려가라.", "오른쪽 벽을 따라가면 된다."],
      public: {
        grid: [
          "S.#....",
          ".##.##.",
          "...#...",
          "#.##.#.",
          "..#..#.",
          ".##.##.",
          "....#.T",
        ],
      },
      solution: {},
      onSolve: {
        set: ["h3"],
        lines: [["detective", "", "그림 속 길은 작업실 근처에서 시작해 탑 아래로 이어진다. 창건자는 처음부터 탑 아래 길을 만들어 두었던 것이다."]],
      },
    },
  },

  // ---------- 심문 ----------
  // statements: 처음부터 보이는 증언 + reveal로 열리는 증언. press = 추궁(더 묻기), contradiction = 증거로 반박
  // 반박에 성공하면 set/give/reveal, solves가 있으면 그 퍼즐을 해결한 것으로 처리한다.
  interrogations: {
    isabel: {
      character: "isabel", title: "이자벨의 증언", maxMistakes: 4, done: "isabel_clock",
      intro: [["isabel", "worried", "제가… 뭘 잘못했나요?"]],
      statements: [
        { id: "i1", text: "어젯밤 11시에 선생님께 인사드리고 곧장 여관으로 돌아갔어요.",
          press: { lines: [["isabel", "thinking", "선생님은 편지 한 장을 들고 계셨어요. 제가 들어가니까 얼른 접으셨고요."], ["detective", "", "(편지를 숨겼다. 제자에게 보여 주고 싶지 않은 편지.)"]], reveal: ["i3"] } },
        { id: "i2", text: "괘종시계는 선생님만 만지세요. 저는 그 안을 본 적도 없어요.",
          press: { lines: [["isabel", "nervous", "정말이에요. 선생님 작품이니까요… 제자는 손대면 안 돼요."]] },
          contradiction: { evidence: ["E22"], lines: [
            ["detective", "", "진자 칸 유리 안쪽에 손자국이 있습니다. 오스카 씨보다 훨씬 작은 손. 이자벨 씨 손 크기죠."],
            ["isabel", "embarrassed", "…!"],
            ["detective", "", "다만 그 손자국 위엔 먼지가 앉아 있었습니다. 어젯밤 생긴 자국이 아니에요. 며칠 전입니다."],
            ["isabel", "sad", "…지난주에 선생님이 진자 칸 여는 법을 가르쳐 주셨어요. '무슨 일이 생기면 그때 열어라. 그 전엔 누구에게도 말하지 마라.'"],
            ["isabel", "worried", "그래서 숨겼어요. 약속이니까. …선생님은 '큰 톱니가 먼저, 작은 톱니가 마지막'이라고 하셨어요."],
            ["detective", "", "(오스카는 일주일 전부터 무슨 일이 생길 걸 알고 있었다. 협박 편지가 오기 전부터.)"],
          ], set: ["isabel_clock"] } },
        { id: "i3", text: "선생님은 그 편지를 읽고 나서 난로에 봉투를 던지셨어요.",
          press: { lines: [["isabel", "thinking", "봉투만요. 편지는 주머니에 넣으셨어요. 그리고 '탑 아래 문'이라고 혼잣말을 하셨어요."], ["detective", "", "(편지 추신의 '탑 아래'… 오스카는 그 말을 문 이름으로 알아들었다.)"]], set: ["heard_tower_door_isabel"] } },
      ],
    },
    penelope: {
      character: "penelope", title: "페넬로페의 증언", maxMistakes: 4, done: "penelope_admit",
      intro: [["penelope", "nervous", "시장님은 지금 회의 중이세요. 저한테 물으실 게 있다면… 짧게 부탁드려요."]],
      statements: [
        { id: "n1", text: "시장님은 11시부터 1시까지 회의 내내 제 앞에 계셨어요.",
          press: { lines: [["penelope", "neutral", "자정에 벽시계가 멈췄을 때도 시장님은 서류를 넘기고 계셨어요. 둘이 동시에 고개를 들었죠."]] } },
        { id: "n2", text: "편지지는 제 서랍에만 있고, 한 장도 없어진 적 없어요.",
          press: { lines: [["penelope", "nervous", "재고는 제가 매일 세요. 비서니까요. …틀릴 리 없어요."]] },
          contradiction: { evidence: ["E24"], lines: [
            ["detective", "", "재고표엔 10월 23일 50장. 그런데 상자는 비어 있습니다. 매일 센다면 모를 수가 없죠."],
            ["penelope", "sad", "…맞아요. 25일 아침에 한 묶음이 통째로 없어졌어요. 시장님이 아시면 저는 잘려요. 그래서 메모만 해 두고 숨겼어요."],
            ["penelope", "worried", "이게 그 메모예요. 그 전날 다녀간 손님도 적어 뒀어요."],
          ], give: ["E15"], set: ["penelope_admit"], reveal: ["n3"] } },
        { id: "n3", text: "루시앙 씨는 24일에 세금 서류만 두고 금방 가셨어요.",
          press: { lines: [["penelope", "thinking", "…아. 제가 차를 내오는 동안 제 자리에 혼자 앉아 계셨네요. 서랍 바로 옆에요."], ["detective", "", "(차 한 잔 끓이는 시간. 편지지 한 묶음을 챙기기엔 충분하다.)"]], set: ["heard_lucien_desk"] } },
      ],
    },
    veronica: {
      character: "veronica", title: "베로니카의 증언", maxMistakes: 4, done: "veronica_confessed",
      intro: [["veronica", "nervous", "또 무슨 일이죠? 손님 받아야 하는데…"]],
      statements: [
        { id: "v1", text: "저는 그날 밤 내내 여관 계산대에 있었어요.",
          press: { lines: [["detective", "", "내내라면 자정에도요?"], ["veronica", "nervous", "그, 그럼요. 제가 어딜 가겠어요."]] },
          contradiction: { evidence: ["E21"], lines: [
            ["detective", "", "빵집 주인 바실 씨는 자정 직전에 **외상값을 갚으러 온 여자 손님**을 봤다고 했습니다."],
            ["veronica", "embarrassed", "…아이고. 맞아요, 저예요. 밀린 외상값이 창피해서 말을 못 했어요."],
            ["veronica", "sad", "11시 45분쯤 나가서 12시 20분쯤 돌아왔어요. 그사이 여관엔 이자벨 방 불만 켜져 있었고요."],
          ], set: ["veronica_confessed"], reveal: ["v3"] } },
        { id: "v2", text: "루시앙 씨는 11시 40분쯤 나갔어요.",
          press: { lines: [["veronica", "thinking", "마지막 손님들 계산할 때라 확실해요. 또각또각, **굽 높은 구두 소리**가 계단까지 울렸거든요."]] } },
        { id: "v3", text: "빵집 가는 길에, 시계탑 쪽에서 등불 하나가 흔들리는 걸 봤어요.",
          press: { lines: [["veronica", "thinking", "그 시간에 탑에 갈 사람은 오스카 씨뿐인데… 등불은 탑 아래 문 앞에 멈춰 있었어요. 누가 기다리는 것처럼."]], set: ["saw_lantern"] } },
      ],
    },
    mayor: {
      character: "mayor", title: "홀름 시장의 증언", maxMistakes: 4, done: "tower_key",
      intro: [["mayor", "suspicious", "또 오셨군. 묻고 싶은 게 있으면 빨리 물으시오."]],
      statements: [
        { id: "m1", text: "나는 어젯밤 11시부터 1시까지 페넬로페와 회의 중이었소.",
          press: { lines: [["mayor", "angry", "비서에게 물어보시오. 자정에 벽시계가 멈춰서 둘 다 놀랐으니까."]] } },
        { id: "m2", text: "시청 편지지는 비서 서랍에서 한 장도 나간 적이 없소. 그러니 그 편지는 시청 안에서 쓴 거겠지.",
          press: { lines: [["detective", "", "시청 안에서 썼다면, 시청 사람이 범인이라는 말씀입니까?"], ["mayor", "nervous", "그, 그건… 그런 뜻이 아니라…"]] },
          contradiction: { evidence: ["E15"], lines: [
            ["detective", "", "비서의 메모입니다. 10월 25일, **편지지 한 묶음이 비었고**, 그 전날 루시앙 씨가 다녀갔습니다."],
            ["mayor", "surprised", "…루시앙이? 그자가 내 편지지로 협박장을 썼단 말이오?"],
            ["mayor", "thinking", "그렇다면 나를 범인으로 보이게 하려던 거로군. …좋소. 시계탑 열쇠를 드리지. 탑을 헐고 싶었지, 오스카를 해칠 생각은 없었소."],
          ], set: ["tower_key"] } },
        { id: "m3", text: "오스카는 탑을 지키겠다고 고집만 부렸지.",
          press: { lines: [["mayor", "thinking", "탑 열쇠는 나와 오스카만 갖고 있소. 그 둘이 아니면 **탑 문은 안에서 열어 줘야만** 들어갈 수 있지."]], set: ["heard_tower_door"] } },
      ],
    },
    lucien: {
      character: "lucien", title: "루시앙의 증언", maxMistakes: 4, done: "lucien_fled",
      intro: [["lucien", "suspicious", "또 당신이오? 이번엔 무슨 트집이오."]],
      statements: [
        { id: "l1", text: "어젯밤엔 저녁 내내 여관 식당에 있었소.",
          press: { lines: [["lucien", "smile", "11시 40분까지 내 자리에 있었소. 베로니카도 봤을 거요."]] } },
        { id: "l2", text: "11시 40분쯤 여관을 나왔소.",
          press: { lines: [["lucien", "suspicious", "그게 어쨌다는 거요? 집에 가려면 나와야지."], ["detective", "", "(여관에서 집까지는 5분. 그런데 그는 12시 반에 서둘렀다고 했다.)"]], reveal: ["l4"] } },
        { id: "l3", text: "광장 시계를 보니 12시 반이라 서둘러 집에 갔지.",
          press: { lines: [["lucien", "smile", "광장 한가운데 시계를 못 볼 리가 있소?"]] },
          contradiction: { evidence: ["E01"], lines: [], solves: "P09" } },
        { id: "l4", text: "시계탑 같은 데는 가 본 적도 없소. 먼지 구덩이에 왜 가겠소.",
          press: { lines: [["lucien", "nervous", "…왜 그렇게 보시오."]] },
          contradiction: { evidence: ["E16", "E19"], lines: [
            ["detective", "", "탑 계단 먼지 위에 **굽 높은 가죽 구두** 자국이 있었습니다."],
            ["lucien", "angry", "구두가 나만 있는 줄 아시오? …증거라면 더 확실한 걸 가져오시오."],
          ], set: ["lucien_tower_lie"] } },
      ],
    },
  },

  // ---------- 가설 (서버가 증거·추리 상태로 판정) ----------
  // show: 이 플래그가 생기면 수첩에 나타남. rules: 위에서부터 조건이 맞는 마지막 상태
  hypotheses: [
    { id: "h_kidnap", text: "시계공은 누군가에게 납치되었다.", show: ["intro_done"], rules: [{ when: ["got_E03"], status: "possible" }, { when: ["got_E07"], status: "contradicted" }, { when: ["d1"], status: "rejected" }] },
    { id: "h_self", text: "시계공은 스스로 작업실을 떠났다.", show: ["got_E03"], rules: [{ when: ["got_E07"], status: "possible" }, { when: ["d1"], status: "confirmed" }] },
    { id: "h_passage", text: "작업실에는 비밀 통로가 있다.", show: ["got_E07"], rules: [{ when: ["got_E07"], status: "possible" }, { when: ["p05"], status: "confirmed" }] },
    { id: "h_intent", text: "마을의 시계는 누군가 의도적으로 멈췄다.", show: ["got_E02"], rules: [{ when: ["got_E05"], status: "possible" }, { when: ["d4"], status: "confirmed" }] },
    { id: "h_mayor", text: "협박 편지는 시청 사람이 썼다.", show: ["got_E06"], rules: [{ when: ["got_E06"], status: "possible" }, { when: ["got_E15"], status: "contradicted" }, { when: ["tower_key"], status: "rejected" }] },
    { id: "h_lucien", text: "루시앙의 그날 밤 행적은 거짓이다.", show: ["got_E11"], rules: [{ when: ["d3"], status: "possible" }, { when: ["p09"], status: "confirmed" }] },
    { id: "h_isabel", text: "이자벨은 시계공의 실종에 관여했다.", show: ["got_E22"], rules: [{ when: ["got_E22"], status: "possible" }, { when: ["isabel_clock"], status: "rejected" }] },
    { id: "h_invited", text: "범인은 탑에 몰래 숨어든 것이 아니라, 누군가 들여보냈다.", show: ["got_E25"], rules: [{ when: ["got_E25"], status: "possible" }, { when: ["d5"], status: "confirmed" }] },
    { id: "h_vault", text: "범인이 노린 것은 시계탑 지하의 무언가다.", show: ["got_E05"], rules: [{ when: ["got_E10"], status: "possible" }, { when: ["d4"], status: "confirmed" }] },
  ],

  // ---------- 관계도 (단서를 찾으면 하나씩 드러남) ----------
  relations: [
    { a: "oskar", b: "isabel", kind: "close", label: "스승과 제자", when: ["met_isabel"] },
    { a: "isabel", b: "veronica", kind: "close", label: "하숙집 주인", when: ["got_E12"] },
    { a: "oskar", b: "mayor", kind: "conflict", label: "시계탑 철거로 대립", when: ["got_E13"] },
    { a: "mayor", b: "penelope", kind: "work", label: "시장과 비서", when: ["talked_penelope"] },
    { a: "oskar", b: "lucien", kind: "interest", label: "명작 시계를 탐냄", when: ["got_E11"] },
    { a: "veronica", b: "basil", kind: "secret", label: "밀린 외상값", when: ["veronica_confessed"] },
    { a: "lucien", b: "mayor", kind: "secret", label: "편지지로 누명을 씌움", when: ["tower_key"] },
    { a: "lucien", b: "oskar", kind: "secret", label: "협박 · 감금", when: ["rescued"] },
    { a: "penelope", b: "lucien", kind: "secret", label: "자리를 비운 사이", when: ["heard_lucien_desk"] },
    { a: "isabel", b: "oskar", kind: "secret", label: "진자 칸의 약속", when: ["isabel_clock"] },
  ],

  // ---------- 추리 보드 ----------
  deductions: [
    {
      id: "D1", cards: ["E03", "E04", "E07"],
      title: "스스로 나간 시계공",
      conclusion: "빗장은 안쪽에서 걸렸고, 오스카는 11시 47분까지 방에 있었으며, 그의 발자국은 괘종시계 앞에서 끊긴다. 오스카는 스스로 문을 잠그고 다른 길로 나갔다.",
      set: ["d1"],
      lines: [["detective", "", "범인이 오스카를 데려간 게 아니다. 오스카가 직접 이 방을 나갔다 — 괘종시계 쪽 어딘가로."]],
    },
    {
      id: "D2", cards: ["E05", "E06", "E15"],
      title: "훔친 편지지",
      conclusion: "협박 편지는 시청 편지지에 쓰였지만, 그 편지지는 루시앙이 시청을 다녀간 다음 날 사라졌다. 편지는 시장을 범인으로 보이게 하려는 함정이다.",
      set: ["d2"],
      lines: [["detective", "", "편지지 출처가 시청이라고 해서 시장이 쓴 건 아니다. 시장에게 가서 이 사실을 알리자."]],
    },
    {
      id: "D3", cards: ["E01", "E11", "E12"],
      title: "존재하지 않는 12시 반",
      conclusion: "광장 시계는 12시 00분에 멈췄다. 그런데 루시앙은 광장 시계에서 12시 반을 봤다고 했다. 11시 40분에 여관을 나간 뒤의 행적은 거짓이다.",
      set: ["d3"],
      lines: [["detective", "", "루시앙의 진술은 앞뒤가 맞지 않는다. 증거를 들고 그를 추궁하자."]],
    },
    {
      id: "D4", cards: ["E02", "E09", "E10"],
      title: "멈춘 시간의 금고",
      conclusion: "마스터 시계가 자정에 멈춰야 금고의 첫 문이 열린다. 『에셀 창건기』를 빌린 'L.'은 그걸 알았고, 오스카에게 시계를 멈추게 했다. 목적은 시계탑 지하 금고다.",
      set: ["d4"],
      lines: [["detective", "", "모든 길은 시계탑 아래를 가리킨다. 오스카는 거기 있다."]],
    },
    {
      id: "D5", cards: ["E05", "E16", "E25"],
      title: "탑 아래에서 기다린 손님",
      conclusion: "편지는 '탑 아래에서 기다린다'고 했다. 탑 아래 문은 안에서만 열리고, 어젯밤 기름 묻은 손 — 오스카가 열었다. 계단엔 오스카와 굽 높은 구두 두 사람의 발자국. 범인은 숨어든 게 아니라, 오스카가 직접 문을 열어 맞이했다.",
      set: ["d5"],
      lines: [["detective", "", "열쇠 없이 탑에 들어온 방법은 단 하나 — 오스카가 열어 줬다. 그렇다면 '시장만 드나들 수 있었다'는 말은 누군가 꾸며 낸 것이다."]],
    },
  ],

  // D5 는 진행을 막지 않는 추리 (최종 결론의 근거 · 정확도에 반영)
  // 플래그가 모두 모이면 자동으로 켜지는 플래그 (+ 알림 대사)
  autoFlags: [
    { set: "tower_open", when: ["tower_key", "d4", "lucien_fled"], lines: [["detective", "", "시장의 열쇠, 금고 도면, 그리고 탑으로 도망친 루시앙. 이제 시계탑으로 가자."]] },
  ],

  // ---------- 최종 추리 ----------
  final: {
    requires: ["rescued", "c3"],
    intro: [
      ["narrator", "", "시계탑 지하. 마을 사람들이 등불을 들고 모였다. 구석에 몰린 루시앙이 이를 악문다."],
      ["detective", "", "자정에 멈춘 시계. 그 진실을 밝히겠습니다."],
    ],
    // 문항마다 답 하나 + 그 답을 뒷받침하는 증거 하나를 고른다. 근거는 solution.evidence 중 하나면 인정.
    questions: [
      { id: "when", text: "사건은 언제 일어났나?", options: [
        { id: "a", text: "11시 47분 오스카가 작업실을 떠났고, 자정에 탑에서 마스터 시계를 멈췄다" },
        { id: "b", text: "12시 반, 오스카가 작업실에서 납치되었다" },
        { id: "c", text: "11시 40분, 오스카가 여관에서 사라졌다" },
        { id: "d", text: "새벽, 시계탑 종이 울린 뒤에 일어났다" }] },
      { id: "stop", text: "마을의 시계는 왜 모두 멈췄나?", options: [
        { id: "a", text: "협박 편지를 받은 오스카가 직접 마스터 시계를 멈췄고, 연결된 시계가 함께 멈췄다" },
        { id: "b", text: "누군가 마을의 시계를 하나하나 부쉈다" },
        { id: "c", text: "번개로 전기가 끊겨 시계가 멈췄다" },
        { id: "d", text: "시계탑이 낡아 저절로 고장 났다" }] },
      { id: "lock", text: "작업실은 어떻게 안에서 잠겼나?", options: [
        { id: "a", text: "범인이 열쇠로 밖에서 잠갔다" },
        { id: "b", text: "이자벨이 아침에 잠갔다" },
        { id: "c", text: "오스카가 안에서 빗장을 걸고, 괘종시계 뒤 통로로 나갔다" },
        { id: "d", text: "창문으로 나간 뒤 줄로 빗장을 당겼다" }] },
      { id: "where", text: "오스카는 어디로 사라졌나?", options: [
        { id: "a", text: "마을 밖으로 달아났다" },
        { id: "b", text: "통로를 지나 시계탑으로 갔다가 지하 창고에 갇혔다" },
        { id: "c", text: "시청 지하에 숨어 있었다" },
        { id: "d", text: "여관 2층에 숨어 있었다" }] },
      { id: "culprit", text: "오스카를 탑으로 불러내 가둔 사람은?", options: [
        { id: "isabel", text: "이자벨" }, { id: "mayor", text: "홀름 시장" }, { id: "lucien", text: "루시앙" }, { id: "veronica", text: "베로니카" }] },
      { id: "motive", text: "범인의 진짜 목적은?", options: [
        { id: "demolish", text: "시계탑 철거를 밀어붙이려고" }, { id: "masterpiece", text: "오스카의 명작 시계를 훔치려고" },
        { id: "vault", text: "시계탑 지하 창건자 금고를 열려고" }, { id: "rival", text: "이자벨을 후계자 자리에서 몰아내려고" }] },
    ],
    solution: {
      when: { answer: "a", evidence: ["E04", "E01"] },
      stop: { answer: "a", evidence: ["E05", "E02"] },
      lock: { answer: "c", evidence: ["E03", "E07", "E08"] },
      where: { answer: "b", evidence: ["E08", "E16", "E10", "E25"] },
      culprit: { answer: "lucien", evidence: ["E11", "E09", "E15", "E19", "E20", "E16", "E26"] },
      motive: { answer: "vault", evidence: ["E10", "E09", "E18"] },
    },
    // 진 엔딩: 6문항 모두 정답 + 근거 5개 이상 / 배드: 범인 오답 / 그 밖은 보통
    trueRule: { allCorrect: true, minEvidence: 5 },
    endings: {
      true: {
        title: "자정의 종소리", reveal: { k: "범인 공개", t: "골동품상 루시앙", s: "자정에 마을의 시간을 멈춘 사람" }, lines: [
          ["detective", "", "**범인은 루시앙.** 『에셀 창건기』로 금고의 비밀을 알고, 훔친 시청 편지지로 시장에게 누명을 씌우며 오스카를 협박했습니다."],
          ["detective", "", "오스카는 제자를 지키려 스스로 빗장을 걸고 통로로 나갔고, 탑 아래 문을 열어 협박범을 맞이한 뒤 자정에 마스터 시계를 멈췄습니다. 마을의 시계가 모두 멈춘 이유입니다."],
          ["detective", "", "그리고 오스카 씨를 가둔 뒤, 그의 일지에 훔친 편지지 한 장을 끼워 넣었죠. '탑에 드나들 수 있는 건 시장뿐'이라고. 끝까지 시장에게 죄를 넘기려고."],
          ["lucien", "sad", "…창건자의 보물이라길래. 평생 남의 낡은 물건만 팔아 온 내게도 한 번쯤은…"],
          ["oskar", "smile", "자네 덕에 다시 종을 칠 수 있겠군. 이자벨, 가서 마스터 시계를 감자꾸나."],
          ["narrator", "", "그날 정오, 에셀 마을의 모든 시계가 다시 함께 움직이기 시작했다."],
        ],
      },
      normal: {
        title: "멈춘 채로", reveal: { k: "범인 공개", t: "골동품상 루시앙", s: "자정에 마을의 시간을 멈춘 사람" }, lines: [
          ["detective", "", "범인은 루시앙입니다."],
          ["lucien", "angry", "증거는 있소? …좋아, 오스카를 가둔 건 나요. 하지만 그 이유까지 알 필요는 없겠지."],
          ["narrator", "", "루시앙은 붙잡혔지만, 그가 무엇을 노렸는지는 끝내 밝혀지지 않았다. 금고는 다시 잠겼다."],
        ],
      },
      bad: {
        title: "사라진 시간", lines: [
          ["detective", "", "범인은… 바로 당신입니다."],
          ["narrator", "", "엉뚱한 사람을 지목한 사이, 사람들 틈에서 굽 높은 구두 소리가 조용히 멀어졌다."],
          ["narrator", "", "이튿날 루시앙의 가게는 텅 비어 있었다. 오스카는 무사했지만, 자정에 멈춘 시간의 진실은 어둠 속에 남았다."],
        ],
      },
    },
  },

  // ---------- 화면 연출 · 수첩 (사건마다 다른 부분 — 엔진·화면 코드에는 사건 내용을 두지 않는다) ----------
  // 조건(cond)은 플래그 목록: got_E01(증거), d1(추리), p09(퍼즐), seen_lucien(만난 인물) 등. 비우면 항상.
  presentation: {
    episode: "EP.01", label: "EPISODE 01", playtime: "예상 60~80분",
    summary: "10월 28일 밤 12시, 에셀 마을의 시계가 동시에 멈췄다. 같은 밤, 시계공 오스카가 안에서 잠긴 작업실에서 사라졌다. 남은 것은 깨진 회중시계와 정체불명의 편지.",
    tips: [
      "증거 카드는 수첩의 추리 보드에서 세 장을 묶어 연결해요. 틀려도 왜 틀렸는지 알려 줘요.",
      "반짝이는 곳은 조사할 수 있어요. '이름 보기'를 켜면 모든 조사 지점 이름이 보여요.",
      "힌트는 3단계예요. 쓸수록 결과의 힌트 횟수가 늘어나요.",
      "누군가의 말이 다른 증거와 어긋나면, 그게 바로 심문에서 반박할 기회예요.",
      "시간이 적힌 증거는 수첩의 타임라인에 자동으로 정리돼요.",
      "숨겨진 퍼즐이 3개 있어요. 모두 찾으면 특별한 칭호를 받아요.",
    ],
    // 프롤로그 컷 (화면은 kind 별로 그린다: rain-town · clock · object · black · titlecard)
    prologue: [
      { kind: "rain-town", ms: 3000, cap: "10월 28일 밤, 에셀 마을에 비가 내렸다.", sfx: "rain" },
      { kind: "clock", sec: 10, ms: 3200, cap: "자정까지 10초.", sfx: "ticks" },
      { kind: "clock", sec: 0, stop: true, ms: 2600, cap: "종이 울리려던 순간 —", sfx: "cutoff" },
      { kind: "clock", sec: 0, mono: true, ms: 2000, cap: "마을의 모든 시계가 멈췄다." },
      { kind: "object", object: "pocketwatch", lightning: true, ms: 2800, cap: "그리고 그날 밤, 시계공 오스카가 사라졌다.", sfx: "thunder" },
      { kind: "black", ms: 2200, sfx: "steps" },
      { kind: "titlecard", ms: 2600, sfx: "midnight" },
    ],
    // 퍼즐을 풀었을 때 연출 (서버가 이벤트로 보낸다)
    cinematics: {
      P05: { k: "반전", t: "밀실이 아니었다", style: "purple", shake: true },
      T1: { k: "열린 문", t: "탑 아래 문", s: "어젯밤, 누군가 이 문을 안에서 열었다", style: "dark", push: true, sound: "door" },
      C3: { k: "반전", t: "끼워 넣은 한 장", s: "끝까지 누명을 씌우려 한 손", style: "purple", shake: true },
      P09: { k: "반전 · 거짓말 발견", t: "존재하지 않는 12시 반", style: "purple", shake: true },
      P11: { k: "숨겨진 공간", t: "지하로 가는 문이 열렸다", s: "1847년 3월 15일 — 마을의 생일이 열쇠였다", style: "dark", push: true, sound: "door" },
      P12: { k: "발견", t: "창고 안의 그림자", style: "flash", sound: "unlock" },
      H1: { k: "숨겨진 진실", t: "창건자의 편지", style: "flash", sound: "success" },
    },
    finalCine: { k: "FINAL", t: "진실을 밝힐 시간", s: "모두가 시계탑 지하에 모였다", style: "dark", push: true, sound: "midnight", ms: 3000 },
    finalScene: "final",
    // 그림이 알아야 하는 진행 플래그 (이것만 화면에 보낸다)
    artFlags: ["lucien_fled"],
    // 구간별 소요 시간 (결과 화면 · 기록) — 플래그가 처음 켜진 시각으로 잰다
    chapters: [
      { name: "1장 · 잠긴 작업실", until: "twist1" },
      { name: "2장 · 세 곳의 증언", until: "tower_open" },
      { name: "3장 · 시계탑", until: "rescued" },
      { name: "4장 · 마지막 기록", until: "c3" },
      { name: "최종 추리", end: true },
    ],
    relationLayout: { oskar: [320, 200], isabel: [530, 80], veronica: [560, 260], basil: [500, 380], mayor: [120, 300], penelope: [90, 110], lucien: [300, 375] },
    notes: {
      isabel: "오스카의 수제자. 여관 2층에 하숙. 작업실 열쇠를 가진 또 한 사람.",
      mayor: "시계탑 철거를 추진. 오스카와 공개적으로 대립했다.",
      lucien: "골동품상. 오스카의 시계를 탐냈다. 혼자 산다.",
      veronica: "여관 '은방울' 주인. 그날 밤 행적을 얼버무렸다.",
      penelope: "시청 비서. 시장의 회의 상대. 꼼꼼하고 겁이 많다.",
      basil: "빵집 주인. 가게 시계는 전선 없는 태엽식.",
      oskar: "에셀 마을의 시계공. 그날 밤 사라졌다.",
    },
    // 타임라인: 그 증거를 가진 사람에게만 보인다. kind: fact 확정 / claim 증언 / doubt 주장(falseWhen 이후 '거짓으로 밝혀짐')
    timeline: [
      { ev: "E09", tm: "10/20", t: "누군가 'L.'이 『에셀 창건기』를 빌려 감", kind: "fact" },
      { ev: "E24", tm: "10/23", t: "비서 재고표 '편지지 50장' — 지금은 빈 상자", kind: "fact" },
      { ev: "E15", tm: "10/24~25", t: "루시앙 시청 방문 · 다음 날 공용 편지지 한 묶음이 빔", kind: "fact" },
      { ev: "E05", tm: "10/28", t: "오스카에게 협박 편지 도착", kind: "fact" },
      { ev: "E12", tm: "23:40", t: "루시앙, 여관 식당을 나감 (베로니카)", kind: "claim" },
      { ev: "E21", tm: "23:45~00:20", t: "여자 손님이 빵집에 외상값을 갚으러 옴 (바실)", kind: "claim" },
      { ev: "E04", tm: "23:47", t: "오스카의 회중시계가 깨져 멈춤", kind: "fact" },
      { ev: "E20", tm: "23:50", t: "여관에서 들키지 않고 탑 아래 문까지 10분", kind: "claim" },
      { ev: "E25", tm: "23:55", t: "탑 아래 문이 안쪽에서 열림 (빗장에 시계 기름)", kind: "fact" },
      { ev: "E01", tm: "00:00", t: "시계탑과 이어진 마을 시계가 모두 멈춤", kind: "fact" },
      { ev: "E11", tm: "00:30?", t: "루시앙: \"광장 시계를 보니 12시 반\"", kind: "doubt", falseWhen: "p09" },
    ],
    openQuestions: [
      { text: "안에서 잠긴 방에서 오스카는 어떻게 사라졌나?", until: "d1" },
      { text: "시청 편지지에 쓰인 협박 편지 — 정말 시장이 썼을까?", until: "d2" },
      { text: "그날 밤 행적을 증명하지 못하는 사람은 누구인가?", until: "p09" },
      { text: "범인은 왜 마스터 시계를 멈추게 했나?", until: "d4" },
      { text: "오스카는 지금 어디에 있나?", until: "p12" },
      { text: "진자 칸의 작은 손자국 — 이자벨은 무엇을 숨기나?", from: "got_E22", until: "isabel_clock" },
      { text: "매일 재고를 센다는 비서는 왜 빈 상자를 몰랐다고 할까?", from: "talked_penelope", until: "penelope_admit" },
      { text: "열쇠 없는 사람이 어떻게 탑 안에 들어왔나?", from: "got_E16", until: "d5" },
      { text: "오스카가 갇혀서 남긴 기록에는 무엇이 적혀 있나?", from: "rescued", until: "c3" },
    ],
    // 용의자 분석: 각 칸은 [조건, 문구] 목록 — 조건이 맞는 마지막 문구를 쓴다
    suspects: [
      { id: "isabel",
        motive: [[[], "?"], [["got_E14"], "작업실 열쇠를 가진 유일한 다른 사람"]],
        alibi: [[[], "?"], [["got_E12"], "여관 하숙방이라고 함"], [["p08"], "밤새 여관 2층 (방 불이 켜져 있었다)"]],
        note: [[[], ""], [["d1"], "빗장은 안쪽에서만 걸린다 — 열쇠는 상관없었다."], [["got_E22"], "진자 칸 여는 법을 아는 건 오스카만이 아니었다."], [["isabel_clock"], "스승과의 약속 때문에 숨겼다. 손자국은 일주일 전 것."]],
        verdict: [[[], "open", "조사 중"], [["d1"], "clear", "혐의 없음"], [["got_E22"], "doubt", "숨기는 것이 있다"], [["isabel_clock"], "clear", "혐의 없음"]] },
      { id: "mayor",
        motive: [[[], "?"], [["got_E13"], "시계탑 철거를 두고 오스카와 대립"]],
        alibi: [[[], "?"], [["seen_penelope"], "비서와 회의 중 (비서 증언)"]],
        note: [[[], ""], [["got_E06"], "협박 편지가 시청 편지지에 쓰였다."], [["d2"], "편지지는 누군가 훔친 것이었다."], [["got_E26"], "가짜 일지까지 동원해 누명을 씌우려 했다."]],
        verdict: [[[], "open", "조사 중"], [["got_E06"], "doubt", "의심"], [["d2"], "clear", "혐의 없음"]] },
      { id: "lucien",
        motive: [[[], "?"], [["seen_lucien"], "오스카의 시계를 탐냈다"]],
        alibi: [[[], "?"], [["got_E11"], "\"광장 시계를 보니 12시 반\""]],
        note: [[[], ""], [["d3"], "멈춘 광장 시계가 12시 반을 가리킬 수는 없다."]],
        verdict: [[[], "open", "조사 중"], [["d3"], "doubt", "의심"], [["p09"], "doubt", "거짓말 확인"]] },
      { id: "veronica",
        motive: [[[], "?"], [["seen_veronica"], "그날 밤 행적을 얼버무림"]],
        alibi: [[[], "?"], [["veronica_confessed"], "자정 무렵 빵집 (외상값)"]],
        note: [[[], ""], [["veronica_confessed"], "숨긴 건 외상값 이야기뿐이었다."]],
        verdict: [[[], "open", "조사 중"], [["veronica_confessed"], "clear", "혐의 없음"]] },
    ],
  },

  titles: [
    { id: "perfect", name: "자정의 명탐정", when: { ending: "true", hintsMax: 0 } },
    { id: "guardian", name: "시계탑의 수호자", when: { ending: "true" } },
    { id: "collector", name: "숨은 단서 수집가", when: { hiddenMin: 3 } },
    { id: "thorough", name: "발로 뛰는 조사관", when: { optionalMin: 3 } },
    { id: "almost", name: "아쉬운 추리", when: { ending: "normal" } },
    { id: "lost", name: "길 잃은 탐정", when: { ending: "bad" } },
  ],
};
