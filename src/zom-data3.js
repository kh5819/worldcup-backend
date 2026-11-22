// =========================
// 좀비 생존 진단소 — 3차 사건 (2026-11-22, CORE v3 "아직도 너무 쉬워")
// · 새 위기 3가지: 🦠 감염(e.inf / e.cure, 항생제) · ❄️ 겨울(18일부터, e.warm 장작 / flag heat 난로) · 🏴 약탈자 무리
// · 글은 [한국어, 日本語, English]로 한곳에 적음 → 사건에는 한국어만 들어가고, 번역 사전(I18N3)은 자동으로 만들어짐
// · 문법은 zom-data.js와 같음 (task 사건은 ok/mid/bad, 아니면 o)
// =========================
const D = "day", N = "night";
export const I18N3 = {};
/** [ko, ja, en] → ko (번역은 I18N3에 모음) */
const L = (ko, ja, en) => { I18N3[ko] = [ja, en]; return ko; };
const O = (arr) => arr.map((o) => ({ ...o, m: o.m, cause: o.cause, kill: o.kill }));

export const ITEMS3 = {
  antibiotic: { n: L("항생제", "抗生物質", "Antibiotics"), ic: "💉", d: L("감염되면 자동으로 먹고 나음", "感染したら自動で飲んで治る", "Cures infection automatically") },
  firewood: { n: L("장작 묶음", "薪の束", "Firewood bundle"), ic: "🪵", d: L("추운 밤을 버티게 해 줌", "寒い夜を越せる", "Helps you survive cold nights") },
};

export const EVENTS3 = [
  // ================= 🦠 감염 =================
  { id: "z_scratch", ph: D, loc: "street", min: 4, max: 30, w: 3,
    t: L("녹슨 철조망 틈으로 지름길이 보인다. 그 너머엔 편의점 창고. 철조망 아래로 기어가야 한다. 옆 골목에서 그것이 비틀거린다.", "錆びた有刺鉄線の隙間から近道が見える。その先はコンビニの倉庫。鉄線の下を這っていくしかない。横の路地で“あれ”がふらついている。", "A gap in rusty barbed wire offers a shortcut to a convenience store's storeroom. You'd have to crawl under it. Something staggers in the next alley."),
    c: [
      { t: L("조심조심 기어서 지나간다", "そろそろと這って通る", "Crawl through carefully"), g: 0, task: "sneak", d: 2,
        ok: [{ m: L("철조망에 옷 한 올 안 걸렸다. 창고에서 통조림을 챙겼다.", "鉄線に服ひとつ引っかからなかった。倉庫で缶詰を確保した。", "Not a thread caught on the wire. You grabbed canned food from the storeroom."), e: { food: 2 } }],
        mid: [{ m: L("팔을 철조망에 긁혔다. 피가 났지만 먹을 건 챙겼다.", "腕を鉄線で引っかいた。血が出たが食料は確保した。", "You scraped your arm on the wire. It bled, but you got the food."), e: { food: 1.5, hp: -6 } }],
        bad: [{ m: L("철조망에 걸린 순간 그것이 다리를 할퀴었다. 상처가 검붉게 부어오른다.", "鉄線に引っかかった瞬間、“あれ”が脚を引っかいた。傷が赤黒く腫れ上がる。", "The moment you snagged, it clawed your leg. The wound swells dark red."), e: { hp: -14, inf: 1 }, cause: L("철조망 밑에서 좀비에게 할퀴임", "有刺鉄線の下でゾンビに引っかかれた", "Clawed by a zombie under barbed wire") }] },
      { t: L("빙 돌아서 간다", "遠回りする", "Go the long way round"), g: 1, o: [{ w: 2, m: L("한 시간을 돌아 도착했더니 창고는 이미 털려 있었다.", "1時間かけて回ったら倉庫はもう荒らされていた。", "After an hour's detour, the storeroom had already been looted."), e: { san: -3 } }, { w: 1, m: L("돌아가는 길에 버려진 가방에서 초코바를 찾았다.", "回り道の途中、捨てられた鞄からチョコバーを見つけた。", "On the detour you found chocolate bars in an abandoned bag."), e: { food: 0.8 } }] },
    ] },
  { id: "z_dogs", ph: D, loc: "street", min: 6, max: 30, w: 2,
    t: L("굶주린 들개 다섯 마리가 길을 막았다. 그중 한 마리의 입가가 이상하게 검다. 으르렁거린다.", "飢えた野犬5匹が道を塞いだ。その中の1匹は口元が妙に黒い。唸っている。", "Five starving stray dogs block the road. One has a strangely black muzzle. They growl."),
    c: [
      { t: L("식량을 던져 주고 지나간다", "食料を投げて通り過ぎる", "Toss them food and pass"), g: 1, need: "food>1", o: [{ m: L("개들이 먹이에 달려드는 사이 조용히 빠져나왔다.", "犬たちが餌に群がる間に静かに抜け出した。", "While they fought over the food, you slipped away quietly."), e: { food: -1 } }] },
      { t: L("야구방망이로 쫓아낸다", "バットで追い払う", "Drive them off with the bat"), g: 0, need: "bat", o: [{ w: 2, m: L("방망이를 휘두르자 개들이 흩어졌다.", "バットを振ると犬たちは散った。", "One swing and the dogs scattered."), e: { noise: 12 } }, { w: 1, m: L("검은 입의 개가 손목을 물었다. 방망이로 떼어 냈다.", "黒い口の犬が手首を噛んだ。バットで引き剥がした。", "The black-muzzled dog bit your wrist. You beat it off."), e: { hp: -10, inf: 1, noise: 12 }, cause: L("감염된 들개에게 물림", "感染した野犬に噛まれた", "Bitten by an infected stray dog") }] },
      { t: L("천천히 뒷걸음질 친다", "ゆっくり後ずさりする", "Back away slowly"), g: 0, task: "escape", d: 2,
        ok: [{ m: L("눈을 마주치지 않고 골목으로 빠졌다. 개들은 따라오지 않았다.", "目を合わせずに路地へ抜けた。犬たちはついて来なかった。", "Eyes down, you slipped into an alley. They didn't follow."), e: { san: -2 } }],
        mid: [{ m: L("한 마리가 바짓단을 물고 늘어졌다. 겨우 떼어 냈다.", "1匹がズボンの裾に食らいついた。なんとか振り払った。", "One latched onto your trouser leg. You barely shook it off."), e: { hp: -8 } }],
        bad: [{ m: L("뛰는 순간 무리가 덮쳤다. 검은 입의 개가 종아리를 물었다.", "走った瞬間、群れが襲いかかった。黒い口の犬がふくらはぎを噛んだ。", "The moment you ran, the pack lunged. The black-muzzled dog bit your calf."), e: { hp: -20, inf: 1 }, cause: L("들개 떼에게 쫓김", "野犬の群れに追われた", "Chased down by a pack of stray dogs") }] },
    ] },
  { id: "z_clinic", ph: D, loc: "hospital", min: 5, max: 30, w: 2, need: "!antibiotic",
    t: L("동네 보건소. 약품 냉장고는 지하에 있다. 지하 복도에서 무언가 바닥을 끄는 소리가 난다.", "町の保健所。薬品冷蔵庫は地下にある。地下の廊下で何かが床を引きずる音がする。", "The local clinic. The medicine fridge is in the basement. Something is dragging across the basement floor."),
    c: [
      { t: L("지하로 내려가 약을 찾는다", "地下に降りて薬を探す", "Go down for the medicine"), g: 0, b: 1, task: "escape", d: 3,
        ok: [{ m: L("항생제 상자와 구급상자를 품에 안고 계단을 뛰어 올라왔다.", "抗生物質の箱と救急箱を抱えて階段を駆け上がった。", "You sprinted up the stairs clutching antibiotics and a first-aid kit."), e: { add: ["antibiotic", "medkit"] } }],
        mid: [{ m: L("항생제 한 통만 겨우 챙겼다. 뒤에서 문이 쾅 닫혔다.", "抗生物質を1箱だけなんとか取った。後ろでドアがバタンと閉まった。", "You barely grabbed one box of antibiotics. A door slammed behind you."), e: { add: ["antibiotic"], hp: -8, noise: 10 } }],
        bad: [{ m: L("복도 끝에서 그것들이 쏟아져 나왔다. 빈손으로 도망쳤고, 팔에 이빨 자국이 남았다.", "廊下の奥から“あれ”があふれ出た。手ぶらで逃げ、腕に歯形が残った。", "They poured out from the end of the corridor. You fled empty-handed with teeth marks on your arm."), e: { hp: -22, inf: 1, noise: 15 }, cause: L("보건소 지하에서 붙잡힘", "保健所の地下で捕まった", "Caught in the clinic basement") }] },
      { t: L("1층 접수대만 뒤진다", "1階の受付だけ探す", "Search only the front desk"), g: 1, o: [{ w: 2, m: L("붕대와 소독약 몇 개를 챙겼다.", "包帯と消毒薬をいくつか確保した。", "You picked up some bandages and disinfectant."), e: { hp: 6 } }, { w: 1, m: L("서랍 깊숙한 곳에 항생제 한 통이 있었다!", "引き出しの奥に抗生物質が1箱あった！", "A box of antibiotics at the back of a drawer!"), e: { add: ["antibiotic"] } }] },
    ] },
  { id: "z_fever", ph: N, loc: "night", min: 3, max: 30, w: 6, need: "flag:infected",
    t: L("몸이 불덩이 같다. 상처 주변 핏줄이 검게 번졌다. 거울 속 눈이 조금… 탁하다.", "体が火の玉のようだ。傷の周りの血管が黒く広がった。鏡の中の目が少し…濁っている。", "You're burning up. The veins around the wound have spread dark. In the mirror your eyes look a little... cloudy."),
    c: [
      { t: L("진통제를 먹고 억지로 잔다", "鎮痛剤を飲んで無理やり寝る", "Take painkillers and force yourself to sleep"), g: 1, need: "painkiller", o: [{ m: L("열이 조금 내렸다. 진통제 통이 비었다.", "熱が少し下がった。鎮痛剤の瓶が空になった。", "The fever eased a little. The painkiller bottle is empty."), e: { rm: ["painkiller"], hp: 5, san: 4 } }] },
      { t: L("상처를 불로 지진다", "傷を火で焼く", "Cauterize the wound with fire"), g: 0, b: 1, need: "lighter", o: [{ w: 1, m: L("비명을 이불에 묻었다. 다음 날 아침, 검은 핏줄이 사라졌다.", "悲鳴を布団に押し殺した。翌朝、黒い血管が消えていた。", "You screamed into the blanket. The next morning, the dark veins were gone."), e: { hp: -12, cure: 1, noise: 8 } }, { w: 1, m: L("너무 아파서 중간에 멈췄다. 상처만 더 커졌다.", "痛すぎて途中でやめた。傷が広がっただけだ。", "It hurt too much; you stopped halfway. The wound only got worse."), e: { hp: -15, san: -6 }, cause: L("감염된 상처를 불로 지지다 쓰러짐", "感染した傷を火で焼いていて倒れた", "Collapsed while cauterizing an infected wound") }] },
      { t: L("{c}에게 상처를 보여 준다", "{c}に傷を見せる", "Show the wound to {c}"), g: 1, b: 1, need: "comp", o: [{ w: 2, m: L("{c}이(가) 밤새 찬 수건을 갈아 줬다. 믿어 줘서 고맙다고 했다.", "{c}が一晩中冷たいタオルを替えてくれた。信じてくれてありがとうと言った。", "{c} changed cold towels all night and thanked you for trusting them."), e: { hp: 4, san: 6, trust: 10 } }, { w: 1, m: L("{c}의 얼굴이 하얗게 질렸다. 그날 밤 문 앞에 의자를 놓고 잤다.", "{c}の顔が真っ青になった。その夜、{c}はドアの前に椅子を置いて寝た。", "{c} went pale. That night they slept with a chair against the door."), e: { trust: -20, san: -5 } }] },
      { t: L("참는다", "耐える", "Grit your teeth"), g: 0, o: [{ m: L("밤새 헛소리를 했다. 아침에 베개가 땀에 젖어 있었다.", "一晩中うわごとを言った。朝、枕が汗で濡れていた。", "You raved all night. In the morning the pillow was soaked with sweat."), e: { hp: -6, san: -6 }, cause: L("감염된 채 열에 시달림", "感染したまま熱にうなされた", "Wasted away from fever while infected") }] },
    ] },
  { id: "z_vet", ph: D, loc: "street", min: 7, max: 30, w: 2, need: "!antibiotic",
    t: L("셔터가 반쯤 내려간 동물병원. 안쪽 진열장에 동물용 항생제가 보인다. 우리 안에서 뭔가 몸부림친다.", "シャッターが半分下りた動物病院。奥の棚に動物用の抗生物質が見える。ケージの中で何かがもがいている。", "A half-shuttered vet clinic. Animal antibiotics sit in the back cabinet. Something thrashes inside a cage."),
    c: [
      { t: L("진열장 자물쇠를 딴다", "棚の鍵を開ける", "Pick the cabinet lock"), g: 0, task: "lockpick", d: 2,
        ok: [{ m: L("찰칵. 동물용이지만 항생제는 항생제다.", "カチャ。動物用でも抗生物質は抗生物質だ。", "Click. Meant for animals, but antibiotics are antibiotics."), e: { add: ["antibiotic"] } }],
        mid: [{ m: L("자물쇠는 열었지만 우리 문도 같이 덜컹거렸다. 약만 쥐고 뛰었다.", "鍵は開いたがケージの扉もガタついた。薬だけ握って走った。", "The lock opened, but so did the cage door. You grabbed the medicine and ran."), e: { add: ["antibiotic"], hp: -8, noise: 12 } }],
        bad: [{ m: L("자물쇠가 부러졌다. 우리 속 그것이 철창을 뚫고 나왔다.", "鍵が折れた。ケージの“あれ”が鉄格子を破って出てきた。", "The lock snapped. The thing in the cage burst through the bars."), e: { hp: -18, noise: 18 }, cause: L("동물병원 우리에서 튀어나온 것에 당함", "動物病院のケージから飛び出したものにやられた", "Attacked by something that burst from a vet clinic cage") }] },
      { t: L("유리를 깨고 집는다", "ガラスを割って取る", "Smash the glass and grab it"), g: -1, o: [{ m: L("쨍그랑! 약은 챙겼지만 온 동네가 들었다.", "ガシャン！薬は取ったが町中に聞こえた。", "CRASH! You got the medicine, but the whole block heard."), e: { add: ["antibiotic"], noise: 30 } }] },
      { t: L("그냥 지나친다", "そのまま通り過ぎる", "Walk on by"), g: 0, o: [{ m: L("우리 속 울음소리가 한참 귀에 남았다.", "ケージの中の声がしばらく耳に残った。", "The cries from the cage stayed with you a long while."), e: { san: -3 } }] },
    ] },
  // ================= ❄️ 겨울 =================
  { id: "z_first_snow", ph: D, loc: "rooftop", min: 17, max: 18, w: 40, once: 1, fx: "snow",
    t: L("첫눈이다. 예쁘다는 생각은 잠깐이었다. 내일부터는 영하 15도. 난방이 끊긴 아파트는 냉동고가 된다.", "初雪だ。きれいだと思ったのは一瞬だった。明日からは氷点下15度。暖房の切れたマンションは冷凍庫になる。", "First snow. It's pretty for about a second. From tomorrow it'll be -15°C, and an apartment with no heating becomes a freezer."),
    c: [
      { t: L("가구를 부숴 장작을 만든다", "家具を壊して薪を作る", "Break up furniture for firewood"), g: 1, o: [{ m: L("식탁과 의자가 장작이 됐다. 망치 소리가 꽤 컸다.", "食卓と椅子が薪になった。ハンマーの音がかなり大きかった。", "The table and chairs became firewood. The hammering was loud."), e: { warm: 6, noise: 18 } }] },
      { t: L("빈집을 돌며 이불을 모은다", "空き家を回って布団を集める", "Gather blankets from empty flats"), g: 0, task: "sneak", d: 2,
        ok: [{ m: L("두꺼운 이불과 등산용 침낭을 찾았다.", "厚い布団と登山用の寝袋を見つけた。", "You found thick quilts and a mountaineering sleeping bag."), e: { warm: 5 } }],
        mid: [{ m: L("이불 두 채는 챙겼다. 한 집에서는 서둘러 나와야 했다.", "布団を2枚は確保した。1軒からは急いで出るしかなかった。", "You got two quilts, but had to bolt from one flat."), e: { warm: 3, hp: -6 } }],
        bad: [{ m: L("옷장 안에 누가 있었다. 사람은 아니었다.", "クローゼットの中に誰かいた。人ではなかった。", "Someone was in the wardrobe. Not someone human."), e: { hp: -20 }, cause: L("빈집 옷장에서 튀어나온 것에 당함", "空き家のクローゼットから飛び出したものにやられた", "Ambushed from a wardrobe in an empty flat") }] },
      { t: L("어떻게든 되겠지", "なんとかなるさ", "It'll be fine somehow"), g: -1, o: [{ m: L("창밖으로 눈이 소리 없이 쌓였다.", "窓の外で雪が音もなく積もった。", "Outside, the snow piled up without a sound."), e: { san: 2 } }] },
    ] },
  { id: "z_stove", ph: D, loc: "hall", min: 12, max: 30, w: 2, need: "!flag:heat",
    t: L("상가 철물점 창고 안쪽에 캠핑용 난로와 등유 통이 있다. 창고 문은 무거운 자물쇠로 잠겨 있다.", "商店街の金物屋の倉庫の奥に、キャンプ用ストーブと灯油缶がある。倉庫の扉は重い南京錠で閉まっている。", "At the back of the hardware store's storeroom are a camping stove and kerosene cans. The door has a heavy padlock."),
    c: [
      { t: L("자물쇠를 딴다", "鍵を開ける", "Pick the padlock"), g: 0, task: "lockpick", d: 3,
        ok: [{ m: L("난로와 등유를 손수레로 옮겼다. 이번 겨울은 버틸 수 있다.", "ストーブと灯油を手押し車で運んだ。この冬は越せる。", "You wheeled the stove and kerosene home. You can make it through this winter."), e: { flag: "heat", san: 8 } }],
        mid: [{ m: L("난로는 무거워서 두고 왔다. 등유 대신 나무 팔레트를 챙겼다.", "ストーブは重くて置いてきた。灯油の代わりに木のパレットを持ってきた。", "The stove was too heavy to carry. You took wooden pallets instead."), e: { warm: 3 } }],
        bad: [{ m: L("자물쇠와 씨름하는 사이 등 뒤로 그림자가 드리웠다.", "南京錠と格闘している間に背後に影が差した。", "While you wrestled with the lock, a shadow fell across your back."), e: { hp: -20, noise: 10 }, cause: L("철물점 창고 앞에서 자물쇠와 씨름하다 당함", "金物屋の倉庫前で南京錠と格闘中にやられた", "Caught fumbling a padlock at the hardware store") }] },
      { t: L("쇠지렛대로 문을 뜯는다", "バールで扉をこじ開ける", "Pry the door with the crowbar"), g: 1, need: "crowbar", o: [{ m: L("끼익— 문이 열렸다. 난로를 챙겼다.", "ギィ——扉が開いた。ストーブを手に入れた。", "Creak—the door gave. You got the stove."), e: { flag: "heat", noise: 14 } }] },
      { t: L("포기한다", "あきらめる", "Give up"), g: 0, o: [{ m: L("돌아오는 길에 입김이 하얗게 흩어졌다.", "帰り道、白い息が散っていった。", "Your breath scattered white on the way back."), e: { san: -2 } }] },
    ] },
  { id: "z_blizzard", ph: N, loc: "night", min: 18, max: 30, w: 3, fx: "snow",
    t: L("눈보라가 창문을 때린다. 유리에 성에가 꽃처럼 핀다. 물병 속 물이 얼었다.", "吹雪が窓を叩く。ガラスに霜が花のように咲く。ペットボトルの水が凍った。", "A blizzard batters the windows. Frost blooms on the glass like flowers. The water in your bottles has frozen."),
    c: [
      { t: L("장작을 넉넉히 땐다", "薪をたっぷり焚く", "Burn plenty of firewood"), g: 1, need: "flag:heat", o: [{ m: L("난로 앞에서 몸이 녹았다. 바깥 눈보라 소리가 자장가 같다.", "ストーブの前で体がほぐれた。外の吹雪の音が子守唄のようだ。", "You thawed out by the stove. The blizzard outside sounds like a lullaby."), e: { san: 6, hp: 4 } }] },
      { t: L("라이터로 불을 피운다", "ライターで火を起こす", "Light a fire with the lighter"), g: 0, need: "lighter", o: [{ m: L("따뜻하다. 연기가 창틈으로 새어 나갔다.", "暖かい。煙が窓の隙間から漏れた。", "Warmth. Smoke leaked out through the window gaps."), e: { warm: 1, noise: 15 } }] },
      { t: L("{c}와(과) 이불 하나를 같이 덮는다", "{c}と布団を1枚一緒にかぶる", "Share one blanket with {c}"), g: 1, b: 1, need: "comp", o: [{ m: L("서로의 체온이 버팀목이었다.", "互いの体温が支えだった。", "Each other's body heat held you up."), e: { trust: 12, san: 3, hp: -3 } }] },
      { t: L("이불 속에서 버틴다", "布団の中で耐える", "Tough it out under the covers"), g: 0, o: [{ m: L("발가락 감각이 사라졌다. 아침이 오지 않을 것 같았다.", "足の指の感覚がなくなった。朝が来ない気がした。", "You lost feeling in your toes. It felt like morning would never come."), e: { hp: -12, san: -6 }, cause: L("눈보라 치는 밤을 이불 한 장으로 버팀", "吹雪の夜を布団1枚で耐えた", "Tried to outlast a blizzard under a single blanket") }] },
    ] },
  { id: "z_ice_lake", ph: D, loc: "street", min: 18, max: 30, w: 2, fx: "snow",
    t: L("공원 호수가 꽁꽁 얼었다. 얼음 아래 물고기들이 천천히 움직인다. 호수 건너편에는 그것들이 어슬렁거린다.", "公園の湖がカチカチに凍った。氷の下で魚がゆっくり動いている。湖の向こう岸では“あれ”がうろついている。", "The park lake has frozen solid. Fish drift slowly beneath the ice. On the far shore, they wander."),
    c: [
      { t: L("얼음에 구멍을 뚫고 낚시한다", "氷に穴を開けて釣りをする", "Cut a hole and go ice fishing"), g: 0, task: "crank", d: 2,
        ok: [{ m: L("얼음을 조용히 뚫었다. 붕어 세 마리!", "氷を静かに割った。フナが3匹！", "You drilled the ice quietly. Three carp!"), e: { food: 2 } }],
        mid: [{ m: L("쩍— 얼음 깨지는 소리가 울렸다. 한 마리는 건졌다.", "パキッ——氷の割れる音が響いた。1匹は釣れた。", "CRACK—the ice rang out. You still landed one."), e: { food: 0.8, noise: 15 } }],
        bad: [{ m: L("얼음이 갈라지며 발이 빠졌다. 젖은 몸으로 눈밭을 뛰었다.", "氷が割れて足が落ちた。濡れた体で雪原を走った。", "The ice split and your leg went through. You ran through the snow soaked."), e: { hp: -16, noise: 20, san: -5 }, cause: L("언 호수에 빠짐", "凍った湖に落ちた", "Fell through a frozen lake") }] },
      { t: L("건너편 그것들을 피해 돌아간다", "向こう岸の“あれ”を避けて戻る", "Avoid them and head back"), g: 0, o: [{ m: L("눈 위에 내 발자국만 길게 남았다.", "雪の上に自分の足跡だけが長く残った。", "Only your footprints trailed long behind you in the snow."), e: { san: -2 } }] },
    ] },
  { id: "z_frost_comp", ph: N, loc: "night", min: 19, max: 30, w: 2, need: "comp&!flag:heat",
    t: L("새벽, {c}의 입술이 파랗다. 이를 딱딱 부딪치며 떨고 있다.", "明け方、{c}の唇が青い。歯をガチガチ鳴らして震えている。", "Before dawn, {c}'s lips are blue. Their teeth are chattering."),
    c: [
      { t: L("내 외투를 덮어 준다", "自分の上着をかけてあげる", "Give them your coat"), g: 1, b: 1, o: [{ m: L("{c}이(가) 조금씩 진정됐다. 대신 내가 밤새 떨었다.", "{c}は少しずつ落ち着いた。代わりに自分が一晩中震えた。", "{c} slowly calmed. You shivered all night instead."), e: { trust: 15, hp: -8 } }] },
      { t: L("마지막 장작을 땐다", "最後の薪を焚く", "Burn the last of the firewood"), g: 1, need: "flag:fort", o: [{ m: L("바리케이드 판자 하나를 뜯어 불을 지폈다. 따뜻했지만 문이 약해졌다.", "バリケードの板を1枚はがして火をつけた。暖かかったが扉が弱くなった。", "You tore a board off the barricade for kindling. It was warm, but the door is weaker now."), e: { hp: 3, trust: 8, noise: 8 } }] },
      { t: L("어쩔 수 없다. 나도 춥다", "仕方ない。自分も寒い", "Nothing to be done. You're cold too"), g: -1, o: [{ m: L("아침에 {c}이(가) 말없이 짐을 쌌다.", "朝、{c}は黙って荷物をまとめた。", "In the morning {c} packed their things without a word."), e: { leave: 1, san: -8 } }] },
    ] },
  // ================= 🏴 약탈자 =================
  { id: "z_toll", ph: D, loc: "highway", min: 12, max: 30, w: 2,
    t: L("다리 입구에 폐차로 벽을 쌓은 약탈자들. 확성기: \"통행료! 가진 것 반!\" 다리 아래 강물은 얼음장이다.", "橋の入口に廃車で壁を築いた略奪者たち。拡声器「通行料！持ち物の半分！」橋の下の川は氷のように冷たい。", "Raiders have walled the bridge entrance with wrecked cars. A megaphone: \"Toll! Half of everything!\" The river below is ice-cold."),
    c: [
      { t: L("식량 절반을 낸다", "食料の半分を払う", "Pay half your food"), g: 0, o: [{ m: L("그들은 정말로 길을 비켜 줬다. 가방이 가볍다.", "彼らは本当に道を空けてくれた。鞄が軽い。", "They really did let you through. Your bag feels light."), e: { foodHalf: 1, san: -4 } }] },
      { t: L("강가 쪽으로 몰래 돌아간다", "川辺のほうへこっそり回る", "Sneak round along the riverbank"), g: 0, task: "sneak", d: 3,
        ok: [{ m: L("교각 그림자를 타고 건넜다. 아무도 못 봤다.", "橋脚の影に沿って渡った。誰にも見られなかった。", "You crossed in the shadow of the piers. Nobody saw."), e: { san: 3 } }],
        mid: [{ m: L("총소리가 한 번 울렸다. 빗나갔다. 가방 하나를 버리고 뛰었다.", "銃声が一発響いた。外れた。鞄をひとつ捨てて走った。", "One shot rang out—and missed. You dumped a bag and ran."), e: { food: -1.5, noise: 20 } }],
        bad: [{ m: L("탐조등이 나를 비췄다. 강으로 뛰어내렸다.", "探照灯に照らされた。川へ飛び込んだ。", "A searchlight found you. You jumped into the river."), e: { hp: -28, food: -1, noise: 20 }, cause: L("약탈자의 다리에서 강으로 뛰어내림", "略奪者の橋から川へ飛び込んだ", "Leapt off the raiders' bridge into the river") }] },
      { t: L("{c}와(과) 정면 돌파한다", "{c}と正面突破する", "Break through with {c}"), g: -1, b: 1, need: "comp", o: [{ w: 1, m: L("약탈자들이 당황해 흩어졌다. 그들의 식량 상자를 챙겼다!", "略奪者たちは慌てて散った。彼らの食料箱を手に入れた！", "The raiders scattered in panic. You took their food crate!"), e: { food: 3, noise: 25, hp: -10 } }, { w: 2, m: L("총구가 이쪽을 향했다. {c}을(를) 끌고 겨우 도망쳤다.", "銃口がこちらを向いた。{c}を引きずってなんとか逃げた。", "Guns swung toward you. You dragged {c} away just in time."), e: { hp: -24, trust: -10, noise: 25 }, cause: L("약탈자 바리케이드에 정면 돌진", "略奪者のバリケードに正面突撃した", "Charged a raider barricade head-on") }] },
    ] },
  { id: "z_raid", ph: N, loc: "night", min: 14, max: 30, w: 3,
    t: L("자정. 계단에서 군화 소리. 좀비가 아니다. 문 밖에서 속삭인다. \"여기 연기 났었지?\"", "深夜。階段から軍靴の音。ゾンビではない。ドアの外でささやく。「ここ、煙が出てたよな？」", "Midnight. Boots on the stairs. Not zombies. Whispering outside the door: \"Wasn't there smoke from this one?\""),
    c: [
      { t: L("문을 막고 버틴다", "ドアを塞いで耐える", "Barricade the door and hold"), g: 0, task: "barricade", d: 3,
        ok: [{ m: L("문을 몇 번 차더니 \"빈집이네\" 하고 내려갔다.", "ドアを何度か蹴ると「空き家だな」と言って降りていった。", "They kicked the door a few times, muttered \"empty,\" and went back down."), e: { san: -4 } }],
        mid: [{ m: L("문틈으로 쇠막대가 들어왔다. 식량 상자 하나를 빼앗겼다.", "ドアの隙間から鉄棒が差し込まれた。食料箱をひとつ奪われた。", "A crowbar jammed through the gap. They hauled out one food crate."), e: { food: -1.5, hp: -8 } }],
        bad: [{ m: L("문이 부서졌다. 그들은 웃으며 다 가져갔다.", "ドアが壊された。彼らは笑いながら全部持っていった。", "The door broke. They laughed as they took everything."), e: { foodHalf: 1, hp: -22, san: -10, rm: ["medkit"] }, cause: L("한밤중 약탈자들에게 습격당함", "深夜に略奪者に襲われた", "Raided by looters at midnight") }] },
      { t: L("미리 숨겨 둔 식량만 지킨다", "あらかじめ隠した食料だけ守る", "Protect only your hidden stash"), g: 1, o: [{ m: L("눈에 보이는 건 다 내줬다. 마룻바닥 아래 통조림은 들키지 않았다.", "目に見える物は全部渡した。床下の缶詰は見つからなかった。", "You handed over everything in sight. The cans under the floorboards stayed hidden."), e: { food: -1, san: -6 } }] },
      { t: L("야구방망이를 들고 기다린다", "バットを持って待つ", "Wait with the bat"), g: -1, b: 1, need: "bat", o: [{ w: 1, m: L("첫 번째가 들어오는 순간 휘둘렀다. 나머지가 도망쳤다.", "1人目が入ってきた瞬間に振り抜いた。残りは逃げた。", "You swung the moment the first one came through. The rest fled."), e: { san: -8, noise: 15 } }, { w: 1, m: L("상대는 셋이었고 칼이 있었다.", "相手は3人で、ナイフを持っていた。", "There were three of them, and they had knives."), e: { hp: -30, foodHalf: 1 }, cause: L("약탈자 셋과 몸싸움", "略奪者3人と取っ組み合い", "Fought three raiders") }] },
    ] },
  { id: "z_hostage", ph: D, loc: "street", min: 13, max: 30, w: 2,
    t: L("약탈자 둘이 밧줄에 묶인 사람을 끌고 간다. 묶인 사람이 눈이 마주치자 입 모양으로 말한다. \"살려 주세요.\"", "略奪者2人が縄で縛った人を引きずっていく。縛られた人と目が合うと、口の形で言う。「助けて」", "Two raiders drag a bound captive. Meeting your eyes, the captive mouths: \"Help me.\""),
    c: [
      { t: L("몰래 따라가 풀어 준다", "こっそりついて行って解放する", "Follow and free them"), g: 0, b: 1, task: "sneak", d: 3,
        ok: [{ m: L("약탈자들이 쉬는 틈에 밧줄을 끊었다. 그 사람은 간호사였다.", "略奪者が休む隙に縄を切った。その人は看護師だった。", "You cut the rope while the raiders rested. The captive was a nurse."), e: { join: "medic", san: 8 } }],
        mid: [{ m: L("밧줄을 끊고 같이 뛰었다. 그 사람은 고맙다며 반대쪽으로 사라졌다.", "縄を切って一緒に走った。その人はありがとうと言って反対側へ消えた。", "You cut the rope and ran together. They thanked you and vanished the other way."), e: { san: 6, hp: -6 } }],
        bad: [{ m: L("나뭇가지를 밟았다. 이번엔 내가 밧줄에 묶일 차례였다. 겨우 도망쳤다.", "小枝を踏んだ。今度は自分が縛られる番だった。なんとか逃げた。", "You stepped on a twig. Now it was nearly your turn for the rope. You barely escaped."), e: { hp: -26, food: -1 }, cause: L("약탈자를 미행하다 들킴", "略奪者を尾行していて見つかった", "Spotted while tailing raiders") }] },
      { t: L("못 본 척한다", "見なかったふりをする", "Pretend you didn't see"), g: 1, b: -1, o: [{ m: L("그 눈빛이 며칠 동안 꿈에 나왔다.", "あの目つきが何日も夢に出た。", "Those eyes haunted your dreams for days."), e: { san: -10 } }] },
      { t: L("멀리서 깡통을 던져 시선을 돌린다", "遠くへ缶を投げて気をそらす", "Throw a can to distract them"), g: 0, task: "throw", d: 2,
        ok: [{ m: L("둘이 소리 쪽으로 간 사이 묶인 사람이 스스로 도망쳤다.", "2人が音のほうへ行った隙に、縛られた人は自力で逃げた。", "While both went toward the noise, the captive slipped away on their own."), e: { san: 7 } }],
        mid: [{ m: L("한 명만 움직였다. 아무것도 바뀌지 않았다.", "1人しか動かなかった。何も変わらなかった。", "Only one moved. Nothing changed."), e: { san: -4 } }],
        bad: [{ m: L("깡통이 내 앞에 떨어졌다. 둘이 이쪽을 봤다.", "缶が目の前に落ちた。2人がこっちを見た。", "The can landed at your feet. Both looked your way."), e: { hp: -18, noise: 15 }, cause: L("깡통을 잘못 던져 약탈자에게 들킴", "缶を投げ損ねて略奪者に見つかった", "Botched a can throw and got spotted by raiders") }] },
    ] },
  { id: "z_scout", ph: N, loc: "night", min: 11, max: 30, w: 2,
    t: L("건너편 옥상에서 손전등 불빛이 깜빡인다. 이쪽 창문을 하나씩 훑고 있다. 약탈자 정찰병이다.", "向かいの屋上で懐中電灯の光が点滅する。こちらの窓をひとつずつなめている。略奪者の偵察兵だ。", "A flashlight blinks from the opposite rooftop, sweeping your windows one by one. A raider scout."),
    c: [
      { t: L("불을 다 끄고 숨죽인다", "明かりを全部消して息を殺す", "Kill every light and hold your breath"), g: 1, o: [{ m: L("불빛이 우리 창에서 오래 머물다 지나갔다.", "光がうちの窓に長く留まってから通り過ぎた。", "The beam lingered on your window, then moved on."), e: { noise: -8, san: -3 } }] },
      { t: L("커튼에 '감염 구역' 글씨를 붙인다", "カーテンに「感染区域」と貼る", "Tape 'INFECTED ZONE' to the curtains"), g: 1, b: 1, o: [{ w: 2, m: L("다음 날 약탈자들은 우리 동을 건너뛰었다.", "翌日、略奪者たちはうちの棟を素通りした。", "The next day the raiders skipped your building."), e: { san: 4, noise: -5 } }, { w: 1, m: L("소용없었다. 오히려 궁금해진 모양이다.", "無駄だった。むしろ興味を持たれたらしい。", "No use. If anything, it made them curious."), e: { noise: 15 } }] },
      { t: L("손전등으로 맞받아 비춘다", "懐中電灯で照らし返す", "Shine your flashlight back"), g: -1, need: "flashlight", o: [{ m: L("불빛이 사라졌다. 다음 날 계단에 낯선 발자국이 찍혀 있었다.", "光が消えた。翌日、階段に見知らぬ足跡がついていた。", "The light vanished. The next day there were strange footprints on the stairs."), e: { noise: 25, san: -5 } }] },
    ] },
  { id: "z_market", ph: D, loc: "mart", min: 10, max: 30, w: 2,
    t: L("버려진 대형마트 주차장에 생존자 장터가 열렸다. 규칙은 하나. \"총 꺼내면 끝.\"", "廃墟の大型スーパーの駐車場で生存者の市が開かれた。ルールはひとつ。「銃を出したら終わり」", "A survivors' market has sprung up in an abandoned supermarket car park. One rule: \"Draw a gun and you're done.\""),
    c: [
      { t: L("야구방망이를 식량과 바꾼다", "バットを食料と交換する", "Trade the bat for food"), g: 0, need: "bat", o: [{ m: L("통조림 여섯 개와 바꿨다. 손이 허전하다.", "缶詰6個と交換した。手元が心もとない。", "Six cans for the bat. Your hands feel empty."), e: { rm: ["bat"], food: 3 } }] },
      { t: L("무전기를 항생제와 바꾼다", "無線機を抗生物質と交換する", "Trade the radio for antibiotics"), g: 0, need: "radio&!antibiotic", o: [{ m: L("상인이 무전기를 귀에 대 보더니 고개를 끄덕였다.", "商人は無線機を耳に当ててうなずいた。", "The trader held the radio to his ear and nodded."), e: { rm: ["radio"], add: ["antibiotic"] } }] },
      { t: L("장작 한 묶음을 산다", "薪をひと束買う", "Buy a bundle of firewood"), g: 1, need: "food>2", o: [{ m: L("식량 하루치를 내고 장작을 샀다.", "食料1日分を払って薪を買った。", "You paid a day's food for firewood."), e: { food: -1, warm: 4 } }] },
      { t: L("구경만 한다", "見物だけする", "Just look around"), g: 0, o: [{ w: 2, m: L("오랜만에 사람 목소리를 실컷 들었다.", "久しぶりに人の声をたっぷり聞いた。", "You heard plenty of human voices for once."), e: { san: 6 } }, { w: 1, m: L("소매치기가 가방을 털어 갔다.", "スリに鞄をやられた。", "A pickpocket cleaned out your bag."), e: { food: -1.5, san: -3 } }] },
    ] },
  // ================= 기타 · 고퀄 =================
  { id: "z_runner", ph: D, loc: "street", min: 15, max: 30, w: 2,
    t: L("저건 걷지 않는다. 뛴다. 진화한 건지, 원래 그랬던 건지. 네 발로 차 지붕을 뛰어넘어 이쪽으로 온다.", "あれは歩かない。走る。進化したのか、元々そうだったのか。四つ足で車の屋根を飛び越えてこっちへ来る。", "That one doesn't walk. It runs. Evolved, or always like that? On all fours it vaults car roofs, heading straight for you."),
    c: [
      { t: L("골목으로 도망친다", "路地へ逃げる", "Run for the alleys"), g: 0, task: "escape", d: 3,
        ok: [{ m: L("좁은 틈으로 몸을 비틀어 넣었다. 그것의 손톱이 벽을 긁었다.", "狭い隙間に体をねじ込んだ。“あれ”の爪が壁を引っかいた。", "You twisted into a narrow gap. Its claws raked the wall."), e: { san: -6 } }],
        mid: [{ m: L("어깨를 붙잡혔다가 옷이 찢어지며 빠져나왔다.", "肩をつかまれたが、服が破れて抜け出せた。", "It caught your shoulder—your jacket tore and you got free."), e: { hp: -14, san: -6 } }],
        bad: [{ m: L("뛰는 좀비는 사람보다 빨랐다.", "走るゾンビは人より速かった。", "The running zombie was faster than you."), e: { hp: -38 }, cause: L("뛰는 좀비에게 따라잡힘", "走るゾンビに追いつかれた", "Run down by a sprinting zombie") }] },
      { t: L("차 안에 숨어 문을 잠근다", "車の中に隠れてドアをロックする", "Hide in a car and lock the doors"), g: 1, o: [{ w: 2, m: L("유리창에 얼굴을 비비다 어디론가 뛰어갔다. 한 시간 뒤에야 나왔다.", "窓に顔をこすりつけてからどこかへ走り去った。1時間後にやっと出た。", "It smeared its face on the glass, then sprinted off. You waited an hour before getting out."), e: { san: -8 } }, { w: 1, m: L("유리가 금이 갔다. 반대쪽 문으로 굴러 나와 뛰었다.", "ガラスにひびが入った。反対側のドアから転がり出て走った。", "The glass cracked. You rolled out the other side and ran."), e: { hp: -16, san: -6 }, cause: L("뛰는 좀비가 차 유리를 깸", "走るゾンビが車の窓を割った", "A sprinter smashed through the car window") }] },
    ] },
  { id: "z_letter", ph: D, loc: "home", min: 6, max: 30, w: 1, once: 1,
    t: L("우편함에 내 이름이 적힌 봉투가 꽂혀 있다. 엄마 글씨다. 날짜는 사태 사흘째.", "郵便受けに自分の名前が書かれた封筒が差してある。母の字だ。日付は事態の3日目。", "There's an envelope with your name in the mailbox. Your mother's handwriting. Dated day three of the outbreak."),
    c: [
      { t: L("읽는다", "読む", "Read it"), g: 0, o: [{ w: 1, m: L("'우리는 할머니 댁으로 간다. 살아서 만나자.' 다시 일어설 이유가 생겼다.", "「おばあちゃんの家に行く。生きて会おう」また立ち上がる理由ができた。", "'We're going to Grandma's. Let's meet alive.' You have a reason to keep going."), e: { san: 22 } }, { w: 1, m: L("'혹시 이 편지를 보면… 우리를 찾지 마.' 손이 떨렸다.", "「もしこの手紙を見たら…私たちを探さないで」手が震えた。", "'If you find this... don't come looking for us.' Your hands shook."), e: { san: -14 } }] },
      { t: L("나중에 읽으려고 주머니에 넣는다", "あとで読もうとポケットに入れる", "Pocket it for later"), g: 1, o: [{ m: L("봉투의 무게가 묘하게 든든했다.", "封筒の重みが妙に心強かった。", "The weight of the envelope was strangely reassuring."), e: { san: 6 } }] },
    ] },
  { id: "z_day25", ph: D, loc: "rooftop", min: 25, max: 25, w: 60, once: 1,
    t: L("25일째. 닷새만 더. 도시 쪽에서 큰 폭발음이 잇달아 울린다. 군이 도시를 '정리'하기 시작했다. 그것들이 도시 밖으로, 이쪽으로 밀려온다.", "25日目。あと5日。都市の方から大きな爆発音が続けざまに響く。軍が都市を「掃討」し始めた。“あれ”が都市の外へ、こちらへ押し寄せてくる。", "Day 25. Five more days. Explosions echo from the city, one after another. The army has begun 'clearing' it—and the dead are being pushed out of the city, toward you."),
    c: [
      { t: L("바리케이드를 한 겹 더 친다", "バリケードをもう一重張る", "Add another layer to the barricade"), g: 1, task: "barricade", d: 3,
        ok: [{ m: L("문과 창이 철옹성이 됐다.", "ドアと窓が鉄壁になった。", "The doors and windows became a fortress."), e: { flag: "fort", noise: -10 } }],
        mid: [{ m: L("못이 몇 개 휘었다. 그래도 없는 것보단 낫다.", "釘が何本か曲がった。それでもないよりましだ。", "A few nails bent. Still better than nothing."), e: { flag: "fort", noise: 8 } }],
        bad: [{ m: L("망치질 소리에 아래층에서 대답하듯 문 긁는 소리가 났다.", "ハンマーの音に応えるように、下の階からドアを引っかく音がした。", "As if answering the hammering, something scratched at a door downstairs."), e: { noise: 25, hp: -10 } }] },
      { t: L("식량을 최대한 모아 둔다", "食料をできるだけ集めておく", "Stockpile as much food as you can"), g: 0, task: "pack", d: 3,
        ok: [{ m: L("배낭이 터질 듯했다.", "リュックがはち切れそうだった。", "Your pack was close to bursting."), e: { san: 4 } }],
        mid: [{ m: L("조금 모았다.", "少し集めた。", "You gathered a little."), e: {} }],
        bad: [{ m: L("쓸데없는 걸 잔뜩 들고 왔다.", "役に立たない物を山ほど持ってきた。", "You hauled back a pile of useless junk."), e: { san: -4 } }] },
      { t: L("조용히 쉬면서 체력을 아낀다", "静かに休んで体力を温存する", "Rest quietly and save your strength"), g: 0, o: [{ m: L("하루 종일 누워 천장만 봤다.", "一日中寝転んで天井ばかり見ていた。", "You lay staring at the ceiling all day."), e: { hp: 8, san: -4 } }] },
    ] },
  { id: "z_mirror", ph: N, loc: "night", min: 16, max: 30, w: 2, need: "san<45",
    t: L("거울 속의 내가 먼저 웃었다. 분명히 내가 웃기 전에.", "鏡の中の自分が先に笑った。確かに自分が笑う前に。", "Your reflection smiled first. Definitely before you did."),
    c: [
      { t: L("거울을 천으로 덮는다", "鏡を布で覆う", "Cover the mirror"), g: 1, o: [{ m: L("덮고 나니 조금 나아졌다. 조금.", "覆ったら少しましになった。少しだけ。", "Better once it was covered. A little."), e: { san: 4 } }] },
      { t: L("진통제를 먹고 잔다", "鎮痛剤を飲んで寝る", "Take painkillers and sleep"), g: 1, need: "painkiller", o: [{ m: L("꿈도 없이 깊이 잤다.", "夢も見ずに深く眠った。", "You slept deep and dreamless."), e: { rm: ["painkiller"], san: 14 } }] },
      { t: L("거울에게 말을 건다", "鏡に話しかける", "Talk to the mirror"), g: -1, o: [{ m: L("밤새 대화했다. 무슨 이야기였는지 기억나지 않는다.", "一晩中話した。何の話だったか覚えていない。", "You talked all night. You can't remember about what."), e: { san: -14 }, cause: L("거울 속 자신과 밤새 대화함", "鏡の中の自分と一晩中話した", "Spent the night talking to your reflection") }] },
    ] },
];

// ---------- 마지막 날 (CORE v3: 그냥 구조되지 않음 — 마지막 손 작업 시험) ----------
export const FORCED3 = {
  rescue: { id: "f_rescue", ph: D, loc: "rooftop", fx: "heli",
    t: L("30일째 정오. 시청 옥상. 헬기에서 밧줄 사다리가 내려온다. 그 순간 계단 문이 터져 나가며 그것들이 쏟아져 들어온다. 사다리까지 스무 걸음.", "30日目の正午。市庁舎の屋上。ヘリから縄梯子が下りてくる。その瞬間、階段のドアが吹き飛び“あれ”がなだれ込んでくる。梯子まで20歩。", "Day 30, noon. City hall rooftop. A rope ladder drops from the helicopter—and the stairwell door bursts open as they pour onto the roof. Twenty steps to the ladder."),
    c: [
      { t: L("사다리까지 전력으로 달린다", "梯子まで全力で走る", "Sprint for the ladder"), g: 1, task: "escape", d: 3,
        ok: [{ m: L("사다리를 붙잡자 헬기가 떠올랐다. 발밑에서 손들이 허공을 휘저었다. 살았다.", "梯子をつかむとヘリが浮き上がった。足元で手が宙をかいた。助かった。", "You grabbed the ladder and the helicopter lifted. Hands clawed at empty air below you. You made it."), e: { rescued: 1 } }],
        mid: [{ m: L("발목을 붙잡혔다. 구조대원이 총을 쏘며 끌어올렸다.", "足首をつかまれた。救助隊員が銃を撃ちながら引き上げてくれた。", "Something caught your ankle. A rescuer fired and hauled you up."), e: { hp: -25, rescued: 1 }, cause: L("구조 헬기 사다리 앞에서 발목을 붙잡힘", "救助ヘリの梯子の前で足首をつかまれた", "Grabbed by the ankle at the rescue ladder") }],
        bad: [{ m: L("다섯 걸음 앞에서 넘어졌다. 헬기 소리가 멀어진다.", "あと5歩のところで転んだ。ヘリの音が遠ざかる。", "You fell five steps short. The rotor noise fades away."), e: { hp: -55, rescued: 1 }, cause: L("구조 헬기를 다섯 걸음 앞에 두고 쓰러짐", "救助ヘリの5歩手前で倒れた", "Fell five steps from the rescue helicopter") }] },
      { t: L("{c}을(를) 먼저 올려 보내고 막아 선다", "{c}を先に上げて立ちはだかる", "Send {c} up first and hold them off"), g: 1, b: 1, need: "comp", o: [{ w: 1, m: L("{c}이(가) 위에서 손을 뻗었다. 마지막 순간 그 손을 잡았다.", "{c}が上から手を伸ばした。最後の瞬間にその手をつかんだ。", "{c} reached down from above. At the last moment, you took their hand."), e: { hp: -20, rescued: 1 }, cause: L("동료를 먼저 보내고 옥상에 남음", "仲間を先に行かせて屋上に残った", "Stayed on the rooftop after sending a companion up first") }] },
    ] },
  lastday: { id: "f_last", ph: D, loc: "street",
    t: L("30일째. 무전도 쪽지도 없었지만, 멀리서 트럭 행렬이 동네로 들어온다. 확성기: \"생존자는 밖으로 나오십시오!\" 군복이다. …정말 군인일까?", "30日目。無線もメモもなかったが、遠くからトラックの列が町に入ってくる。拡声器「生存者は外に出てください！」軍服だ。…本当に軍人だろうか？", "Day 30. No radio, no note—but a convoy of trucks rolls into the neighbourhood. A megaphone: \"Survivors, come outside!\" Uniforms. ...But are they really soldiers?"),
    c: [
      { t: L("숨어서 트럭 쪽 사람들을 살핀다", "隠れてトラックの人々を観察する", "Hide and study the people by the trucks"), g: 1, task: "spot", d: 3,
        ok: [{ m: L("물린 자국을 숨긴 사람, 군복이 안 맞는 사람을 다 가려냈다. 진짜 장교에게 다가갔다. 구조됐다.", "噛み跡を隠した人、軍服が合っていない人を全部見抜いた。本物の将校に近づいた。救助された。", "You picked out everyone hiding a bite and everyone in an ill-fitting uniform, then approached a real officer. Rescued."), e: { rescued: 1 } }],
        mid: [{ m: L("한 명을 잘못 봤다. 트럭에 오르자마자 물린 자가 날뛰었다. 상처를 입고 겨우 구조됐다.", "1人を見誤った。トラックに乗るなり噛まれていた者が暴れ出した。傷を負いながらなんとか救助された。", "You misjudged one. As soon as you boarded, a bitten man went berserk. Wounded, you were still rescued."), e: { hp: -30, rescued: 1 }, cause: L("구조 트럭 안에서 물린 자가 날뜀", "救助トラックの中で噛まれた者が暴れた", "A bitten survivor went berserk inside the rescue truck") }],
        bad: [{ kill: L("군복 입은 약탈자의 트럭에 올라탐", "軍服を着た略奪者のトラックに乗り込んだ", "Climbed into a truck full of raiders in uniform"), m: L("그들은 군인이 아니었다.", "彼らは軍人ではなかった。", "They were not soldiers."), e: {} }] },
      { t: L("무전으로 부대 이름을 확인한다", "無線で部隊名を確認する", "Check their unit over the radio"), g: 1, need: "radio&batteries", o: [{ m: L("무전기 너머 목소리가 부대 번호를 댔다. 진짜였다. 30일, 버텨 냈다.", "無線の向こうの声が部隊番号を答えた。本物だった。30日、耐え抜いた。", "The voice on the radio gave a unit number. Real. Thirty days—you made it."), e: { rescued: 1 } }] },
      { t: L("손을 흔들며 뛰어나간다", "手を振りながら飛び出す", "Run out waving"), g: -1, o: [{ w: 1, m: L("진짜였다. 담요를 받으며 다리가 풀렸다.", "本物だった。毛布を受け取りながら脚の力が抜けた。", "They were real. Your legs gave out as they handed you a blanket."), e: { rescued: 1 } }, { w: 1, kill: L("군복 입은 약탈자의 트럭에 올라탐", "軍服を着た略奪者のトラックに乗り込んだ", "Climbed into a truck full of raiders in uniform"), m: L("그들은 군인이 아니었다.", "彼らは軍人ではなかった。", "They were not soldiers."), e: {} }] },
    ] },
};

// 엔진·화면에서 쓰는 새 글 (하루 정리 줄·알림·타임라인·사인)
for (const [ko, ja, en] of [
  ["🦠 감염됐다! 매일 열이 나고 체력이 줄어든다 (항생제나 간호사가 필요)", "🦠 感染した！毎日熱が出て体力が減る(抗生物質か看護師が必要)", "🦠 Infected! Fever every day and HP keeps dropping (you need antibiotics or the nurse)"],
  ["💉 감염이 나았다", "💉 感染が治った", "💉 Infection cured"],
  ["감염됨", "感染した", "Infected"], ["감염 치료", "感染を治療", "Infection cured"], ["항생제로 감염 치료", "抗生物質で感染を治療", "Cured infection with antibiotics"], ["간호사 덕분에 감염 치료", "看護師のおかげで感染を治療", "Nurse cured the infection"],
  ["난로를 들여놓음", "ストーブを設置", "Installed a stove"],
  ["💉 항생제를 먹었다. 열이 내렸다 (감염 치료)", "💉 抗生物質を飲んだ。熱が下がった(感染治療)", "💉 You took antibiotics. The fever broke (infection cured)"],
  ["감염이 온몸에 퍼짐", "感染が全身に広がった", "The infection spread through your body"],
  ["🧑‍⚕️ 간호사 정우의 치료로 감염이 나았다", "🧑‍⚕️ 看護師ジョンウの治療で感染が治った", "🧑‍⚕️ Nurse Jeong-woo's care cured the infection"],
  ["🔥 난로 덕분에 따뜻한 밤이었다", "🔥 ストーブのおかげで暖かい夜だった", "🔥 A warm night thanks to the stove"],
  ["얼어붙은 겨울밤을 넘기지 못함", "凍える冬の夜を越せなかった", "Didn't survive a freezing winter night"],
  ["❄️ 내일부터 겨울이 온다. 장작이나 난로가 없으면 매일 몸이 상한다", "❄️ 明日から冬が来る。薪かストーブがないと毎日体が弱っていく", "❄️ Winter arrives tomorrow. Without firewood or a stove you'll lose health every day"],
  ["🥬 얼어 가는 텃밭에서 채소를 조금 땄다 (+0.1일)", "🥬 凍りかけの菜園で野菜を少し摘んだ(+0.1日)", "🥬 Picked a few vegetables from the freezing garden (+0.1 day)"],
  ["🦠 감염 — 열·체력이 매일 줄어요 (항생제·간호사)", "🦠 感染 — 毎日熱と体力が減ります(抗生物質・看護師)", "🦠 Infected — losing HP daily (antibiotics/nurse)"],
  ["🥶 겨울 — 장작·난로가 없으면 매일 체력·정신력 -3", "🥶 冬 — 薪・ストーブがないと毎日体力・精神力-3", "🥶 Winter — without firewood/stove, -3 HP & sanity daily"],
  ["🔥 난로 있음", "🔥 ストーブあり", "🔥 Stove installed"],
  ["❄️ 18일부터 겨울", "❄️ 18日目から冬", "❄️ Winter from day 18"],
]) I18N3[ko] = [ja, en];
// 숫자가 들어가는 줄 (번역기 패턴 {a})
Object.assign(I18N3, {
  "🪵 장작 {a}일치를 모았다": ["🪵 薪を{a}日分集めた", "🪵 Gathered {a} days of firewood"],
  "🦠 감염 — 열이 펄펄 끓는다 (체력 -{a}, 정신력 -{b})": ["🦠 感染 — 熱がぐんぐん上がる(体力-{a}、精神力-{b})", "🦠 Infection — burning fever (HP -{a}, sanity -{b})"],
  "🪵 장작을 때서 버텼다 (남은 장작 {a}일)": ["🪵 薪を焚いてしのいだ(残りの薪{a}日分)", "🪵 Burned firewood to get through (firewood left: {a} days)"],
  "🥶 뼛속까지 춥다 (체력 -{a}, 정신력 -{b}) — 장작이나 난로가 필요해": ["🥶 骨の髄まで寒い(体力-{a}、精神力-{b}) — 薪かストーブが必要だ", "🥶 Chilled to the bone (HP -{a}, sanity -{b}) — you need firewood or a stove"],
  "🪵 장작 {a}일": ["🪵 薪{a}日分", "🪵 Firewood: {a} days"],
});
void O;
