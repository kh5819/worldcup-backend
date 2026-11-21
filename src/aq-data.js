// =========================
// DUO 증강 물고기 키우기 (증강 수조) — 데이터 (2026-11-21)
// · 서버(worldcup-backend/src/aq-data.js)와 화면(홈페이지 제작/js/fish/aq-data.js)이 같은 파일 (_aq-verify가 같은지 확인)
// · 이름·설명은 [한, 日, EN]
// =========================
export const TICK = 0.05;                       // 서버 20Hz
export const MAP = { w: 5200, h: 3400 };        // 옆에서 본 수조: 위 = 수면, 아래 = 모래 바닥
export const SURFACE = 70, FLOOR = 150;          // 수면 아래·바닥 위로만 헤엄
export const GAME_LEN = 300;                    // 5분 고정
export const MASS0 = 10;                        // 시작 크기
export const MAX_FISH = 50;                     // 한 수조 물고기 (사람 + AI)
export const MAX_AUGS = 8, MAX_ACTIVE = 2, MAX_LEGEND = 2;
export const AUG_AT = [25, 70, 150, 300, 520, 850, 1300, 2000]; // 이 크기가 될 때마다 증강 1장 (n번째 증강 = n번째 값)
export const EAT_RATIO = 1.25;                  // 이만큼 커야 먹음 (크기 = 무게)
export const DECAY_FROM = 500;                  // 이보다 크면 조금씩 줄어듦 (1등 독주 막기)
export const MASS_CAP = 6000;
export const RESPAWN = 2.5, SPAWN_SAFE = 3;     // 먹힌 뒤 다시 시작까지 · 시작 보호
export const DASH = { ticks: 6, mul: 2.4, cd: 1.6, cost: 0.04, min: 14 };
export const rOf = (m) => 6 * Math.sqrt(m) + 4;                 // 반지름 (10 → 23, 100 → 64, 1000 → 194)
export const spdOf = (m) => 90 + 240 / (1 + Math.sqrt(m) / 6); // 작을수록 훨씬 빠름 (10 → 247, 100 → 180, 1000 → 128, 5000 → 108)
export const viewOf = (m) => Math.min(2.3, Math.max(1, Math.pow(rOf(m) / 23, 0.42))); // 커질수록 화면이 넓어짐 (배율)

// 먹이 (pellet 종류 번호 = 바이너리)
export const FOOD = {
  0: { k: "plankton", m: 1, r: 6 },     // 플랑크톤
  1: { k: "fruit", m: 5, r: 10 },       // 해초 열매
  2: { k: "gold", m: 22, r: 13 },       // 황금 먹이
  3: { k: "remains", m: 0, r: 9 },      // 먹힌 물고기 살점 (값은 따로)
  4: { k: "drop", m: 0, r: 8 },         // 돌진하며 떨어뜨린 것
};
export const KRILL = { m: 3, r: 9, spd: 70 }; // 헤엄치는 새우 떼

// 물고기 모습 (Kenney Fish Pack) — 꾸미기일 뿐 능력 차이 없음
export const SKINS = {
  blue:   { spr: "fish_blue", skel: "fish_blue_skeleton", col: "#3aa0e6", name: ["파랑이", "アオ", "Bluey"] },
  green:  { spr: "fish_green", skel: "fish_green_skeleton", col: "#2ec46d", name: ["초록이", "ミドリ", "Greeny"] },
  orange: { spr: "fish_orange", skel: "fish_orange_skeleton", col: "#ff9a1f", name: ["주황이", "オレンジ", "Sunny"] },
  pink:   { spr: "fish_pink", skel: "fish_pink_skeleton", col: "#e98ee6", name: ["분홍이", "ピンク", "Rosy"] },
  red:    { spr: "fish_red", skel: "fish_red_skeleton", col: "#f0524a", name: ["빨강이", "アカ", "Ruby"] },
  grey:   { spr: "fish_grey", skel: "fish_blue_skeleton", col: "#a9b8be", name: ["은빛이", "ギン", "Silver"] },
  puffer: { spr: "fish_brown", skel: "fish_orange_skeleton", col: "#c98a4b", name: ["복어", "フグ", "Puffer"] },
  eel:    { spr: "eel", skel: "fish_blue_skeleton", col: "#8fa5ad", name: ["장어", "ウナギ", "Eel"] },
};
export const SKIN_IDS = Object.keys(SKINS);

// 증강 40종 — kind: p(항상) · a(Q/E 스킬, 최대 2개) · r: common·rare·epic·legend
export const AUGS = [
  { id: "a01", r: "common", kind: "p", icon: "👄", v: { mouth: 0.2 }, name: ["큰 입", "大きな口", "Big Mouth"], desc: ["먹는 범위 +20%", "食べる範囲+20%", "+20% eating reach"] },
  { id: "a02", r: "common", kind: "p", icon: "🍤", v: { food: 0.3 }, name: ["소화 잘됨", "消化上手", "Good Digestion"], desc: ["먹이(플랑크톤·새우·열매·황금)로 크는 양 +30%", "エサ(プランクトン・エビ・実・黄金)で育つ量+30%", "+30% growth from food (plankton, krill, fruit, gold)"] },
  { id: "a03", r: "rare", kind: "p", icon: "🦷", v: { prey: 0.25 }, name: ["포식자", "捕食者", "Predator"], desc: ["물고기를 먹으면 크는 양 +25%", "魚を食べた時の成長+25%", "+25% growth from eating fish"] },
  { id: "a04", r: "common", kind: "p", icon: "💨", v: { spd: 0.12 }, name: ["지느러미 강화", "ヒレ強化", "Strong Fins"], desc: ["헤엄 속도 +12%", "泳ぐ速さ+12%", "+12% swim speed"] },
  { id: "a05", r: "legend", kind: "p", icon: "🛡️", v: { cd: 60, keep: 0.7, inv: 2 }, name: ["비늘 갑옷", "うろこの鎧", "Scale Armor"], desc: ["먹혀도 한 번 버팀 — 크기 30%를 잃고 튕겨나가 2초 무적 (60초마다 충전)", "食べられても1回耐える — サイズ30%を失い弾かれて2秒無敵(60秒ごとに充電)", "Survive being eaten once — lose 30% size, bounce away, 2s invincible (recharges every 60s)"] },
  { id: "a06", r: "rare", kind: "p", icon: "🌵", v: { loss: 0.08, cd: 4, max: 2.2 }, name: ["복어 가시", "フグのトゲ", "Puffer Spines"], desc: ["나를 먹으려 닿은 물고기(나보다 2.2배 이하)는 크기 8%를 잃고 튕겨남 (4초마다)", "自分を食べようと触れた魚(2.2倍以下)はサイズ8%を失って弾かれる(4秒ごと)", "A fish (up to 2.2× your size) that touches you to eat you loses 8% size and bounces off (every 4s)"] },
  { id: "a07", r: "common", kind: "p", icon: "🌀", v: { pull: 1.6 }, name: ["흡입", "吸い込み", "Suction"], desc: ["몸 1.6배 거리 안의 먹이를 빨아들임", "体の1.6倍以内のエサを吸い込む", "Pull in food within 1.6× your body"] },
  { id: "a08", r: "common", kind: "p", icon: "🪶", v: { dcd: 0.4 }, name: ["가벼운 몸", "軽い体", "Light Body"], desc: ["돌진 쿨타임 -40%", "ダッシュのクールタイム-40%", "-40% dash cooldown"] },
  { id: "a09", r: "rare", kind: "p", icon: "🆓", v: {}, name: ["공짜 돌진", "タダでダッシュ", "Free Dash"], desc: ["돌진해도 작아지지 않음", "ダッシュしても小さくならない", "Dashing no longer costs size"] },
  { id: "a10", r: "common", kind: "p", icon: "🐢", v: { decay: 0.6 }, name: ["느린 대사", "ゆっくり代謝", "Slow Metabolism"], desc: ["크게 자란 뒤 줄어드는 속도 -60%", "大きくなった後に縮む速さ-60%", "-60% size decay when big"] },
  { id: "a11", r: "common", kind: "p", icon: "🌱", v: { base: 0.45, pct: 0.001 }, name: ["성장판", "成長期", "Growth Spurt"], desc: ["가만히 있어도 1초마다 조금씩 커짐", "何もしなくても毎秒少しずつ大きくなる", "Grow a little every second, no matter what"] },
  { id: "a12", r: "common", kind: "p", icon: "👀", v: { view: 0.18 }, name: ["눈치", "察し", "Keen Eyes"], desc: ["화면 18% 넓게 + 화면 밖 위험한 물고기 방향 표시", "画面18%広く+画面外の危険な魚の方向を表示", "+18% view and arrows to dangerous fish off-screen"] },
  { id: "a13", r: "rare", kind: "p", icon: "🍃", v: { still: 1 }, name: ["보호색", "保護色", "Camouflage"], desc: ["1초 동안 거의 멈춰 있으면 다른 물고기 눈에 거의 안 보임 (AI는 못 찾음)", "1秒ほぼ止まっていると他の魚からほぼ見えない(AIは見つけられない)", "Stay almost still for 1s to become nearly invisible (AI can't find you)"] },
  { id: "a14", r: "rare", kind: "p", icon: "⚡", v: { spd: 0.3, t: 3 }, name: ["연쇄 포식", "連鎖捕食", "Feeding Chain"], desc: ["물고기를 먹으면 3초간 속도 +30%", "魚を食べると3秒間速さ+30%", "+30% speed for 3s after eating a fish"] },
  { id: "a15", r: "rare", kind: "p", icon: "💰", v: { mul: 2 }, name: ["황금 비늘", "黄金のうろこ", "Golden Scales"], desc: ["황금 먹이 2배 + 내 근처에 황금 먹이가 더 자주 생김", "黄金のエサ2倍+近くに黄金のエサがよく出る", "Gold food ×2 and gold spawns near you more often"] },
  { id: "a16", r: "common", kind: "p", icon: "🦴", v: { mul: 2 }, name: ["청소부", "掃除屋", "Scavenger"], desc: ["먹힌 물고기 살점·떨어뜨린 먹이 2배", "食べられた魚の肉片・落ちたエサ2倍", "×2 from remains and dropped food"] },
  { id: "a17", r: "legend", kind: "p", icon: "🐚", v: { ratio: 1.45 }, name: ["두꺼운 껍질", "厚い殻", "Thick Shell"], desc: ["나를 먹으려면 1.25배가 아니라 1.45배 커야 함", "自分を食べるには1.25倍でなく1.45倍必要", "Others need 1.45× (not 1.25×) your size to eat you"] },
  { id: "a18", r: "legend", kind: "p", icon: "🦈", v: { ratio: 1.12 }, name: ["날카로운 이빨", "鋭い歯", "Sharp Teeth"], desc: ["1.12배만 커도 먹을 수 있음", "1.12倍大きければ食べられる", "Eat fish when you're just 1.12× their size"] },
  { id: "a19", r: "common", kind: "p", icon: "🌊", v: { spd: 0.08 }, name: ["해류 타기", "海流乗り", "Current Rider"], desc: ["해류에 안 밀림 + 속도 +8%", "海流に流されない+速さ+8%", "Immune to currents and +8% speed"] },
  { id: "a20", r: "rare", kind: "p", icon: "🐟", v: { n: 3, eff: 0.6 }, name: ["새끼 물고기", "子分の魚", "Little Helpers"], desc: ["새끼 물고기 3마리가 따라다니며 먹이를 대신 먹어 줌 (60%)", "子分の魚3匹がついて来てエサを代わりに食べる(60%)", "3 little fish follow you and eat food for you (60%)"] },
  { id: "a21", r: "rare", kind: "p", icon: "☠️", v: { back: 0.3, t: 5 }, name: ["독 가시", "毒のトゲ", "Toxic Spines"], desc: ["나를 먹은 물고기는 5초 동안 얻은 크기의 30%를 다시 잃음", "自分を食べた魚は5秒かけて得たサイズの30%を失う", "Whoever eats you loses 30% of what they gained over 5s"] },
  { id: "a22", r: "common", kind: "p", icon: "😨", v: { spd: 0.22, r: 340 }, name: ["생존 본능", "生存本能", "Survival Instinct"], desc: ["나를 먹을 수 있는 물고기가 가까우면 속도 +22%", "自分を食べられる魚が近いと速さ+22%", "+22% speed when a fish that can eat you is near"] },
  { id: "a23", r: "rare", kind: "p", icon: "🍔", v: { cap: 0.4, from: 2 }, name: ["대식가", "大食い", "Big Eater"], desc: ["크기 상한 +40%, 줄어들기 시작하는 크기 2배", "サイズ上限+40%、縮み始めるサイズ2倍", "+40% size cap and decay starts at 2× size"] },
  { id: "a24", r: "common", kind: "p", icon: "🚀", v: { ticks: 3 }, name: ["긴 돌진", "ロングダッシュ", "Long Dash"], desc: ["돌진 거리 +50%", "ダッシュ距離+50%", "+50% dash distance"] },
  { id: "a25", r: "rare", kind: "p", icon: "🍀", v: {}, name: ["행운의 비늘", "幸運のうろこ", "Lucky Scales"], desc: ["다음 증강부터 카드 4장 + 높은 등급이 더 잘 나옴", "次から4枚から選べる+高いランクが出やすい", "Future picks show 4 cards with better rarity odds"] },
  { id: "a26", r: "common", kind: "p", icon: "🥚", v: { m: 45 }, name: ["예비 알", "予備の卵", "Spare Egg"], desc: ["먹혀도 크기 10이 아니라 45에서 다시 시작", "食べられてもサイズ10でなく45から再開", "Respawn at size 45 instead of 10"] },
  { id: "a27", r: "epic", kind: "p", icon: "🎯", v: { from: 300, mul: 0.4 }, name: ["거물 사냥꾼", "大物ハンター", "Big Game Hunter"], desc: ["크기 300 넘는 물고기를 먹으면 +40% 더", "サイズ300超えの魚を食べると+40%", "+40% more from fish bigger than 300"] },
  { id: "a28", r: "common", kind: "p", icon: "💠", v: { cd: 15 }, name: ["공기 방울", "空気の泡", "Air Bubble"], desc: ["15초마다 방울 보호막 — 먹물·전기·끌림·낚싯바늘 1번 막음", "15秒ごとに泡バリア — 墨・電気・吸い寄せ・釣り針を1回防ぐ", "Every 15s a bubble blocks one ink, shock, pull or hook"] },
  { id: "a29", r: "rare", kind: "p", icon: "↩️", v: { cd: 9 }, name: ["역류", "逆流", "Reflex Escape"], desc: ["나를 먹을 수 있는 물고기가 바짝 붙으면 반대로 자동 돌진 (9초마다)", "自分を食べられる魚が密着すると反対へ自動ダッシュ(9秒ごと)", "Auto-dash away when a fish that can eat you gets too close (every 9s)"] },
  { id: "a30", r: "rare", kind: "p", icon: "🔥", v: { n: 18, w: 5, t: 4 }, name: ["식탐 폭주", "食欲暴走", "Feeding Frenzy"], desc: ["5초 안에 먹이 18개를 먹으면 4초간 속도 +25%·먹는 범위 +25%", "5秒以内にエサ18個で4秒間速さ+25%・食べる範囲+25%", "Eat 18 food in 5s for 4s of +25% speed and reach"] },
  // ---- 스킬 (Q/E) ----
  { id: "a31", r: "rare", kind: "a", icon: "🦑", cd: 14, v: { r: 280, t: 4 }, name: ["먹물", "墨", "Ink Cloud"], desc: ["먹물 구름(4초) — 안의 다른 물고기는 앞이 안 보이고 AI는 길을 잃음", "墨の雲(4秒) — 中の魚は前が見えずAIは迷う", "Ink cloud (4s) — fish inside can't see and AI loses track"] },
  { id: "a32", r: "epic", kind: "a", icon: "👻", cd: 18, v: { t: 3 }, name: ["투명 비늘", "透明うろこ", "Glass Scales"], desc: ["3초 동안 투명 (다른 사람 화면에서 사라짐)", "3秒間透明(他の人の画面から消える)", "Invisible for 3s (vanish from others' screens)"] },
  { id: "a33", r: "rare", kind: "a", icon: "⚡", cd: 16, v: { r: 240, t: 1.2, max: 2.5 }, name: ["전기 충격", "電気ショック", "Electro Shock"], desc: ["반경 안 물고기 1.2초 기절 (나보다 2.5배 큰 물고기 제외)", "範囲内の魚を1.2秒気絶(2.5倍以上大きい魚を除く)", "Stun nearby fish for 1.2s (except fish 2.5× your size)"] },
  { id: "a34", r: "legend", kind: "a", icon: "🦈", cd: 45, v: { t: 8, eat: 1.6, safe: 2, after: 0.1 }, name: ["상어 변신", "サメ変身", "Shark Form"], desc: ["8초 동안 나보다 1.6배 큰 물고기까지 먹고, 2배 큰 물고기에게도 안 먹힘. 끝나면 크기 10% 줄어듦", "8秒間1.6倍大きい魚まで食べられ、2倍の魚にも食べられない。終わるとサイズ10%減", "For 8s eat fish up to 1.6× your size and can't be eaten by fish under 2×. Lose 10% size after"] },
  { id: "a35", r: "common", kind: "a", icon: "🎣", cd: 12, v: { t: 4 }, name: ["미끼", "おとり", "Decoy"], desc: ["내 모습 미끼가 4초 동안 앞으로 헤엄침 (AI가 쫓아감)", "自分そっくりのおとりが4秒前へ泳ぐ(AIが追う)", "A decoy of you swims ahead for 4s (AI chases it)"] },
  { id: "a36", r: "rare", kind: "a", icon: "🌪️", cd: 15, v: { r: 340, slow: 300, t: 2 }, name: ["소용돌이", "うず潮", "Whirlpool"], desc: ["넓은 범위 먹이를 빨아들이고 가까운 물고기 2초 느리게", "広範囲のエサを吸い込み、近くの魚を2秒遅くする", "Suck in food from far away and slow nearby fish for 2s"] },
  { id: "a37", r: "rare", kind: "a", icon: "💥", cd: 12, v: { r: 280, f: 900 }, name: ["거품 폭발", "泡爆発", "Bubble Burst"], desc: ["주변 물고기를 세게 밀어냄 (상어도)", "周りの魚を強く押しのける(サメも)", "Blast nearby fish away (even sharks)"] },
  { id: "a38", r: "epic", kind: "a", icon: "🐡", cd: 14, v: { t: 3, mul: 1.6, slow: 0.4 }, name: ["복어 부풀기", "フグふくらみ", "Puff Up"], desc: ["3초 동안 1.6배로 부풀어 잘 안 먹힘 (대신 느려짐)", "3秒間1.6倍にふくらみ食べられにくい(遅くなる)", "Puff up 1.6× for 3s and become hard to eat (but slower)"] },
  { id: "a39", r: "epic", kind: "a", icon: "🚀", cd: 10, v: { ticks: 14, mul: 3 }, name: ["어뢰 돌진", "魚雷ダッシュ", "Torpedo"], desc: ["0.7초 동안 3배 속도로 일직선 돌진 (작아지지 않음)", "0.7秒間3倍速でまっすぐ突進(小さくならない)", "Charge straight at 3× speed for 0.7s (no size cost)"] },
  { id: "a40", r: "common", kind: "a", icon: "📡", cd: 20, v: { t: 5 }, name: ["수중 음파", "ソナー", "Sonar"], desc: ["5초 동안 넓게 보고 작은 지도에 모든 물고기 표시", "5秒間広く見えてミニマップに全魚を表示", "See far and show every fish on the minimap for 5s"] },
];
export const AUG = Object.fromEntries(AUGS.map(a => [a.id, a]));
export const RARITY_W = { common: 55, rare: 30, epic: 12, legend: 4 };
export const RARITY_NAME = { common: ["일반", "ノーマル", "Common"], rare: ["희귀", "レア", "Rare"], epic: ["영웅", "エピック", "Epic"], legend: ["전설", "レジェンド", "Legendary"] };

// 시너지 12종 (두 증강을 모두 가지면)
export const SYNERGIES = [
  { id: "s1", req: ["a06", "a38"], name: ["고슴도치", "ハリネズミ", "Hedgehog"], desc: ["부풀기 중 닿은 물고기는 크기 15%를 잃고 크게 튕겨남", "ふくらみ中に触れた魚はサイズ15%を失い大きく弾かれる", "While puffed, fish that touch you lose 15% and get blasted away"] },
  { id: "s2", req: ["a03", "a18"], name: ["심해의 왕", "深海の王", "Abyss King"], desc: ["1.05배만 커도 먹을 수 있음", "1.05倍大きければ食べられる", "Eat fish when you're just 1.05× their size"] },
  { id: "s3", req: ["a04", "a08"], name: ["바람 지느러미", "風のヒレ", "Wind Fins"], desc: ["돌진 쿨타임 추가 -30%, 속도 +5%", "ダッシュのクールタイムさらに-30%、速さ+5%", "Extra -30% dash cooldown and +5% speed"] },
  { id: "s4", req: ["a31", "a32"], name: ["그림자 사냥꾼", "影の狩人", "Shadow Hunter"], desc: ["투명 시간 +2초, 투명 중 지나간 자리에 먹물", "透明時間+2秒、透明中は通った跡に墨", "+2s invisibility and leave ink behind while invisible"] },
  { id: "s5", req: ["a07", "a36"], name: ["블랙홀", "ブラックホール", "Black Hole"], desc: ["소용돌이 범위 1.6배, 나보다 작은 물고기도 끌어당김", "うず潮の範囲1.6倍、小さい魚も吸い寄せる", "Whirlpool range ×1.6 and also pulls in smaller fish"] },
  { id: "s6", req: ["a15", "a02"], name: ["황금 왕", "黄金王", "Gold King"], desc: ["황금 먹이 3배", "黄金のエサ3倍", "Gold food ×3"] },
  { id: "s7", req: ["a34", "a17"], name: ["상어 왕", "サメの王", "Shark King"], desc: ["상어 변신 12초, 끝나도 안 줄어듦", "サメ変身12秒、終わっても縮まない", "Shark Form lasts 12s with no size loss after"] },
  { id: "s8", req: ["a33", "a21"], name: ["감전 독", "感電毒", "Venom Shock"], desc: ["전기 맞은 물고기는 크기 5%를 잃고 그만큼 내가 큼", "電気を受けた魚はサイズ5%を失い、その分自分が育つ", "Shocked fish lose 5% size and you gain it"] },
  { id: "s9", req: ["a11", "a23"], name: ["무한 성장", "無限成長", "Endless Growth"], desc: ["성장판 효과 2배", "成長期の効果2倍", "Growth Spurt doubled"] },
  { id: "s10", req: ["a13", "a32"], name: ["유령", "幽霊", "Phantom"], desc: ["투명 쿨타임 -40%, 보호색이 0.3초 만에", "透明のクールタイム-40%、保護色が0.3秒で", "-40% invisibility cooldown and camouflage in 0.3s"] },
  { id: "s11", req: ["a37", "a39"], name: ["폭풍 어뢰", "嵐の魚雷", "Storm Torpedo"], desc: ["어뢰 돌진 끝에 거품 폭발", "魚雷ダッシュの最後に泡爆発", "Torpedo ends with a Bubble Burst"] },
  { id: "s12", req: ["a05", "a28"], name: ["불사의 비늘", "不死のうろこ", "Undying Scales"], desc: ["비늘 갑옷이 30초마다 충전", "うろこの鎧が30秒ごとに充電", "Scale Armor recharges every 30s"] },
];
export const SYN = Object.fromEntries(SYNERGIES.map(s => [s.id, s]));

// 수조 이벤트 (겹치지 않게 무작위 순서 4번) + 2:20 보스 + 마지막 30초 먹이 축제
export const EVENT_AT = [40, 95, 200, 240];
export const BOSS_AT = 140, BOSS_LEN = 45;
// 보스 물고기 — 모두 함께 깎음 (몸에 부딪히거나 돌진·스킬로 피해). 쓰러뜨리면 먹이 폭포 + 기여 순 크기 보상
export const BOSSES = {
  whale: { icon: "🐋", hp: 600, hpPer: 45, r: 260, spd: 70, name: ["거대 고래", "巨大クジラ", "Giant Whale"], desc: ["입 앞의 물고기를 빨아들여 삼키고, 꼬리로 주변을 쳐요", "口の前の魚を吸い込んで飲み込み、尾で周りを叩く", "Sucks in and swallows fish in front of its mouth and slams with its tail"] },
  octo: { icon: "🐙", hp: 520, hpPer: 42, r: 220, spd: 60, name: ["대왕 문어", "大王ダコ", "King Octopus"], desc: ["먹물을 뿜고 다리 8개로 주변을 내리쳐요", "墨を吐き、8本の足で周りを叩きつける", "Sprays ink and slams the area with eight tentacles"] },
};
export const BOSS_IDS = Object.keys(BOSSES);
/** 소용돌이 해류가 (x,y)를 미는 속도 — 서버 이동과 화면 예측이 같은 식을 씀. w = [cx, cy, 세기 0~1] */
export function whirlVel(x, y, w) {
  if (!w) return [0, 0]; const dx = w[0] - x, dy = w[1] - y, d = Math.hypot(dx, dy) || 1, k = w[2] * Math.max(0, 1 - d / 2600);
  const pull = 190 * k * Math.min(1, d / 160), spin = 110 * k; return [dx / d * pull - dy / d * spin, dy / d * pull + dx / d * spin];
}
export const BOSS_REWARD = [0.3, 0.2, 0.12]; // 기여 1·2·3등 크기 보상 (그 밖 참여자 5%)
// 성장 단계 (화면 모습): 치어 → 성어 → 왕관 → 수조의 왕
export const STAGES = [{ m: 0, k: "fry", name: ["치어", "稚魚", "Fry"] }, { m: 25, k: "adult", name: ["성어", "成魚", "Adult"] }, { m: 1000, k: "crown", name: ["왕관 물고기", "王冠の魚", "Crowned"] }, { m: 2000, k: "king", name: ["수조의 왕", "水槽の王", "Tank King"] }];
export const stageOf = (m) => { let s = STAGES[0]; for (const x of STAGES) if (m >= x.m) s = x; return s.k; };
export const EVENTS = {
  shark: { icon: "🦈", t: 20, name: ["거대 상어 습격", "巨大ザメ襲来", "Giant Shark Attack"], desc: ["20초 동안 거대 상어가 큰 물고기를 노려요 — 도망치거나 거품 폭발·전기로 막아요", "20秒間、巨大ザメが大きな魚を狙う — 逃げるか泡爆発・電気で防ごう", "For 20s a giant shark hunts the biggest fish — flee or stop it with Bubble Burst or Shock"] },
  current: { icon: "🌊", t: 15, name: ["해류", "海流", "Ocean Current"], desc: ["15초 동안 모두 한쪽으로 밀려요", "15秒間みんな一方向へ流される", "Everyone drifts one way for 15s"] },
  gold: { icon: "✨", t: 12, name: ["황금 먹이 비", "黄金のエサの雨", "Golden Rain"], desc: ["표시된 곳에 황금 먹이가 쏟아져요 — 대혼전!", "マークの場所に黄金のエサが降る — 大混戦!", "Gold food pours down at the marked spots — chaos!"] },
  dark: { icon: "🌑", t: 20, name: ["깊은 바다", "深海", "The Deep"], desc: ["20초 동안 어두워져 내 주변만 보여요", "20秒間暗くなり周りしか見えない", "For 20s it goes dark — you only see around you"] },
  hook: { icon: "🪝", t: 15, name: ["낚싯바늘", "釣り針", "Fishing Hooks"], desc: ["큰 물고기를 노리는 낚싯바늘 — 빨간 원에서 피해요 (맞으면 크기 35% 잃음)", "大きな魚を狙う釣り針 — 赤い円から逃げよう(当たるとサイズ35%減)", "Hooks target big fish — dodge the red circle (lose 35% size if hit)"] },
  jelly: { icon: "🎐", t: 18, name: ["해파리 떼", "クラゲの群れ", "Jellyfish Swarm"], desc: ["해파리 떼가 수조를 가로질러요 — 닿으면 1초 감전되고 크기 5%를 잃어요", "クラゲの群れが水槽を横切る — 触れると1秒感電してサイズ5%減", "A jellyfish swarm drifts across the tank — touch one and you're shocked for 1s and lose 5%"] },
  whirl: { icon: "🌀", t: 15, name: ["소용돌이 해류", "渦潮", "Maelstrom"], desc: ["수조 한가운데로 빨려 들어가요 — 가운데엔 먹이가 쏟아지지만 큰 물고기도 몰려요", "水槽の中心へ吸い込まれる — 中心にはエサが出るが大きな魚も集まる", "Everything is pulled toward one spot — food pours into the center, but so do big fish"] },
};
export const EVENT_IDS = Object.keys(EVENTS);
export const FEAST_AT = 270; // 마지막 30초 먹이 2배

// AI 물고기
export const BOT_LV = { easy: { name: ["쉬움", "やさしい", "Easy"], aim: 0.55, dash: 0.25, see: 0.75 }, normal: { name: ["보통", "ふつう", "Normal"], aim: 0.8, dash: 0.55, see: 1 }, hard: { name: ["어려움", "むずかしい", "Hard"], aim: 1, dash: 0.9, see: 1.2 } };
export const BOT_NAMES = [
  ["방랑 고등어", "さすらいサバ", "Wandering Mackerel"], ["배고픈 멸치", "腹ペコイワシ", "Hungry Anchovy"], ["수줍은 광어", "内気なヒラメ", "Shy Flounder"], ["번개 꽁치", "稲妻サンマ", "Lightning Saury"], ["대장 참치", "親分マグロ", "Boss Tuna"],
  ["졸린 붕어", "眠いフナ", "Sleepy Carp"], ["용감한 송사리", "勇敢なメダカ", "Brave Minnow"], ["심술 쏘가리", "意地悪ケツギョ", "Grumpy Perch"], ["반짝 은어", "キラキラアユ", "Shiny Sweetfish"], ["먹보 메기", "食いしん坊ナマズ", "Greedy Catfish"],
  ["날쌘 연어", "すばしこいサケ", "Swift Salmon"], ["느긋한 개복치", "のんびりマンボウ", "Chill Sunfish"], ["꼬마 니모", "ちびクマノミ", "Tiny Clownfish"], ["얌체 볼락", "ちゃっかりメバル", "Sly Rockfish"], ["떠돌이 정어리", "流れ者イワシ", "Drifter Sardine"],
  ["수다쟁이 도미", "おしゃべりタイ", "Chatty Snapper"], ["까칠 가시고기", "トゲトゲトゲウオ", "Prickly Stickleback"], ["공주 금붕어", "姫キンギョ", "Princess Goldfish"], ["철벽 우럭", "鉄壁カサゴ", "Ironclad Scorpionfish"], ["새벽 갈치", "夜明けタチウオ", "Dawn Cutlassfish"],
  ["욕심쟁이 농어", "欲張りスズキ", "Greedy Seabass"], ["번쩍 날치", "ピカッとトビウオ", "Flash Flyingfish"], ["말랑 해파리", "ぷにぷにクラゲ", "Squishy Jelly"], ["깊은 곳 아귀", "深海アンコウ", "Deep Anglerfish"], ["점박이 가자미", "まだらカレイ", "Spotted Sole"],
  ["무지개 송어", "ニジマス", "Rainbow Trout"], ["씩씩한 피라미", "元気なオイカワ", "Plucky Chub"], ["조용한 잉어", "静かなコイ", "Quiet Koi"], ["호기심 쥐치", "好奇心カワハギ", "Curious Filefish"], ["늦잠 숭어", "寝坊ボラ", "Late Mullet"],
  ["달빛 학꽁치", "月光サヨリ", "Moonlit Halfbeak"], ["모험가 대구", "冒険家タラ", "Explorer Cod"], ["소심한 빙어", "小心ワカサギ", "Timid Smelt"], ["꿈꾸는 문어", "夢見るタコ", "Dreamy Octopus"], ["뚱땡이 복어", "まんまるフグ", "Chubby Puffer"],
  ["번득 청어", "ギラリニシン", "Gleaming Herring"], ["별무늬 쏨뱅이", "星柄カサゴ", "Starry Rockfish"], ["바다 나그네", "海の旅人", "Sea Wanderer"], ["모래 속 장어", "砂の中ウナギ", "Sand Eel"], ["떼쟁이 전갱이", "駄々っ子アジ", "Fussy Jack"],
  ["번영 방어", "繁栄ブリ", "Prosperous Yellowtail"], ["유리 망둥이", "ガラスハゼ", "Glass Goby"], ["파도 타는 삼치", "波乗りサワラ", "Surfing Mackerel"], ["깜빡 열기", "うっかりメバル", "Forgetful Perch"], ["황제 다랑어", "皇帝マグロ", "Emperor Tuna"],
  ["번개 쥐노래미", "稲妻アイナメ", "Zappy Greenling"], ["산호 지킴이", "サンゴの番人", "Reef Guard"], ["작은 거인", "小さな巨人", "Little Giant"], ["밤바다 은갈치", "夜の銀タチ", "Night Silverfish"], ["행운 잉어", "幸運のコイ", "Lucky Koi"],
];

// 스트리머 후원 (금액이 정확히 같을 때만)
export const STREAM_KINDS = ["gold", "grow", "shark", "hook", "donor"];
export const STREAM_DEFAULT = { gold: 1000, grow: 2000, shark: 3000, hook: 5000, donor: 10000 };
export const STREAM_LABEL = {
  gold: ["✨ 황금 먹이 비 (대상 근처)", "✨ 黄金のエサの雨(対象の近く)", "✨ Golden rain (near target)"],
  grow: ["🍖 대상 크기 +25%", "🍖 対象のサイズ+25%", "🍖 Target +25% size"],
  shark: ["🦈 상어가 대상을 노림 (12초)", "🦈 サメが対象を狙う(12秒)", "🦈 Shark hunts the target (12s)"],
  hook: ["🪝 낚싯바늘 (대상)", "🪝 釣り針(対象)", "🪝 Fishing hook (target)"],
  donor: ["🐋 후원자 이름 큰 물고기 등장", "🐋 スポンサー名の大きな魚が登場", "🐋 Big fish with the donor's name appears"],
};

// 모드
export const MODES = ["ffa", "team"];
export const TEAM_COL = ["#4dabf7", "#ff6b6b", "#51cf66", "#fcc419", "#cc5de8"];
export const TEAM_NAME = [["파랑 팀", "青チーム", "Blue"], ["빨강 팀", "赤チーム", "Red"], ["초록 팀", "緑チーム", "Green"], ["노랑 팀", "黄チーム", "Yellow"], ["보라 팀", "紫チーム", "Purple"]];

// 업적 26종 · 보상 = 물고기 색(11) 또는 칭호(15) — 서버가 판 결과로만 기록 (aq-progress.js, 표 aq_progress)
export const ACH_COLORS = {
  coral:  { col: "#ff7f6b", name: ["산호", "サンゴ", "Coral"] },
  ocean:  { col: "#1c7ed6", name: ["심해 파랑", "深海ブルー", "Deep Blue"] },
  lava:   { col: "#ff4b1f", name: ["용암", "溶岩", "Lava"] },
  gold:   { col: "#ffc928", name: ["황금", "黄金", "Gold"] },
  aurora: { col: "#3fffd2", name: ["오로라", "オーロラ", "Aurora"] },
  royal:  { col: "#7b2ff7", name: ["왕실 보라", "ロイヤルパープル", "Royal Purple"] },
  sun:    { col: "#ffe066", name: ["햇살", "陽ざし", "Sunbeam"] },
  abyss:  { col: "#1b1f3b", name: ["심연", "深淵", "Abyss"] },
  cactus: { col: "#2f9e44", name: ["선인장", "サボテン", "Cactus"] },
  prism:  { col: "#ff9ff3", name: ["프리즘", "プリズム", "Prism"] },
  blood:  { col: "#c92a2a", name: ["붉은 이빨", "赤い牙", "Red Fang"] },
};
export const ACHS = [
  { id: "f01", k: "plays", n: 1, rw: ["t"], icon: "🥚", name: ["갓 태어난 물고기", "生まれたての魚", "Hatchling"], desc: ["첫 판 끝내기", "初めての1回を終える", "Finish your first run"] },
  { id: "f02", k: "plays", n: 10, rw: ["c", "coral"], icon: "🐠", name: ["수조 단골", "水槽の常連", "Tank Regular"], desc: ["10판 끝내기", "10回終える", "Finish 10 runs"] },
  { id: "f03", k: "plays", n: 50, rw: ["t"], icon: "🌊", name: ["바다의 터줏대감", "海の主", "Old Salt"], desc: ["50판 끝내기", "50回終える", "Finish 50 runs"] },
  { id: "f04", k: "eats", n: 1, rw: ["t"], icon: "🍽️", name: ["첫 사냥", "初めての狩り", "First Catch"], desc: ["물고기 처음 먹기", "初めて魚を食べる", "Eat your first fish"] },
  { id: "f05", k: "eats", n: 100, rw: ["c", "ocean"], icon: "🦈", name: ["바다 사냥꾼", "海のハンター", "Sea Hunter"], desc: ["물고기 모두 100마리 먹기", "魚を合計100匹食べる", "Eat 100 fish in total"] },
  { id: "f06", k: "eats", n: 500, rw: ["t"], icon: "👑", name: ["최상위 포식자", "頂点捕食者", "Apex Predator"], desc: ["물고기 모두 500마리 먹기", "魚を合計500匹食べる", "Eat 500 fish in total"] },
  { id: "f07", k: "bEats", n: 20, rw: ["c", "lava"], icon: "🔥", name: ["폭식", "暴食", "Binge"], desc: ["한 판에 물고기 20마리 먹기", "1回で魚を20匹食べる", "Eat 20 fish in one run"] },
  { id: "f08", k: "bEats", n: 50, rw: ["t"], icon: "🌋", name: ["바다의 블랙홀", "海のブラックホール", "Ocean Black Hole"], desc: ["한 판에 물고기 50마리 먹기", "1回で魚を50匹食べる", "Eat 50 fish in one run"] },
  { id: "f09", k: "bBest", n: 1000, rw: ["c", "gold"], icon: "👑", name: ["왕관을 쓰다", "王冠をかぶる", "Crowned"], desc: ["한 판에 크기 1,000 넘기", "1回でサイズ1,000を超える", "Reach size 1,000 in one run"] },
  { id: "f10", k: "bBest", n: 2000, rw: ["t"], icon: "🏰", name: ["수조의 왕", "水槽の王", "Tank King"], desc: ["한 판에 크기 2,000 넘기", "1回でサイズ2,000を超える", "Reach size 2,000 in one run"] },
  { id: "f11", k: "bBest", n: 4000, rw: ["c", "aurora"], icon: "🌌", name: ["바다의 전설", "海の伝説", "Legend of the Sea"], desc: ["한 판에 크기 4,000 넘기", "1回でサイズ4,000を超える", "Reach size 4,000 in one run"] },
  { id: "f12", k: "wins", n: 1, rw: ["t"], icon: "🥇", name: ["1등 물고기", "1位の魚", "Top Fish"], desc: ["개인전 1등 (사람 2명 이상 또는 AI 20마리 이상)", "個人戦1位(人2人以上またはAI20匹以上)", "Finish 1st in free-for-all (2+ players or 20+ AI)"] },
  { id: "f13", k: "wins", n: 10, rw: ["c", "royal"], icon: "🏆", name: ["연속 왕좌", "連続王座", "Reigning Champion"], desc: ["개인전 1등 10번", "個人戦1位10回", "Finish 1st 10 times"] },
  { id: "f14", k: "teamWins", n: 5, rw: ["t"], icon: "🤝", name: ["무리의 힘", "群れの力", "Strength of the School"], desc: ["팀전 5번 이기기", "チーム戦で5回勝つ", "Win 5 team battles"] },
  { id: "f15", k: "gold", n: 100, rw: ["c", "sun"], icon: "💰", name: ["황금 수집가", "黄金コレクター", "Gold Collector"], desc: ["황금 먹이 모두 100개 먹기", "黄金のエサを合計100個食べる", "Eat 100 gold food in total"] },
  { id: "f16", k: "krill", n: 500, rw: ["t"], icon: "🦐", name: ["새우 사냥꾼", "エビハンター", "Krill Hunter"], desc: ["새우 모두 500마리 먹기", "エビを合計500匹食べる", "Eat 500 krill in total"] },
  { id: "f17", k: "bossKills", n: 1, rw: ["t"], icon: "🐋", name: ["고래 사냥꾼", "クジラハンター", "Whale Hunter"], desc: ["보스 물고기 쓰러뜨리기 (함께)", "ボスの魚を倒す(みんなで)", "Help defeat a boss fish"] },
  { id: "f18", k: "bossTop", n: 1, rw: ["c", "abyss"], icon: "🗡️", name: ["보스 킬러", "ボスキラー", "Boss Slayer"], desc: ["보스 기여도 1등", "ボスの貢献度1位", "Top boss damage"] },
  { id: "f19", k: "armor", n: 5, rw: ["t"], icon: "🛡️", name: ["질긴 비늘", "しぶというろこ", "Tough Scales"], desc: ["비늘 갑옷으로 모두 5번 버티기", "うろこの鎧で合計5回耐える", "Survive 5 times with Scale Armor"] },
  { id: "f20", k: "spine", n: 20, rw: ["c", "cactus"], icon: "🌵", name: ["가시 투성이", "トゲだらけ", "All Spikes"], desc: ["가시로 모두 20번 튕겨내기", "トゲで合計20回弾き返す", "Bounce 20 attackers with spines"] },
  { id: "f21", k: "revenge", n: 1, rw: ["t"], icon: "😤", name: ["복수의 지느러미", "復讐のヒレ", "Fin of Vengeance"], desc: ["나를 먹은 물고기를 다시 먹기", "自分を食べた魚を食べ返す", "Eat the fish that ate you"] },
  { id: "f22", k: "noDeath", n: 1, rw: ["t"], icon: "😇", name: ["불사신", "不死身", "Untouchable"], desc: ["한 번도 안 먹히고 크기 800 넘기", "一度も食べられずサイズ800を超える", "Reach size 800 without ever being eaten"] },
  { id: "f23", k: "bLeg", n: 2, rw: ["c", "prism"], icon: "✨", name: ["전설 수집가", "レジェンド収集家", "Legend Collector"], desc: ["한 판에 전설 증강 2개", "1回でレジェンド2個", "Hold 2 legendary augments in one run"] },
  { id: "f24", k: "bSyn", n: 3, rw: ["t"], icon: "✦", name: ["시너지 장인", "シナジー職人", "Synergy Master"], desc: ["한 판에 시너지 3개", "1回でシナジー3個", "Activate 3 synergies in one run"] },
  { id: "f25", k: "humans", n: 10, rw: ["c", "blood"], icon: "🩸", name: ["사람 사냥꾼", "プレイヤーハンター", "Player Hunter"], desc: ["다른 사람 물고기 모두 10번 먹기", "他の人の魚を合計10回食べる", "Eat other players’ fish 10 times"] },
  { id: "f26", k: "dodge", n: 5, rw: ["t"], icon: "🎣", name: ["낚시 피하기 달인", "釣り針よけの達人", "Hook Dodger"], desc: ["나를 노린 낚싯바늘 모두 5번 피하기", "自分を狙った釣り針を合計5回よける", "Dodge 5 hooks aimed at you"] },
];
export const ACH = Object.fromEntries(ACHS.map(a => [a.id, a]));
export const achHas = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const ACH_SUM = ["plays", "eats", "wins", "teamWins", "gold", "krill", "bossKills", "bossTop", "armor", "spine", "revenge", "noDeath", "humans", "dodge"];
const ACH_MAX = ["bEats", "bBest", "bLeg", "bSyn"];
/** 한 판 결과를 기록에 더함. run = { win, teamWin, eats, best, gold, krill, bossKill, bossTop, armor, spine, revenge, deaths, humans, dodge, leg, syn } */
export function achApply(st, run) {
  const s = { ...(st && typeof st === "object" ? st : {}) }, num = (v) => (Number.isFinite(+v) && +v > 0 ? +v : 0);
  const add = { plays: 1, eats: num(run.eats), wins: run.win ? 1 : 0, teamWins: run.teamWin ? 1 : 0, gold: num(run.gold), krill: num(run.krill), bossKills: run.bossKill ? 1 : 0, bossTop: run.bossTop ? 1 : 0,
    armor: num(run.armor), spine: num(run.spine), revenge: num(run.revenge), noDeath: !num(run.deaths) && num(run.best) >= 800 ? 1 : 0, humans: num(run.humans), dodge: num(run.dodge) };
  for (const k of ACH_SUM) s[k] = num(s[k]) + (add[k] || 0);
  const best = { bEats: num(run.eats), bBest: Math.round(num(run.best)), bLeg: num(run.leg), bSyn: num(run.syn) };
  for (const k of ACH_MAX) s[k] = Math.max(num(s[k]), best[k]);
  return s;
}
export const achDone = (st) => ACHS.filter(a => (Number(st?.[a.k]) || 0) >= a.n).map(a => a.id);
/** 해금된 업적으로 쓸 수 있는 꾸미기인지 확인 → { c: 색 id|null, t: 칭호(업적 id)|null } */
export function achEquip(unlocked, want) {
  const u = new Set(unlocked || []), out = { c: null, t: null };
  const c = String(want?.c || ""), t = String(want?.t || "");
  if (achHas(ACH_COLORS, c) && ACHS.some(a => a.rw[0] === "c" && a.rw[1] === c && u.has(a.id))) out.c = c;
  if (achHas(ACH, t) && ACH[t].rw[0] === "t" && u.has(t)) out.t = t;
  return out;
}
