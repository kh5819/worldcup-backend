// =========================
// 상식 진단소 문항 11차 (2026-11-03) — 종합·기타 전문가(난이도 4) 문항 · 최후의 상식왕
// 서버 전용(정답 포함). 번역 배열 순서 = 원문. 검수: 근거 자료 대조(ai-ref), 운영자 승인 전
// =========================
const CK = "2026-11-03", BY = "ai-ref";
const BRIT = (slug, t) => ({ t: `Britannica — ${t}`, u: `https://www.britannica.com/${slug}` });
const NASA = { t: "NASA Science", u: "https://science.nasa.gov/" };
const OLY = { t: "국제올림픽위원회 Olympics.com", u: "https://www.olympics.com/" };
const base = (id, kind, q, exp, src, more) => ({ id, area: "mix", game: "final", kind, d: 4, q, exp, src: Array.isArray(src) ? src : [src], checked: CK, by: BY, ver: 1, status: "checked", assets: [], tags: ["11차", "전문가"], ...more });
const TR = {};
const add = (item, ja, en) => { TR[item.id] = { ja, en }; return item; };
const mcq = (id, q, opts, exp, src, ja, en) => add(base(id, "mcq", q, exp, src, { opts }), { q: ja[0], opts: ja[1], exp: ja[2] }, { q: en[0], opts: en[1], exp: en[2] });
const num = (id, q, n, exp, src, ja, en) => add(base(id, "num", q, exp, src, { n }), { q: ja[0], unit: ja[1], exp: ja[2] }, { q: en[0], unit: en[1], exp: en[2] });
const order = (id, q, events, exp, src, ja, en) => add(base(id, "order", q, exp, src, { events }), { q: ja[0], events: ja[1], exp: ja[2] }, { q: en[0], events: en[1], exp: en[2] });

export const BANK11 = [
  mcq("X0102", "최종 라운드! 체스의 특수 규칙 '앙파상(en passant)'으로 잡을 수 있는 말은?", ["폰", "나이트", "비숍", "룩"],
    "앙파상은 상대 폰이 처음에 두 칸 전진해 내 폰 옆에 섰을 때, 바로 다음 수에 한 칸 지나간 것처럼 대각선으로 잡는 규칙이에요. 폰끼리만 할 수 있어요.", { t: "FIDE Handbook — Laws of Chess", u: "https://handbook.fide.com/" },
    ["ファイナルラウンド！チェスの特殊ルール「アンパッサン」で取れる駒は？", ["ポーン", "ナイト", "ビショップ", "ルーク"], "アンパッサンは、相手のポーンが最初に2マス進んで自分のポーンの横に来たとき、直後の手に限り1マス進んだものとして斜めに取るルールです。ポーン同士でしかできません。"],
    ["Final round! Which piece can be captured 'en passant' in chess?", ["Pawn", "Knight", "Bishop", "Rook"], "En passant lets a pawn capture an enemy pawn that has just advanced two squares past it, as if it had moved only one — on the very next move. It applies only to pawns."]),
  mcq("X0103", "최종 라운드! 올림픽에서 사람과 동물이 함께 출전하는 유일한 종목은?", ["승마", "폴로", "경마", "개썰매"],
    "승마는 사람과 말이 함께 겨루는 올림픽 유일의 종목이에요. 마장마술·장애물 비월·종합마술이 있고, 남녀가 같은 조건으로 경쟁해요. 폴로는 1936년 이후 올림픽 종목이 아니에요.", OLY,
    ["ファイナルラウンド！オリンピックで人と動物が一緒に出場する唯一の競技は？", ["馬術", "ポロ", "競馬", "犬ぞり"], "馬術は人と馬が一緒に競うオリンピック唯一の競技です。馬場馬術・障害馬術・総合馬術があり、男女が同じ条件で競います。ポロは1936年以降オリンピック競技ではありません。"],
    ["Final round! Which is the only Olympic sport where humans and animals compete together?", ["Equestrian", "Polo", "Horse racing", "Sled-dog racing"], "Equestrian is the only Olympic sport pairing humans with animals (horses), with dressage, jumping and eventing — and men and women compete on equal terms. Polo hasn't been Olympic since 1936."]),
  mcq("X0104", "최종 라운드! 상온(25℃)·1기압에서 액체인 원소 두 가지는?", ["수은과 브로민", "수은과 갈륨", "브로민과 세슘", "수은과 나트륨"],
    "상온에서 액체인 원소는 금속인 수은과 비금속인 브로민 두 가지예요. 갈륨(약 30℃)과 세슘(약 28℃)은 녹는점이 낮지만 25℃에서는 고체예요.", BRIT("science/bromine", "Bromine"),
    ["ファイナルラウンド！常温（25℃）・1気圧で液体の元素2つは？", ["水銀と臭素", "水銀とガリウム", "臭素とセシウム", "水銀とナトリウム"], "常温で液体の元素は金属の水銀と非金属の臭素の2つです。ガリウム（約30℃）とセシウム（約28℃）は融点が低いですが、25℃では固体です。"],
    ["Final round! Which two elements are liquid at room temperature (25°C) and normal pressure?", ["Mercury and bromine", "Mercury and gallium", "Bromine and caesium", "Mercury and sodium"], "Only mercury (a metal) and bromine (a nonmetal) are liquid at 25°C. Gallium (~30°C) and caesium (~28°C) melt easily but are solid at 25°C."]),
  mcq("X0105", "최종 라운드! 음악 용어 '아 카펠라(a cappella)'의 뜻은?", ["악기 반주 없이 목소리로만 부르는 것", "점점 빠르게", "점점 세게", "두 사람이 함께 부르는 것"],
    "아 카펠라는 이탈리아어로 '교회(예배당) 방식으로'라는 뜻으로, 악기 반주 없이 목소리로만 부르는 합창·노래를 말해요.", BRIT("art/a-cappella", "A cappella"),
    ["ファイナルラウンド！音楽用語「ア・カペラ」の意味は？", ["楽器の伴奏なしに声だけで歌うこと", "だんだん速く", "だんだん強く", "2人で一緒に歌うこと"], "ア・カペラはイタリア語で「礼拝堂ふうに」という意味で、楽器の伴奏なしに声だけで歌う合唱・歌のことです。"],
    ["Final round! What does the musical term 'a cappella' mean?", ["Singing with voices only, no instruments", "Gradually faster", "Gradually louder", "Two people singing together"], "A cappella, Italian for 'in the chapel style', means singing with voices alone, without instrumental accompaniment."]),
  mcq("X0106", "최종 라운드! '광년'은 무엇을 재는 단위일까요?", ["거리", "시간", "밝기", "속도"],
    "광년은 빛이 진공에서 1년 동안 가는 거리(약 9조 4,600억 km)로, 이름에 '년'이 있지만 시간이 아니라 거리 단위예요.", NASA,
    ["ファイナルラウンド！「光年」は何を測る単位でしょう？", ["距離", "時間", "明るさ", "速さ"], "光年は光が真空中を1年間に進む距離（約9兆4,600億km）で、名前に「年」があっても時間ではなく距離の単位です。"],
    ["Final round! What does a 'light-year' measure?", ["Distance", "Time", "Brightness", "Speed"], "A light-year is the distance light travels in a vacuum in a year (about 9.46 trillion km). Despite the name, it measures distance, not time."]),
  mcq("X0107", "최종 라운드! 다음 중 소수(素數)가 아닌 것은?", ["91", "89", "97", "83"],
    "91은 7×13이라 소수가 아니에요. 83·89·97은 1과 자기 자신으로만 나누어지는 소수예요.", BRIT("science/prime-number", "Prime number"),
    ["ファイナルラウンド！次のうち素数でないものは？", ["91", "89", "97", "83"], "91は7×13なので素数ではありません。83・89・97は1と自分自身でしか割り切れない素数です。"],
    ["Final round! Which of these is NOT a prime number?", ["91", "89", "97", "83"], "91 = 7 × 13, so it isn't prime. 83, 89 and 97 are divisible only by 1 and themselves."]),
  num("X0202", "최종 라운드! 사람의 몸 세포(체세포) 하나에 들어 있는 염색체는 보통 모두 몇 개일까요?", { v: 46, tol: 0, far: 10, abs: true, unit: "개", min: 0, max: 100, step: 1 },
    "사람의 체세포에는 23쌍, 모두 46개의 염색체가 있어요. 그중 1쌍이 성별을 정하는 성염색체(XX 또는 XY)예요.", { t: "NIH National Human Genome Research Institute — Chromosomes", u: "https://www.genome.gov/about-genomics/fact-sheets/Chromosomes-Fact-Sheet" },
    ["ファイナルラウンド！人の体細胞1つに含まれる染色体はふつう全部でいくつでしょう？", "本", "人の体細胞には23対、合わせて46本の染色体があります。そのうち1対が性別を決める性染色体（XXまたはXY）です。"],
    ["Final round! How many chromosomes are normally in one human body cell?", "chromosomes", "Human body cells have 23 pairs — 46 chromosomes in all. One pair, the sex chromosomes (XX or XY), determines sex."]),
  num("X0203", "최종 라운드! 지구에서 달까지의 평균 거리는 약 몇 km일까요?", { v: 384400, tol: 0.05, far: 0.5, unit: "km", min: 0, max: 1000000, step: 100 },
    "지구와 달의 평균 거리는 약 38만 4,400km예요. 빛으로는 약 1.3초 걸리는 거리예요.", NASA,
    ["ファイナルラウンド！地球から月までの平均距離は約何kmでしょう？", "km", "地球と月の平均距離は約38万4,400kmです。光なら約1.3秒かかる距離です。"],
    ["Final round! About how far is it from Earth to the Moon on average, in km?", "km", "The average Earth–Moon distance is about 384,400 km — roughly 1.3 seconds at the speed of light."]),
  order("X0301", "최종 라운드! 인류의 도전 기록을 오래된 순서대로 놓으세요.", [["첫 남극점 도달 (아문센)", 1911], ["에베레스트 첫 등정 (힐러리·텐징)", 1953], ["첫 유인 우주 비행 (가가린)", 1961], ["첫 달 착륙 (아폴로 11호)", 1969]],
    "아문센 1911년 남극점 → 힐러리와 텐징 1953년 에베레스트 → 가가린 1961년 우주 비행 → 아폴로 11호 1969년 달 착륙 순이에요.", [BRIT("biography/Roald-Amundsen", "Roald Amundsen"), NASA],
    ["ファイナルラウンド！人類の挑戦の記録を古い順に並べましょう。", ["初の南極点到達（アムンセン）", "エベレスト初登頂（ヒラリーとテンジン）", "初の有人宇宙飛行（ガガーリン）", "初の月面着陸（アポロ11号）"], "アムンセン1911年の南極点 → ヒラリーとテンジン1953年のエベレスト → ガガーリン1961年の宇宙飛行 → アポロ11号1969年の月面着陸の順です。"],
    ["Final round! Put these human firsts in order, oldest first.", ["First to the South Pole (Amundsen)", "First ascent of Everest (Hillary & Tenzing)", "First crewed spaceflight (Gagarin)", "First Moon landing (Apollo 11)"], "Amundsen reached the South Pole in 1911, Hillary and Tenzing climbed Everest in 1953, Gagarin flew to space in 1961 and Apollo 11 landed on the Moon in 1969."]),
];
export const TR11 = TR;
