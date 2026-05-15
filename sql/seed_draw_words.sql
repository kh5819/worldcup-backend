-- ============================================================
-- 그려봐 (DUO Draw) 공식 문제 단어풀 v1
-- 5 카테고리 × 약 50개 = 250개. 시즌/이슈 단어는 운영하면서 추가.
-- ON CONFLICT 무시 → 재실행 안전 (UNIQUE (category, word))
-- ============================================================

-- ===== 음식 (food) =====
insert into draw_words (category, word, difficulty) values
  ('food','김치',1),('food','떡볶이',1),('food','비빔밥',1),('food','짜장면',1),('food','짬뽕',1),
  ('food','김밥',1),('food','라면',1),('food','피자',1),('food','햄버거',1),('food','치킨',1),
  ('food','계란',1),('food','수박',1),('food','바나나',1),('food','사과',1),('food','딸기',1),
  ('food','초밥',2),('food','삼겹살',2),('food','갈비',2),('food','순두부찌개',2),('food','김치찌개',2),
  ('food','떡국',2),('food','만두',2),('food','잡채',2),('food','불닭볶음면',2),('food','짜파게티',2),
  ('food','케이크',2),('food','도넛',2),('food','와플',2),('food','마카롱',2),('food','아이스크림',2),
  ('food','파스타',2),('food','스테이크',2),('food','샐러드',2),('food','샌드위치',2),('food','핫도그',2),
  ('food','떡',1),('food','송편',2),('food','한과',3),('food','약과',3),('food','식혜',3),
  ('food','국수',2),('food','콩국수',3),('food','평양냉면',3),('food','수라상',3),('food','전주비빔밥',3),
  ('food','마라탕',2),('food','탕수육',2),('food','우유',1),('food','커피',1),('food','녹차',2)
on conflict (category, word) do nothing;

-- ===== 동물 (animal) =====
insert into draw_words (category, word, difficulty) values
  ('animal','강아지',1),('animal','고양이',1),('animal','코끼리',1),('animal','사자',1),('animal','호랑이',1),
  ('animal','곰',1),('animal','토끼',1),('animal','거북이',1),('animal','뱀',1),('animal','개구리',1),
  ('animal','물고기',1),('animal','상어',1),('animal','고래',1),('animal','문어',1),('animal','새우',1),
  ('animal','펭귄',1),('animal','독수리',2),('animal','부엉이',2),('animal','앵무새',2),('animal','참새',1),
  ('animal','말',1),('animal','소',1),('animal','돼지',1),('animal','닭',1),('animal','오리',1),
  ('animal','양',1),('animal','염소',2),('animal','늑대',2),('animal','여우',2),('animal','너구리',2),
  ('animal','캥거루',2),('animal','코알라',2),('animal','판다',1),('animal','기린',1),('animal','얼룩말',2),
  ('animal','악어',2),('animal','하마',2),('animal','코뿔소',2),('animal','낙타',2),('animal','다람쥐',2),
  ('animal','두더지',3),('animal','고슴도치',3),('animal','오랑우탄',3),('animal','침팬지',3),('animal','수달',3),
  ('animal','문어',2),('animal','오징어',2),('animal','해파리',2),('animal','달팽이',2),('animal','거미',2)
on conflict (category, word) do nothing;

-- ===== 사물 (thing) =====
insert into draw_words (category, word, difficulty) values
  ('thing','자동차',1),('thing','비행기',1),('thing','자전거',1),('thing','오토바이',1),('thing','버스',1),
  ('thing','지하철',1),('thing','배',1),('thing','우산',1),('thing','신발',1),('thing','모자',1),
  ('thing','안경',1),('thing','시계',1),('thing','가방',1),('thing','지갑',1),('thing','책',1),
  ('thing','연필',1),('thing','지우개',1),('thing','가위',1),('thing','풀',1),('thing','공책',1),
  ('thing','컴퓨터',1),('thing','노트북',1),('thing','휴대폰',1),('thing','텔레비전',1),('thing','냉장고',1),
  ('thing','전자레인지',2),('thing','세탁기',1),('thing','선풍기',1),('thing','에어컨',1),('thing','히터',2),
  ('thing','침대',1),('thing','책상',1),('thing','의자',1),('thing','소파',1),('thing','거울',1),
  ('thing','문',1),('thing','창문',1),('thing','계단',1),('thing','엘리베이터',2),('thing','에스컬레이터',3),
  ('thing','로켓',2),('thing','잠수함',2),('thing','헬리콥터',2),('thing','드론',2),('thing','요트',2),
  ('thing','우주선',3),('thing','타임머신',3),('thing','로봇',2),('thing','지구본',2),('thing','피아노',2)
on conflict (category, word) do nothing;

-- ===== 캐릭터 (character) =====
insert into draw_words (category, word, difficulty) values
  ('character','뽀로로',1),('character','피카츄',1),('character','도라에몽',1),('character','짱구',1),('character','코난',1),
  ('character','루피',2),('character','쵸파',2),('character','조로',2),('character','나루토',2),('character','사스케',2),
  ('character','손오공',2),('character','베지터',2),('character','짱뚱이',2),('character','캐치티니핑',1),('character','터닝메카드',2),
  ('character','마리오',1),('character','루이지',2),('character','쿠파',2),('character','요시',2),('character','피치공주',2),
  ('character','소닉',1),('character','커비',1),('character','젤다',2),('character','링크',2),('character','동키콩',2),
  ('character','앵그리버드',2),('character','심슨',1),('character','스폰지밥',1),('character','뚱이',2),('character','징징이',2),
  ('character','뽀빠이',2),('character','미키마우스',1),('character','도널드덕',2),('character','구피',2),('character','곰돌이푸',2),
  ('character','엘사',1),('character','안나',2),('character','올라프',2),('character','벨',2),('character','신데렐라',2),
  ('character','스파이더맨',1),('character','아이언맨',1),('character','캡틴아메리카',1),('character','헐크',1),('character','토르',2),
  ('character','배트맨',1),('character','슈퍼맨',1),('character','조커',2),('character','해리포터',2),('character','볼드모트',3)
on conflict (category, word) do nothing;

-- ===== 한국 밈/연예/문화 (meme) =====
insert into draw_words (category, word, difficulty) values
  ('meme','손흥민',1),('meme','김연아',1),('meme','BTS',1),('meme','블랙핑크',1),('meme','뉴진스',1),
  ('meme','아이브',2),('meme','에스파',2),('meme','르세라핌',2),('meme','카리나',2),('meme','민지',2),
  ('meme','지수',2),('meme','제니',2),('meme','로제',2),('meme','리사',2),('meme','뷔',2),
  ('meme','정국',2),('meme','지민',2),('meme','RM',2),('meme','제이홉',2),('meme','슈가',2),
  ('meme','진',2),('meme','카카오톡',1),('meme','네이버',1),('meme','구글',1),('meme','유튜브',1),
  ('meme','인스타그램',1),('meme','틱톡',1),('meme','트위터',1),('meme','페이스북',1),('meme','넷플릭스',1),
  ('meme','오징어게임',1),('meme','기생충',1),('meme','부산행',2),('meme','범죄도시',2),('meme','어벤져스',1),
  ('meme','슈카월드',2),('meme','침착맨',2),('meme','보겸',2),('meme','대도서관',2),('meme','쯔양',2),
  ('meme','한강',1),('meme','경복궁',1),('meme','남산타워',1),('meme','광화문',1),('meme','제주도',1),
  ('meme','김치찌개',1),('meme','삼성',1),('meme','LG',1),('meme','현대',1),('meme','기아',1)
on conflict (category, word) do nothing;
