// =========================
// DUO 증강 슬롯 타워 — 데이터 (2026-11-21)
// · 서버(worldcup-backend/src/slot-data.js)와 화면(홈페이지 제작/js/slot/st-data.js)이 같은 파일
// · 이름·설명은 [한, 日, EN]
// · 플듀 오리지널: 네온 오락실 탑을 한 층씩 올라감. 층마다 정해진 횟수만 돌리고, 끝에 통행료를 내야 다음 층
// =========================
export const ROWS = 3, COLS = 5;
export const SPINS = 6;            // 층마다 돌리는 횟수
export const START_COINS = 15;
export const MAX_AUGS = 7;
export const FUSE_MAX = 6;         // 폭탄 도화선 (가득 차면 펑 → 코인 25% 잃음)
export const BOOM_LOSS = 0.25;
export const MULT = { 3: 1, 4: 4, 5: 12 };   // 한 줄에 같은 그림 3·4·5개
/** 층 통행료 (보스 층은 1.5배) */
export const tollOf = (f) => Math.round((7 * Math.pow(1.4, f - 1) + f * 4) * (f % 5 === 0 ? 1.4 : 1));
/** 층 끝 이자: 가진 코인 10개마다 1 (최대 5, 증강으로 늘어남) */
export const INTEREST = { per: 10, cap: 5 };

// 그림 (w = 나올 무게, v = 한 칸 값)
export const SYMS = {
  cherry: { v: 4, w: 40, col: "#ff4d6d", name: ["체리", "チェリー", "Cherry"], fruit: true },
  lemon:  { v: 4, w: 38, col: "#ffd43b", name: ["레몬", "レモン", "Lemon"], fruit: true },
  bell:   { v: 6, w: 22, col: "#ffa94d", name: ["종", "ベル", "Bell"] },
  melon:  { v: 8, w: 18, col: "#51cf66", name: ["수박", "スイカ", "Melon"], fruit: true },
  star:   { v: 12, w: 12, col: "#fcc419", name: ["별", "星", "Star"] },
  gem:    { v: 20, w: 7, col: "#4dabf7", name: ["보석", "宝石", "Gem"] },
  seven:  { v: 35, w: 4, col: "#e03131", name: ["세븐", "セブン", "Seven"] },
  wild:   { v: 0, w: 10, col: "#cc5de8", name: ["와일드", "ワイルド", "Wild"] },
  bomb:   { v: 0, w: 5, col: "#495057", name: ["폭탄", "爆弾", "Bomb"] },
  skull:  { v: 0, w: 0, col: "#e9ecef", name: ["해골", "ドクロ", "Skull"] }, // 저주 그림 (층이 오를수록 많아짐 — skullW)
};
export const SYM_IDS = Object.keys(SYMS);
// 줄: [행, 열] 5칸 — 가로 3 · V · ^ (증강으로 W·M 추가)
export const LINES = {
  top: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
  mid: [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]],
  bot: [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]],
  v:   [[0, 0], [1, 1], [2, 2], [1, 3], [0, 4]],
  up:  [[2, 0], [1, 1], [0, 2], [1, 3], [2, 4]],
};
export const EXTRA_LINES = {
  w: [[0, 0], [2, 1], [0, 2], [2, 3], [0, 4]],
  m: [[2, 0], [0, 1], [2, 2], [0, 3], [2, 4]],
};
export const LINE_NAME = { top: ["윗줄", "上段", "Top"], mid: ["가운데 줄", "中段", "Middle"], bot: ["아랫줄", "下段", "Bottom"], v: ["V자", "V字", "V"], up: ["^자", "∧字", "Peak"], w: ["W자", "W字", "W"], m: ["M자", "M字", "M"] };

// 증강 40종 — r: common·rare·epic·legend · price는 상점 기본 가격(층이 오르면 조금씩 비싸짐)
export const RARITY_PRICE = { common: 7, rare: 13, epic: 22, legend: 36 };
export const RARITY_W = { common: 55, rare: 30, epic: 12, legend: 4 };
export const RARITY_NAME = { common: ["일반", "ノーマル", "Common"], rare: ["희귀", "レア", "Rare"], epic: ["영웅", "エピック", "Epic"], legend: ["전설", "レジェンド", "Legendary"] };
export const AUGS = [
  // 그림 값
  { id: "a01", r: "common", icon: "🍒", name: ["체리 농장", "チェリー農園", "Cherry Farm"], desc: ["체리 값 +4", "チェリーの価値+4", "Cherry value +4"] },
  { id: "a02", r: "common", icon: "🍋", name: ["레몬 착즙기", "レモン搾り機", "Lemon Press"], desc: ["레몬 값 +4", "レモンの価値+4", "Lemon value +4"] },
  { id: "a03", r: "common", icon: "🔔", name: ["황금 종", "黄金のベル", "Golden Bell"], desc: ["종 값 +6", "ベルの価値+6", "Bell value +6"] },
  { id: "a04", r: "rare", icon: "🍉", name: ["수박 잔치", "スイカ祭り", "Melon Feast"], desc: ["수박 값 2배", "スイカの価値2倍", "Melon value ×2"] },
  { id: "a05", r: "rare", icon: "⭐", name: ["별빛 무대", "星明かりの舞台", "Starlight Stage"], desc: ["별 값 +10", "星の価値+10", "Star value +10"] },
  { id: "a06", r: "epic", icon: "💎", name: ["보석 세공", "宝石細工", "Gem Cutter"], desc: ["보석 값 2배", "宝石の価値2倍", "Gem value ×2"] },
  { id: "a07", r: "epic", icon: "7️⃣", name: ["행운의 7", "ラッキー7", "Lucky Seven"], desc: ["세븐 값 2배", "セブンの価値2倍", "Seven value ×2"] },
  { id: "a08", r: "rare", icon: "🧺", name: ["과일 바구니", "フルーツバスケット", "Fruit Basket"], desc: ["체리·레몬·수박이 서로 같은 그림으로 이어짐 (값은 그중 높은 것)", "チェリー・レモン・スイカが同じ絵として揃う(価値は高い方)", "Cherries, lemons and melons count as the same symbol (pays the highest)"] },
  // 확률
  { id: "a09", r: "rare", icon: "🃏", name: ["와일드 인쇄기", "ワイルド印刷機", "Wild Press"], desc: ["와일드가 훨씬 자주 나옴", "ワイルドがよく出る", "Wilds appear much more often"] },
  { id: "a10", r: "common", icon: "🍒", name: ["체리 씨앗", "チェリーの種", "Cherry Seeds"], desc: ["체리가 더 자주 나옴", "チェリーが出やすい", "Cherries appear more often"] },
  { id: "a11", r: "rare", icon: "🌟", name: ["별자리", "星座", "Constellation"], desc: ["별이 더 자주 나옴", "星が出やすい", "Stars appear more often"] },
  { id: "a12", r: "epic", icon: "⛏️", name: ["보석 광산", "宝石鉱山", "Gem Mine"], desc: ["보석이 더 자주 나옴", "宝石が出やすい", "Gems appear more often"] },
  { id: "a13", r: "common", icon: "🚫", name: ["레몬 금지", "レモン禁止", "No Lemons"], desc: ["레몬이 덜 나옴 (다른 그림이 잘 맞음)", "レモンが出にくい(ほかが揃いやすい)", "Fewer lemons (other symbols line up more)"] },
  { id: "a14", r: "common", icon: "🔕", name: ["종 떼기", "ベル外し", "Muted Bells"], desc: ["종이 덜 나옴", "ベルが出にくい", "Fewer bells"] },
  // 줄
  { id: "a15", r: "common", icon: "➖", name: ["가운데 조명", "センターライト", "Center Spotlight"], desc: ["가운데 줄 2배", "中段が2倍", "Middle row pays ×2"] },
  { id: "a16", r: "rare", icon: "↗️", name: ["대각선 전문가", "斜めの達人", "Diagonal Pro"], desc: ["V자·^자 줄 2배", "V字・∧字が2倍", "V and Peak lines pay ×2"] },
  { id: "a17", r: "rare", icon: "〰️", name: ["지그재그", "ジグザグ", "Zigzag"], desc: ["W자·M자 줄 2개 추가", "W字・M字の2本を追加", "Adds W and M lines"] },
  { id: "a18", r: "epic", icon: "🪞", name: ["거울 릴", "鏡のリール", "Mirror Reels"], desc: ["줄을 오른쪽에서부터도 셈", "右からも数える", "Lines also count from the right"] },
  { id: "a19", r: "rare", icon: "⬇️", name: ["세로 줄", "縦の列", "Columns"], desc: ["한 열 3칸이 같으면 그 값 ×3", "1列3マスが揃うと価値×3", "A full matching column pays value ×3"] },
  { id: "a20", r: "rare", icon: "🖐️", name: ["다섯 손가락", "五本指", "High Five"], desc: ["5개 맞춤 보상 2배 더", "5つ揃いがさらに2倍", "5-in-a-row pays double"] },
  { id: "a21", r: "common", icon: "4️⃣", name: ["네 잎 보너스", "四つ揃いボーナス", "Four Bonus"], desc: ["4개 맞출 때마다 +15", "4つ揃うたび+15", "+15 for every 4-in-a-row"] },
  { id: "a22", r: "epic", icon: "🔗", name: ["연쇄", "連鎖", "Chain Reaction"], desc: ["연달아 맞출 때마다 +25% (꽝이면 처음부터)", "連続で当たるたび+25%(外れでリセット)", "+25% for each winning spin in a row (resets on a miss)"] },
  { id: "a23", r: "rare", icon: "🎆", name: ["콤보 장인", "コンボ職人", "Combo Artist"], desc: ["한 번에 3줄 이상 맞으면 1.5배", "一度に3本以上で1.5倍", "×1.5 when 3+ lines hit at once"] },
  // 돈
  { id: "a24", r: "common", icon: "🏦", name: ["저축 통장", "貯金通帳", "Savings Account"], desc: ["이자 최대 +5, 8개마다 1", "利子上限+5、8枚ごとに1", "Interest cap +5, 1 per 8 coins"] },
  { id: "a25", r: "common", icon: "🩹", name: ["꽝 보험", "ハズレ保険", "Miss Insurance"], desc: ["꽝이면 +8", "外れたら+8", "+8 on a losing spin"] },
  { id: "a26", r: "common", icon: "🪙", name: ["주운 동전", "拾ったコイン", "Lucky Penny"], desc: ["돌릴 때마다 25% 확률로 +15", "回すたび25%で+15", "25% chance of +15 each spin"] },
  { id: "a27", r: "common", icon: "🏷️", name: ["할인 쿠폰", "割引クーポン", "Discount Coupon"], desc: ["상점 가격 -25%", "ショップ価格-25%", "Shop prices -25%"] },
  { id: "a28", r: "common", icon: "🎫", name: ["단골 손님", "常連客", "Regular"], desc: ["상점마다 새로고침 1번 무료", "ショップごとに更新1回無料", "One free reroll per shop"] },
  { id: "a29", r: "rare", icon: "🤝", name: ["통행료 흥정", "通行料の値切り", "Toll Haggler"], desc: ["통행료 -12%", "通行料-12%", "Tolls -12%"] },
  { id: "a30", r: "epic", icon: "📈", name: ["복리", "複利", "Compound Interest"], desc: ["층 끝에 가진 코인 +10% (이자와 따로)", "階の終わりに所持コイン+10%(利子とは別)", "+10% of your coins at the end of each floor (on top of interest)"] },
  // 폭탄
  { id: "a31", r: "common", icon: "🧯", name: ["폭탄 해체반", "爆弾処理班", "Bomb Squad"], desc: ["도화선 +3칸", "導火線+3", "Fuse length +3"] },
  { id: "a32", r: "rare", icon: "🧨", name: ["폭탄 수집가", "爆弾コレクター", "Bomb Collector"], desc: ["폭탄 하나 나올 때마다 +10 (도화선은 그대로 탐)", "爆弾1つごとに+10(導火線は進む)", "+10 for every bomb shown (the fuse still burns)"] },
  { id: "a33", r: "epic", icon: "🎇", name: ["불꽃놀이 쇼", "花火ショー", "Fireworks Show"], desc: ["폭탄이 터지면 잃는 대신 층×20 코인", "爆発したら失う代わりに階×20コイン", "When the fuse blows you gain floor×20 coins instead of losing"] },
  { id: "a34", r: "rare", icon: "🛡️", name: ["안전 릴", "安全リール", "Safety Reels"], desc: ["폭탄이 덜 나옴", "爆弾が出にくい", "Fewer bombs"] },
  // 스핀·특수
  { id: "a35", r: "rare", icon: "➕", name: ["추가 레버", "追加レバー", "Extra Lever"], desc: ["층마다 돌리기 +1", "各階で回す回数+1", "+1 spin per floor"] },
  { id: "a36", r: "rare", icon: "↩️", name: ["다시 한 번", "もう一回", "One More Time"], desc: ["층마다 처음 꽝 한 번은 저절로 다시 돌림", "各階の最初の外れは自動で回し直し", "Your first miss each floor re-spins automatically"] },
  { id: "a37", r: "epic", icon: "🐈", name: ["행운 고양이", "招き猫", "Lucky Cat"], desc: ["돌릴 때마다 무작위 한 칸이 와일드", "回すたびランダム1マスがワイルド", "One random cell becomes Wild every spin"] },
  { id: "a38", r: "legend", icon: "💰", name: ["잭팟", "ジャックポット", "Jackpot"], desc: ["5개 맞춤이 나오면 그 스핀 전체 5배", "5つ揃いが出たらそのスピン全体5倍", "Any 5-in-a-row makes that whole spin ×5"] },
  { id: "a39", r: "legend", icon: "👑", name: ["수집왕", "コレクター王", "Collector King"], desc: ["가진 증강 하나마다 모든 그림 값 +2", "持っているオーグメント1つごとに全絵柄+2", "+2 to every symbol's value per augment you own"] },
  { id: "a40", r: "legend", icon: "🎯", name: ["마지막 한 방", "最後の一撃", "Final Shot"], desc: ["층의 마지막 돌리기 3배", "階の最後の回しが3倍", "The last spin of each floor pays ×3"] },
];
AUGS.push(
  { id: "a41", r: "common", icon: "🧲", name: ["말굽 부적", "蹄鉄のお守り", "Horseshoe Charm"], desc: ["행운 +2", "幸運+2", "Luck +2"] },
  { id: "a42", r: "rare", icon: "🐇", name: ["토끼 발", "ウサギの足", "Rabbit's Foot"], desc: ["행운 +3, 해골이 덜 나옴", "幸運+3、ドクロが出にくい", "Luck +3 and fewer skulls"] },
  { id: "a43", r: "rare", icon: "🧿", name: ["퇴마 부적", "魔除けのお札", "Ward Charm"], desc: ["층마다 저주 1번을 막음", "各階で呪いを1回防ぐ", "Blocks one curse per floor"] },
  { id: "a44", r: "epic", icon: "💀", name: ["해골 수집가", "ドクロコレクター", "Skull Collector"], desc: ["해골 하나 나올 때마다 +12", "ドクロ1つごとに+12", "+12 for every skull shown"] },
  { id: "a45", r: "common", icon: "🔑", name: ["금고 열쇠", "金庫の鍵", "Vault Key"], desc: ["금고 이자 +10%p", "金庫の利子+10%p", "Vault interest +10 points"] },
  { id: "a46", r: "epic", icon: "🌠", name: ["행운의 물결", "幸運の波", "Lucky Streak"], desc: ["맞힐 때마다 이번 층 행운 +1", "当たるたびこの階の幸運+1", "Each win gives +1 Luck for this floor"] },
  { id: "a47", r: "rare", icon: "📻", name: ["단골 청취자", "常連リスナー", "Loyal Listener"], desc: ["오락실 방송 거래가 하나 더", "ゲーセン放送の取引が1つ増える", "One more Arcade Broadcast deal"] },
  { id: "a48", r: "common", icon: "🎒", name: ["큰 가방", "大きなカバン", "Big Bag"], desc: ["아이템 칸 +2", "アイテム枠+2", "+2 item slots"] },
  { id: "a49", r: "rare", icon: "🧃", name: ["아이템 상인", "アイテム商人", "Item Dealer"], desc: ["상점마다 아이템 하나 공짜", "ショップごとにアイテム1つ無料", "One free item every shop"] },
  { id: "a50", r: "legend", icon: "🌈", name: ["무지개 행운", "虹の幸運", "Rainbow Luck"], desc: ["행운 +6, 저주가 안 걸림", "幸運+6、呪われない", "Luck +6 and immune to curses"] },
);
export const AUG = Object.fromEntries(AUGS.map(a => [a.id, a]));
/** 증강 레벨업: 같은 증강을 또 사면 2단계 (효과가 커짐). 레벨업이 안 되는 증강 */
export const NO_LEVEL = new Set(["a08", "a17", "a18", "a19", "a36", "a43", "a47", "a50"]);
export const MAX_LV = 2;

// 층 이벤트 (보스 층 = 5의 배수)
export const FLOOR_EVENTS = {
  calm:   { icon: "🌙", name: ["조용한 층", "静かな階", "Quiet Floor"], desc: ["특별한 일 없음", "特に何もなし", "Nothing special"] },
  fruit:  { icon: "🍓", name: ["과일 축제", "フルーツ祭り", "Fruit Festival"], desc: ["과일 값 2배", "フルーツの価値2倍", "Fruit symbols pay double"] },
  bombs:  { icon: "💣", name: ["폭탄 비", "爆弾の雨", "Bomb Rain"], desc: ["폭탄이 많이 나옴", "爆弾が多い", "Lots of bombs"] },
  gold:   { icon: "✨", name: ["황금 층", "黄金の階", "Golden Floor"], desc: ["모든 그림 값 +3", "全絵柄+3", "Every symbol +3"] },
  broken: { icon: "🔧", name: ["고장 난 릴", "壊れたリール", "Jammed Reel"], desc: ["맨 오른쪽 열은 와일드가 안 나옴", "右端の列はワイルドが出ない", "No wilds in the rightmost column"] },
  bonus:  { icon: "🎟️", name: ["보너스 레버", "ボーナスレバー", "Bonus Lever"], desc: ["이 층만 돌리기 +2", "この階だけ回す回数+2", "+2 spins on this floor"] },
  tax:    { icon: "🧾", name: ["세금 층", "税金の階", "Tax Floor"], desc: ["통행료 +20%", "通行料+20%", "Toll +20%"] },
  lucky:  { icon: "🍀", name: ["행운의 층", "幸運の階", "Lucky Floor"], desc: ["와일드가 자주 나옴", "ワイルドが出やすい", "More wilds"] },
};
export const FLOOR_EVENT_IDS = Object.keys(FLOOR_EVENTS);
export const BOSSES = {
  guard: { icon: "🦍", name: ["문지기 고릴라", "門番ゴリラ", "Gorilla Gatekeeper"], desc: ["통행료 1.5배, 대신 깨면 전설 증강 고르기", "通行料1.5倍、突破するとレジェンドを選べる", "Toll ×1.5 — clear it to pick a legendary augment"] },
};
export const SCORE_NAME = ["층", "階", "Floor"];
export const MODES = ["race"];
// ---------- 깊이 (2026-11-21 2차) ----------
/** 해골 무게: 층이 오를수록 늘어남 */
export const skullW = (f) => Math.min(20, f < 2 ? 0 : 3 + Math.floor((f - 2) / 2) * 2);
export const CURSE_LOSS = 0.1; // 저주: 화면에 해골 3개 이상 → 그 스핀 0 + 가진 코인 10% (최소 5)
export const LUCK_SYMS = ["star", "gem", "seven", "wild"]; // 행운 1마다 이 그림들 무게 +9%
export const VAULT_RATE = 0.12; // 금고: 층 끝마다 +12% (통행료엔 못 씀)
export const MAX_ITEMS = 3;
// 그림 강화 (상점의 한 칸): 그 그림 값 영구 +50% (기본값 기준, 최대 3번)
export const SYM_UP = { cherry: "황금 체리", lemon: "황금 레몬", bell: "황금 종", melon: "황금 수박", star: "황금 별", gem: "황금 보석", seven: "황금 세븐" };
export const SYM_UP_NAME = { cherry: ["황금 체리", "黄金チェリー", "Golden Cherry"], lemon: ["황금 레몬", "黄金レモン", "Golden Lemon"], bell: ["황금 종", "黄金のベル", "Golden Bell"], melon: ["황금 수박", "黄金スイカ", "Golden Melon"], star: ["황금 별", "黄金の星", "Golden Star"], gem: ["황금 보석", "黄金の宝石", "Golden Gem"], seven: ["황금 세븐", "黄金セブン", "Golden Seven"] };
export const SYM_UP_MAX = 3;
// 소모품 아이템 (한 번 쓰면 사라짐) — 돌리는 중에 씀
export const ITEMS = {
  i1: { icon: "✖️", p: 8, name: ["2배 쿠폰", "2倍クーポン", "Double Coupon"], desc: ["다음 돌리기 코인 2배", "次の回転コイン2倍", "Your next spin pays double"] },
  i2: { icon: "🧯", p: 6, name: ["폭탄 해제기", "爆弾解除キット", "Defuser"], desc: ["도화선을 0으로", "導火線を0に", "Reset the fuse to 0"] },
  i3: { icon: "🧪", p: 7, name: ["행운 물약", "幸運のポーション", "Luck Potion"], desc: ["이번 층 행운 +4", "この階の幸運+4", "+4 Luck for this floor"] },
  i4: { icon: "🎨", p: 10, name: ["와일드 스프레이", "ワイルドスプレー", "Wild Spray"], desc: ["다음 돌리기에 와일드 3칸", "次の回転でワイルド3マス", "3 Wild cells on your next spin"] },
  i5: { icon: "🎰", p: 12, name: ["추가 레버", "追加レバー", "Extra Pull"], desc: ["이번 층 돌리기 +1", "この階の回転+1", "+1 spin this floor"] },
  i6: { icon: "🧹", p: 6, name: ["해골 빗자루", "ドクロほうき", "Skull Broom"], desc: ["다음 3번 해골이 안 나옴", "次の3回ドクロが出ない", "No skulls for your next 3 spins"] },
  i7: { icon: "🎟️", p: 9, name: ["통행료 할인권", "通行料割引券", "Toll Voucher"], desc: ["이번 층 통행료 -25%", "この階の通行料-25%", "This floor's toll -25%"] },
  i8: { icon: "🪙", p: 5, name: ["황금 동전", "黄金のコイン", "Gold Coin"], desc: ["바로 층×10 코인", "すぐに階×10コイン", "Gain floor×10 coins now"] },
  i9: { icon: "🔂", p: 9, name: ["릴 다시 돌리기", "リール回し直し", "Reel Respin"], desc: ["방금 결과에서 가장 아쉬운 한 열만 다시 돌림", "直前の結果で一番惜しい1列だけ回し直す", "Re-spin just the column that would help most on your last result"] },
};
export const ITEM_IDS = Object.keys(ITEMS);
// 오락실 방송 거래 (층 끝마다 둘 중 하나 고르거나 거절) — 위험과 보상
export const DEALS = {
  d1: { icon: "💸", name: ["급전", "急な借金", "Quick Loan"], desc: ["지금 층×25 코인, 다음 층 통행료 +40%", "今すぐ階×25コイン、次の階の通行料+40%", "Get floor×25 coins now; next toll +40%"] },
  d2: { icon: "📦", name: ["수상한 상자", "怪しい箱", "Suspicious Box"], desc: ["지금 층×15 코인, 도화선 +4", "今すぐ階×15コイン、導火線+4", "Get floor×15 coins now; fuse +4"] },
  d3: { icon: "🍀", name: ["행운 계약", "幸運の契約", "Luck Contract"], desc: ["행운 영구 +2, 다음 층 통행료 +20%", "幸運を永久+2、次の階の通行料+20%", "Permanent +2 Luck; next toll +20%"] },
  d4: { icon: "🔁", name: ["증강 맞바꾸기", "オーグメント交換", "Augment Swap"], desc: ["무작위 증강 하나를 버리고, 영웅·전설 2장 중 하나", "ランダムに1つ捨て、エピック・レジェンド2枚から1つ", "Lose a random augment, pick one of 2 epic/legendary"] },
  d5: { icon: "☠️", name: ["해골 축제", "ドクロ祭り", "Skull Party"], desc: ["다음 층 해골 2배, 대신 모든 당첨 ×1.5", "次の階ドクロ2倍、代わりに全当たり×1.5", "Next floor: double skulls, but every win ×1.5"] },
  d6: { icon: "🎲", name: ["한판 승부", "一か八か", "All or Nothing"], desc: ["반반: 코인 2배 / 코인 40% 잃음", "半々:コイン2倍/40%失う", "50/50: double your coins or lose 40%"] },
  d7: { icon: "🛍️", name: ["사장님 특가", "店長の特価", "Owner's Deal"], desc: ["이번 상점 카드 하나 공짜, 다음 층 돌리기 -1", "このショップのカード1枚無料、次の階の回転-1", "One free card in this shop; next floor -1 spin"] },
  d8: { icon: "🔧", name: ["레버 팔기", "レバー売却", "Sell a Pull"], desc: ["지금 층×20 코인, 다음 층 돌리기 -1", "今すぐ階×20コイン、次の階の回転-1", "Get floor×20 coins now; next floor -1 spin"] },
  d9: { icon: "🏦", name: ["금고 특판", "金庫キャンペーン", "Vault Promotion"], desc: ["금고 금액 +50%, 이번 상점 새로고침 못 함", "金庫の金額+50%、このショップは更新不可", "Vault +50%; no rerolls this shop"] },
  d10: { icon: "✨", name: ["그림 연마", "絵柄の研磨", "Symbol Polish"], desc: ["무작위 그림 하나 값 영구 +4", "ランダムな絵柄1つの価値を永久+4", "A random symbol gets +4 value permanently"] },
  d11: { icon: "🎁", name: ["아이템 꾸러미", "アイテム詰め合わせ", "Item Bundle"], desc: ["아이템 2개, 다음 층 통행료 +15%", "アイテム2つ、次の階の通行料+15%", "Get 2 items; next toll +15%"] },
  d12: { icon: "🕊️", name: ["평화로운 층", "平和な階", "Peaceful Floor"], desc: ["다음 층 폭탄·해골 없음, 대신 번 코인 ×0.8", "次の階は爆弾・ドクロなし、代わりに獲得×0.8", "Next floor has no bombs or skulls, but wins ×0.8"] },
};
export const DEAL_IDS = Object.keys(DEALS);
// 시너지 10종 (두 증강이 만나면)
export const SYNERGIES = [
  { id: "y1", req: ["a09", "a37"], name: ["와일드 폭풍", "ワイルドストーム", "Wild Storm"], desc: ["화면의 와일드 하나마다 +5", "画面のワイルド1つごとに+5", "+5 for every Wild on screen"] },
  { id: "y2", req: ["a06", "a12"], name: ["보석상", "宝石商", "Jeweler"], desc: ["보석 값 3배 (2배 대신)", "宝石の価値3倍(2倍の代わり)", "Gems pay ×3 instead of ×2"] },
  { id: "y3", req: ["a17", "a18"], name: ["만화경", "万華鏡", "Kaleidoscope"], desc: ["모든 줄 ×1.25", "全ての列×1.25", "All lines ×1.25"] },
  { id: "y4", req: ["a31", "a33"], name: ["불꽃 장인", "花火職人", "Pyrotechnician"], desc: ["폭발 보상 층×40", "爆発の報酬が階×40", "Explosions pay floor×40"] },
  { id: "y5", req: ["a24", "a30"], name: ["투자의 귀재", "投資の天才", "Investment Genius"], desc: ["이자 최대치 2배", "利子上限2倍", "Interest cap doubled"] },
  { id: "y6", req: ["a01", "a10"], name: ["체리 왕국", "チェリー王国", "Cherry Kingdom"], desc: ["체리 값 2배 더", "チェリーの価値さらに2倍", "Cherries pay double again"] },
  { id: "y7", req: ["a22", "a23"], name: ["멈출 수 없어", "止まらない", "Unstoppable"], desc: ["연쇄 한 번마다 +40%", "連鎖ごとに+40%", "+40% per chain step"] },
  { id: "y8", req: ["a41", "a42"], name: ["행운 덩어리", "幸運のかたまり", "Lucky Charm Pile"], desc: ["행운 +4 더", "幸運さらに+4", "+4 more Luck"] },
  { id: "y9", req: ["a35", "a40"], name: ["마지막 레버", "最後のレバー", "Final Pull"], desc: ["마지막 한 방 ×5 (×3 대신)", "最後の一撃×5(×3の代わり)", "Final Shot ×5 instead of ×3"] },
  { id: "y10", req: ["a43", "a44"], name: ["해골 사제", "ドクロの司祭", "Skull Priest"], desc: ["저주가 걸리면 대신 +40", "呪いの代わりに+40", "Curses give +40 instead"] },
];
export const SYN = Object.fromEntries(SYNERGIES.map(s => [s.id, s]));
// 층 배경 테마 (5층마다 바뀜) — 화면 연출
export const THEMES = [
  { name: ["오락실", "ゲーセン", "Arcade"], a: "#ff4fd8", b: "#3ff0ff", bg: "#2d1863" },
  { name: ["카지노", "カジノ", "Casino"], a: "#ffd43b", b: "#e03131", bg: "#3b0d0d" },
  { name: ["지하 클럽", "地下クラブ", "Underground Club"], a: "#69db7c", b: "#845ef7", bg: "#0f2a1a" },
  { name: ["하늘 라운지", "スカイラウンジ", "Sky Lounge"], a: "#74c0fc", b: "#ffa94d", bg: "#0f2d4f" },
  { name: ["우주 정거장", "宇宙ステーション", "Space Station"], a: "#e599f7", b: "#63e6be", bg: "#0b0b2b" },
];
export const themeOf = (f) => THEMES[Math.min(THEMES.length - 1, Math.floor((f - 1) / 5))];
// 대박 단계 (한 번에 번 코인 ÷ 이번 층 통행료)
export const WIN_TIERS = [{ at: 0.25, name: ["좋아요!", "いいね!", "Nice!"] }, { at: 0.6, name: ["대박!", "大当たり!", "Big Win!"] }, { at: 1.2, name: ["초대박!", "超大当たり!", "Huge Win!"] }, { at: 3, name: ["메가 잭팟!", "メガジャックポット!", "MEGA WIN!"] }];
// ---------- 업적 20종 · 보상 = 기계 색(8) 또는 칭호(12) ----------
export const ACH_THEMES = {
  ruby: { a: "#ff6b6b", b: "#ffd43b", name: ["루비", "ルビー", "Ruby"] }, emerald: { a: "#51cf66", b: "#3ff0ff", name: ["에메랄드", "エメラルド", "Emerald"] }, gold: { a: "#ffd43b", b: "#ff922b", name: ["황금", "黄金", "Gold"] }, ice: { a: "#a5d8ff", b: "#e7f5ff", name: ["얼음", "氷", "Ice"] },
  shadow: { a: "#868e96", b: "#212529", name: ["그림자", "影", "Shadow"] }, sakura: { a: "#ffa8d8", b: "#fff0f6", name: ["벚꽃", "桜", "Sakura"] }, neon: { a: "#3ff0ff", b: "#ff4fd8", name: ["네온", "ネオン", "Neon"] }, cosmic: { a: "#b197fc", b: "#63e6be", name: ["우주", "宇宙", "Cosmic"] },
};
export const ACHS = [
  { id: "t01", k: "plays", n: 1, rw: ["t"], icon: "🎰", name: ["첫 레버", "初レバー", "First Pull"], desc: ["첫 판 끝내기", "初めての1回を終える", "Finish your first run"] },
  { id: "t02", k: "plays", n: 20, rw: ["c", "ruby"], icon: "🎟️", name: ["오락실 단골", "ゲーセン常連", "Arcade Regular"], desc: ["20판 끝내기", "20回終える", "Finish 20 runs"] },
  { id: "t03", k: "bFloor", n: 6, rw: ["t"], icon: "🦍", name: ["문지기 통과", "門番突破", "Past the Gate"], desc: ["5층 보스 넘기 (6층 도달)", "5階ボス突破(6階到達)", "Beat the floor 5 boss (reach floor 6)"] },
  { id: "t04", k: "bFloor", n: 10, rw: ["c", "emerald"], icon: "🏢", name: ["10층 사람", "10階の住人", "Tenth Floor"], desc: ["10층 도달", "10階到達", "Reach floor 10"] },
  { id: "t05", k: "bFloor", n: 15, rw: ["t"], icon: "🌃", name: ["야경 감상", "夜景鑑賞", "City Lights"], desc: ["15층 도달", "15階到達", "Reach floor 15"] },
  { id: "t06", k: "bFloor", n: 20, rw: ["c", "cosmic"], icon: "🚀", name: ["탑 꼭대기", "塔の頂上", "Top of the Tower"], desc: ["20층 도달", "20階到達", "Reach floor 20"] },
  { id: "t07", k: "jackpots", n: 3, rw: ["c", "gold"], icon: "💰", name: ["잭팟 사냥꾼", "ジャックポットハンター", "Jackpot Hunter"], desc: ["잭팟·화면 가득 모두 3번", "ジャックポット・画面いっぱい合計3回", "Hit Jackpot or Full Screen 3 times"] },
  { id: "t08", k: "bBest", n: 1000, rw: ["t"], icon: "💥", name: ["천 코인 한 방", "千コインの一撃", "Thousand Spin"], desc: ["한 번에 1,000 코인", "一度に1,000コイン", "Win 1,000 coins in one spin"] },
  { id: "t09", k: "bBest", n: 10000, rw: ["c", "neon"], icon: "🌋", name: ["만 코인 한 방", "万コインの一撃", "Ten-Thousand Spin"], desc: ["한 번에 10,000 코인", "一度に10,000コイン", "Win 10,000 coins in one spin"] },
  { id: "t10", k: "noBoom10", n: 1, rw: ["t"], icon: "🧯", name: ["안전 운전", "安全運転", "Safe Hands"], desc: ["폭발 0번으로 10층", "爆発0回で10階", "Reach floor 10 without a single boom"] },
  { id: "t11", k: "curses", n: 10, rw: ["c", "shadow"], icon: "☠️", name: ["저주받은 자", "呪われし者", "Cursed One"], desc: ["저주 모두 10번 받기", "呪い合計10回", "Get cursed 10 times in total"] },
  { id: "t12", k: "bSyn", n: 3, rw: ["t"], icon: "✦", name: ["시너지 장인", "シナジー職人", "Synergy Master"], desc: ["한 판에 시너지 3개", "1回でシナジー3つ", "3 synergies in one run"] },
  { id: "t13", k: "bLv", n: 3, rw: ["t"], icon: "⬆️", name: ["레벨업 마니아", "レベルアップマニア", "Level-Up Maniac"], desc: ["한 판에 2단계 증강 3개", "1回でLv2オーグメント3つ", "3 level-2 augments in one run"] },
  { id: "t14", k: "deals", n: 15, rw: ["c", "sakura"], icon: "📻", name: ["방송 애청자", "放送の愛聴者", "Avid Listener"], desc: ["방송 거래 모두 15번", "放送取引合計15回", "Accept 15 broadcast deals"] },
  { id: "t15", k: "bVault", n: 500, rw: ["t"], icon: "🏦", name: ["금고지기", "金庫番", "Vault Keeper"], desc: ["금고에 500 코인 모으기", "金庫に500コイン", "Hold 500 coins in the vault"] },
  { id: "t16", k: "items", n: 30, rw: ["t"], icon: "🎒", name: ["아이템 애용가", "アイテム愛用家", "Item Lover"], desc: ["아이템 모두 30번 쓰기", "アイテム合計30回使用", "Use 30 items in total"] },
  { id: "t17", k: "bLuck", n: 10, rw: ["c", "ice"], icon: "🍀", name: ["행운아", "幸運児", "Lucky Duck"], desc: ["한 판에 행운 10", "1回で幸運10", "Reach 10 Luck in one run"] },
  { id: "t18", k: "allin", n: 1, rw: ["t"], icon: "🎲", name: ["간 큰 도박꾼", "肝の据わった勝負師", "High Roller"], desc: ["한판 승부에서 이기기", "一か八かで勝つ", "Win an All or Nothing deal"] },
  { id: "t19", k: "wins", n: 1, rw: ["t"], icon: "🏆", name: ["탑의 주인", "塔の主", "Master of the Tower"], desc: ["멀티 대결 1등 (2명 이상)", "マルチ対戦1位(2人以上)", "Win a multiplayer race (2+ players)"] },
  { id: "t20", k: "daily", n: 5, rw: ["t"], icon: "📅", name: ["매일 출근", "毎日出勤", "Daily Visitor"], desc: ["오늘의 도전 5번", "今日の挑戦5回", "Play the Daily Challenge 5 times"] },
];
export const ACH = Object.fromEntries(ACHS.map(a => [a.id, a]));
export const achHas = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const ACH_SUM = ["plays", "jackpots", "curses", "deals", "items", "wins", "daily", "allin", "noBoom10"];
const ACH_MAX = ["bFloor", "bBest", "bSyn", "bLv", "bVault", "bLuck"];
/** 한 판 결과를 기록에 더함 */
export function achApply(st, run) {
  const s = { ...(st && typeof st === "object" ? st : {}) }, num = (v) => (Number.isFinite(+v) && +v > 0 ? +v : 0);
  const add = { plays: 1, jackpots: num(run.jackpots), curses: num(run.curses), deals: num(run.deals), items: num(run.items), wins: run.win ? 1 : 0, daily: run.daily ? 1 : 0, allin: num(run.allin), noBoom10: num(run.floor) >= 10 && !num(run.booms) ? 1 : 0 };
  for (const k of ACH_SUM) s[k] = num(s[k]) + (add[k] || 0);
  const best = { bFloor: num(run.floor), bBest: num(run.best), bSyn: num(run.syn), bLv: num(run.lv2), bVault: num(run.vault), bLuck: num(run.luck) };
  for (const k of ACH_MAX) s[k] = Math.max(num(s[k]), best[k]);
  return s;
}
export const achDone = (st) => ACHS.filter(a => (Number(st?.[a.k]) || 0) >= a.n).map(a => a.id);
export function achEquip(unlocked, want) {
  const u = new Set(unlocked || []), out = { c: null, t: null }, c = String(want?.c || ""), t = String(want?.t || "");
  if (achHas(ACH_THEMES, c) && ACHS.some(a => a.rw[0] === "c" && a.rw[1] === c && u.has(a.id))) out.c = c;
  if (achHas(ACH, t) && ACH[t].rw[0] === "t" && u.has(t)) out.t = t;
  return out;
}
// 스트리머 후원 (금액이 정확히 같을 때만)
export const STREAM_KINDS = ["spin", "item", "luck", "tax", "bomb"];
export const STREAM_DEFAULT = { spin: 1000, item: 2000, luck: 3000, tax: 5000, bomb: 1500 };
export const STREAM_LABEL = {
  spin: ["🎰 공짜 돌리기 +1", "🎰 無料スピン+1", "🎰 Free spin +1"], item: ["🎁 무작위 아이템", "🎁 ランダムアイテム", "🎁 Random item"], luck: ["🍀 이번 층 행운 +5", "🍀 この階の幸運+5", "🍀 +5 Luck this floor"],
  tax: ["🧾 이번 층 통행료 +20% (방해)", "🧾 この階の通行料+20%(妨害)", "🧾 This floor's toll +20% (sabotage)"], bomb: ["💣 도화선 +2 (방해)", "💣 導火線+2(妨害)", "💣 Fuse +2 (sabotage)"],
};
