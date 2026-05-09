// =========================
// DUO 거짓말 매치 (Fibbage 한국형) — 시드 질문 풀 v1
// 룰: 고정값(역사/공식 수치/창립년도/본명) 위주. 시간 의존 통계 금지.
// 5 카테고리 × 30문항 = 150
// =========================

export const FB_CATEGORIES = [
  { id: "game",     label: "게임",        emoji: "🎮" },
  { id: "anime",    label: "애니/덕후",    emoji: "🎌" },
  { id: "food",     label: "음식",        emoji: "🍔" },
  { id: "korea",    label: "한국문화",     emoji: "🇰🇷" },
  { id: "internet", label: "인터넷/밈",    emoji: "🌐" },
];

// question, answer, aliases(정답 매칭 시 동등 처리), decoys(빈 답/트롤 대체용 4개+), source
export const FB_QUESTIONS = {
  game: [
    { id:"g_001", question:"메이플스토리 정식 출시년도는?", answer:"2003", aliases:["2003년"], decoys:["2001","2002","2004","2005"], source:"넥슨 공식" },
    { id:"g_002", question:"리니지 1 정식 출시년도는?", answer:"1998", aliases:["1998년"], decoys:["1996","1997","1999","2000"], source:"엔씨소프트 공식" },
    { id:"g_003", question:"스타크래프트 1 (오리지널) 글로벌 출시년도는?", answer:"1998", aliases:["1998년"], decoys:["1996","1997","1999","2000"], source:"블리자드 공식" },
    { id:"g_004", question:"카트라이더 (구) 첫 정식 출시년도는?", answer:"2004", aliases:["2004년"], decoys:["2002","2003","2005","2006"], source:"넥슨 공식" },
    { id:"g_005", question:"던전앤파이터 한국 정식 서비스 시작년도는?", answer:"2005", aliases:["2005년"], decoys:["2003","2004","2006","2007"], source:"네오플/넥슨 공식" },
    { id:"g_006", question:"검은사막 한국 정식 출시년도는?", answer:"2014", aliases:["2014년"], decoys:["2012","2013","2015","2016"], source:"펄어비스 공식" },
    { id:"g_007", question:"원신 글로벌 정식 출시년도는?", answer:"2020", aliases:["2020년","Genshin","원신 임팩트"], decoys:["2018","2019","2021","2022"], source:"호요버스 공식" },
    { id:"g_008", question:"발로란트 정식 출시년도는?", answer:"2020", aliases:["2020년","Valorant"], decoys:["2018","2019","2021","2022"], source:"라이엇 게임즈 공식" },
    { id:"g_009", question:"마인크래프트 정식 출시년도는?", answer:"2011", aliases:["2011년","Minecraft"], decoys:["2009","2010","2012","2013"], source:"모장/MS 공식" },
    { id:"g_010", question:"오버워치 1 출시년도는?", answer:"2016", aliases:["2016년","Overwatch"], decoys:["2014","2015","2017","2018"], source:"블리자드 공식" },
    { id:"g_011", question:"어몽어스(Among Us) 출시년도는?", answer:"2018", aliases:["2018년"], decoys:["2016","2017","2019","2020"], source:"이너슬로스 공식" },
    { id:"g_012", question:"포켓몬스터 적/녹 (1세대) 일본 출시년도는?", answer:"1996", aliases:["1996년"], decoys:["1994","1995","1997","1998"], source:"닌텐도/게임프리크 공식" },
    { id:"g_013", question:"디아블로 1 출시년도는?", answer:"1996", aliases:["1996년"], decoys:["1994","1995","1997","1998"], source:"블리자드 공식" },
    { id:"g_014", question:"슈퍼마리오 브라더스 일본 출시년도는?", answer:"1985", aliases:["1985년"], decoys:["1983","1984","1986","1987"], source:"닌텐도 공식" },
    { id:"g_015", question:"워크래프트 1 (오크와 휴먼) 출시년도는?", answer:"1994", aliases:["1994년"], decoys:["1992","1993","1995","1996"], source:"블리자드 공식" },
    { id:"g_016", question:"한국 최초의 그래픽 MMORPG는?", answer:"바람의 나라", aliases:["바람의나라","The Kingdom of the Winds"], decoys:["리니지","뮤 온라인","라그나로크","마비노기"], source:"넥슨 공식" },
    { id:"g_017", question:"리그 오브 레전드(LoL) 개발사는?", answer:"라이엇 게임즈", aliases:["라이엇","Riot Games","Riot"], decoys:["블리자드","EA","유비소프트","액티비전"], source:"라이엇 게임즈 공식" },
    { id:"g_018", question:"던전앤파이터 개발사는?", answer:"네오플", aliases:["Neople"], decoys:["넥슨","스마일게이트","엔씨소프트","펄어비스"], source:"네오플 공식" },
    { id:"g_019", question:"검은사막 개발사는?", answer:"펄어비스", aliases:["Pearl Abyss"], decoys:["엔씨소프트","넥슨","네오위즈","스마일게이트"], source:"펄어비스 공식" },
    { id:"g_020", question:"원신 개발사는?", answer:"호요버스", aliases:["미호요","miHoYo","HoYoverse","Hoyoverse"], decoys:["닌텐도","사이게임즈","스퀘어에닉스","캡콤"], source:"호요버스 공식 (구 미호요)" },
    { id:"g_021", question:"로스트아크 개발사는?", answer:"스마일게이트 RPG", aliases:["스마일게이트","Smilegate","Smilegate RPG"], decoys:["엔씨소프트","넥슨","펄어비스","넥스트게임즈"], source:"스마일게이트 RPG 공식" },
    { id:"g_022", question:"슈퍼마리오의 직업은?", answer:"배관공", aliases:["Plumber"], decoys:["목수","요리사","소방관","우편배달부"], source:"닌텐도 공식 설정" },
    { id:"g_023", question:"포켓몬스터 1세대 총 마릿수는?", answer:"151", aliases:["151마리"], decoys:["120","135","200","251"], source:"포켓몬 도감 공식" },
    { id:"g_024", question:"포켓몬스터 2세대까지 누적 마릿수는?", answer:"251", aliases:["251마리"], decoys:["200","220","300","386"], source:"포켓몬 도감 공식" },
    { id:"g_025", question:"닌텐도 창립년도는? (화투 회사로 시작)", answer:"1889", aliases:["1889년"], decoys:["1953","1968","1977","1983"], source:"닌텐도 공식 연혁" },
    { id:"g_026", question:"닌텐도 첫 가정용 콘솔 이름은?", answer:"패미콤", aliases:["패밀리 컴퓨터","Famicom","패미컴","FC"], decoys:["게임보이","슈퍼패미콤","닌텐도 64","위(Wii)"], source:"닌텐도 공식 연혁 (1983 일본 발매)" },
    { id:"g_027", question:"리그 오브 레전드 한국 정식 서비스 시작년도는?", answer:"2011", aliases:["2011년"], decoys:["2009","2010","2012","2013"], source:"라이엇 게임즈 코리아 공식" },
    { id:"g_028", question:"슈퍼마리오의 동생 이름은?", answer:"루이지", aliases:["Luigi"], decoys:["와리오","요시","피치","쿠파"], source:"닌텐도 공식 설정" },
    { id:"g_029", question:"슈퍼마리오 시리즈 메인 빌런(거북이 보스) 본명은?", answer:"쿠파", aliases:["Bowser","바우저"], decoys:["동키콩","와리오","킹기도라","가논"], source:"닌텐도 공식 설정" },
    { id:"g_030", question:"컴투스 창립년도는?", answer:"1998", aliases:["1998년"], decoys:["1995","1996","2000","2001"], source:"컴투스 공식 연혁 (1998년 1월 창립)" },
  ],

  anime: [
    { id:"a_001", question:"원피스 첫 연재 시작년도는? (주간소년점프)", answer:"1997", aliases:["1997년"], decoys:["1995","1996","1998","1999"], source:"슈에이샤 공식" },
    { id:"a_002", question:"나루토 첫 연재 시작년도는?", answer:"1999", aliases:["1999년"], decoys:["1997","1998","2000","2001"], source:"슈에이샤 공식" },
    { id:"a_003", question:"드래곤볼 첫 연재 시작년도는?", answer:"1984", aliases:["1984년"], decoys:["1982","1983","1985","1986"], source:"슈에이샤 공식" },
    { id:"a_004", question:"진격의 거인 첫 연재 시작년도는?", answer:"2009", aliases:["2009년"], decoys:["2007","2008","2010","2011"], source:"코단샤 공식" },
    { id:"a_005", question:"귀멸의 칼날 첫 연재 시작년도는?", answer:"2016", aliases:["2016년"], decoys:["2014","2015","2017","2018"], source:"슈에이샤 공식" },
    { id:"a_006", question:"주술회전 첫 연재 시작년도는?", answer:"2018", aliases:["2018년"], decoys:["2016","2017","2019","2020"], source:"슈에이샤 공식" },
    { id:"a_007", question:"슬램덩크 첫 연재 시작년도는?", answer:"1990", aliases:["1990년"], decoys:["1988","1989","1991","1992"], source:"슈에이샤 공식" },
    { id:"a_008", question:"명탐정 코난 첫 연재 시작년도는?", answer:"1994", aliases:["1994년"], decoys:["1992","1993","1995","1996"], source:"쇼가쿠칸 공식" },
    { id:"a_009", question:"도라에몽 첫 연재 시작년도는?", answer:"1969", aliases:["1969년"], decoys:["1965","1967","1971","1973"], source:"쇼가쿠칸 공식" },
    { id:"a_010", question:"원피스 작가 이름은?", answer:"오다 에이이치로", aliases:["오다","에이치로 오다","Eiichiro Oda"], decoys:["키시모토 마사시","토리야마 아키라","이노우에 다케히코","아라카와 히로무"], source:"슈에이샤 공식" },
    { id:"a_011", question:"나루토 작가 이름은?", answer:"키시모토 마사시", aliases:["키시모토","Masashi Kishimoto"], decoys:["오다 에이이치로","타카하시 루미코","쿠보 타이토","아라카와 히로무"], source:"슈에이샤 공식" },
    { id:"a_012", question:"드래곤볼 작가 이름은?", answer:"토리야마 아키라", aliases:["토리야마","Akira Toriyama"], decoys:["오다 에이이치로","키시모토 마사시","이노우에 다케히코","아라카와 히로무"], source:"슈에이샤 공식" },
    { id:"a_013", question:"귀멸의 칼날 작가 이름은?", answer:"고토게 코요하루", aliases:["고토게","Koyoharu Gotouge"], decoys:["아쿠타미 게게","이사야마 하지메","오다 에이이치로","쿠보 타이토"], source:"슈에이샤 공식" },
    { id:"a_014", question:"진격의 거인 작가 이름은?", answer:"이사야마 하지메", aliases:["이사야마","Hajime Isayama"], decoys:["고토게 코요하루","아쿠타미 게게","오다 에이이치로","타카하시 루미코"], source:"코단샤 공식" },
    { id:"a_015", question:"주술회전 작가 이름은?", answer:"아쿠타미 게게", aliases:["아쿠타미","Gege Akutami"], decoys:["고토게 코요하루","이사야마 하지메","타카하시 카즈키","쿠보 타이토"], source:"슈에이샤 공식" },
    { id:"a_016", question:"슬램덩크 작가 이름은?", answer:"이노우에 다케히코", aliases:["이노우에","Takehiko Inoue"], decoys:["오다 에이이치로","토리야마 아키라","아라카와 히로무","키시모토 마사시"], source:"슈에이샤 공식" },
    { id:"a_017", question:"강철의 연금술사 작가 이름은?", answer:"아라카와 히로무", aliases:["아라카와","Hiromu Arakawa"], decoys:["고토게 코요하루","오다 에이이치로","쿠보 타이토","이사야마 하지메"], source:"스퀘어에닉스 공식" },
    { id:"a_018", question:"짱구는 못말려(크레용 신짱) 작가 이름은?", answer:"우스이 요시토", aliases:["우스이","Yoshito Usui"], decoys:["후지코 F. 후지오","아오야마 고쇼","토리야마 아키라","타카하시 루미코"], source:"후타바샤 공식" },
    { id:"a_019", question:"도라에몽 작가의 필명은?", answer:"후지코 F. 후지오", aliases:["후지코","Fujiko F. Fujio"], decoys:["우스이 요시토","타카하시 루미코","오다 에이이치로","키시모토 마사시"], source:"쇼가쿠칸 공식" },
    { id:"a_020", question:"원피스 주인공 본명(풀네임)은?", answer:"몽키 D. 루피", aliases:["루피","Monkey D. Luffy","몽키D루피"], decoys:["몽키 D. 가프","포트가스 D. 에이스","롤로노아 조로","해적왕"], source:"원피스 공식 설정" },
    { id:"a_021", question:"슬램덩크 주인공 한국명은?", answer:"강백호", aliases:["사쿠라기 하나미치","사쿠라기","Sakuragi Hanamichi"], decoys:["정대만","서태웅","송태섭","채치수"], source:"슬램덩크 한국판 공식 번역" },
    { id:"a_022", question:"슬램덩크 강백호의 등번호는?", answer:"10번", aliases:["10","십번"], decoys:["4번","7번","9번","14번"], source:"슬램덩크 공식 설정" },
    { id:"a_023", question:"명탐정 코난(에도가와 코난) 본명은?", answer:"쿠도 신이치", aliases:["신이치","Kudo Shinichi","공도 신이치"], decoys:["모리 란","하이바라 아이","핫토리 헤이지","코고로 모리"], source:"명탐정 코난 공식 설정" },
    { id:"a_024", question:"데스노트 주인공 본명은?", answer:"야가미 라이토", aliases:["라이토","Yagami Light","Light Yagami"], decoys:["엘 로라이트","미사 아마네","니아","멜로"], source:"데스노트 공식 설정" },
    { id:"a_025", question:"짱구(한국명 신짱구)의 일본 원작 본명은?", answer:"노하라 신노스케", aliases:["신노스케","Shinnosuke Nohara"], decoys:["노비타","사쿠라기 하나미치","모로보시 아타루","카키노 신지"], source:"크레용 신짱 공식 설정" },
    { id:"a_026", question:"짱구네 강아지 한국명은?", answer:"흰둥이", aliases:["Shiro","시로"], decoys:["멍멍이","콩이","검둥이","뽀삐"], source:"짱구는 못말려 한국판 공식" },
    { id:"a_027", question:"도라에몽 주인공 노비타의 한국명은?", answer:"노진구", aliases:["진구"], decoys:["노비타","노만석","노진수","노진우"], source:"도라에몽 한국판 공식 번역" },
    { id:"a_028", question:"이웃집 토토로 일본 개봉년도는?", answer:"1988", aliases:["1988년"], decoys:["1985","1986","1989","1990"], source:"스튜디오 지브리 공식" },
    { id:"a_029", question:"센과 치히로의 행방불명 일본 개봉년도는?", answer:"2001", aliases:["2001년"], decoys:["1999","2000","2002","2003"], source:"스튜디오 지브리 공식" },
    { id:"a_030", question:"너의 이름은. 일본 개봉년도는?", answer:"2016", aliases:["2016년"], decoys:["2014","2015","2017","2018"], source:"코믹스 웨이브 필름 공식" },
  ],

  food: [
    { id:"f_001", question:"농심 신라면 출시년도는?", answer:"1986", aliases:["1986년"], decoys:["1984","1985","1987","1988"], source:"농심 공식 연혁" },
    { id:"f_002", question:"농심 짜파게티 출시년도는?", answer:"1984", aliases:["1984년"], decoys:["1982","1983","1985","1986"], source:"농심 공식 연혁" },
    { id:"f_003", question:"농심 새우깡 출시년도는?", answer:"1971", aliases:["1971년"], decoys:["1969","1970","1973","1975"], source:"농심 공식 연혁" },
    { id:"f_004", question:"오리온 초코파이(情) 출시년도는?", answer:"1974", aliases:["1974년"], decoys:["1972","1973","1975","1976"], source:"오리온 공식 연혁" },
    { id:"f_005", question:"빙그레 바나나맛 우유 출시년도는?", answer:"1974", aliases:["1974년"], decoys:["1972","1973","1975","1976"], source:"빙그레 공식 연혁" },
    { id:"f_006", question:"빙그레 메로나 출시년도는?", answer:"1992", aliases:["1992년"], decoys:["1990","1991","1993","1994"], source:"빙그레 공식 연혁" },
    { id:"f_007", question:"오뚜기 진라면 출시년도는?", answer:"1988", aliases:["1988년"], decoys:["1986","1987","1989","1990"], source:"오뚜기 공식 연혁" },
    { id:"f_008", question:"삼양식품 불닭볶음면 출시년도는?", answer:"2012", aliases:["2012년"], decoys:["2010","2011","2013","2014"], source:"삼양식품 공식 연혁" },
    { id:"f_009", question:"농심 자갈치(스낵) 출시년도는?", answer:"1981", aliases:["1981년"], decoys:["1979","1980","1982","1983"], source:"농심 공식 연혁" },
    { id:"f_010", question:"CJ 비비고 만두 출시년도는?", answer:"2013", aliases:["2013년"], decoys:["2011","2012","2014","2015"], source:"CJ제일제당 공식" },
    { id:"f_011", question:"교촌치킨 창립년도는?", answer:"1991", aliases:["1991년"], decoys:["1989","1990","1992","1993"], source:"교촌에프앤비 공식 연혁" },
    { id:"f_012", question:"BBQ치킨 창립년도는?", answer:"1995", aliases:["1995년"], decoys:["1993","1994","1996","1997"], source:"제너시스BBQ 공식 연혁" },
    { id:"f_013", question:"굽네치킨 창립년도는?", answer:"2005", aliases:["2005년"], decoys:["2003","2004","2006","2007"], source:"지엔푸드 공식 연혁" },
    { id:"f_014", question:"빙그레 창립년도는? (대일유업으로 출범)", answer:"1967", aliases:["1967년"], decoys:["1965","1966","1968","1969"], source:"빙그레 공식 연혁" },
    { id:"f_015", question:"농심 창립년도는? (롯데공업으로 출범)", answer:"1965", aliases:["1965년"], decoys:["1963","1964","1966","1967"], source:"농심 공식 연혁 (1978년 농심으로 사명변경)" },
    { id:"f_016", question:"신당동 떡볶이 원조로 알려진 인물은?", answer:"마복림 할머니", aliases:["마복림","마 할머니"], decoys:["장금이","김복희","박서방","이순자"], source:"마복림 떡볶이 가게 공식" },
    { id:"f_017", question:"신당동 떡볶이가 시작된 해는? (마복림 떡볶이 기준)", answer:"1953", aliases:["1953년"], decoys:["1948","1950","1955","1958"], source:"마복림 떡볶이 가게 공식 연혁" },
    { id:"f_018", question:"비빔밥으로 가장 유명한 한국 도시는?", answer:"전주", aliases:["전주시","Jeonju"], decoys:["광주","대구","부산","안동"], source:"전주시 관광 공식" },
    { id:"f_019", question:"한국 롯데리아 1호점 개점년도는?", answer:"1979", aliases:["1979년"], decoys:["1977","1978","1980","1981"], source:"롯데리아 공식 연혁 (소공동 1호점)" },
    { id:"f_020", question:"한국 맥도날드 1호점 개점년도는?", answer:"1988", aliases:["1988년"], decoys:["1986","1987","1989","1990"], source:"한국맥도날드 공식 연혁 (압구정점)" },
    { id:"f_021", question:"한국 스타벅스 1호점 개점년도는?", answer:"1999", aliases:["1999년"], decoys:["1997","1998","2000","2001"], source:"스타벅스 코리아 공식 연혁 (이대점)" },
    { id:"f_022", question:"스타벅스 본사가 위치한 미국 도시는?", answer:"시애틀", aliases:["Seattle"], decoys:["뉴욕","샌프란시스코","시카고","포틀랜드"], source:"스타벅스 공식" },
    { id:"f_023", question:"인스턴트 라면(치킨라멘)을 발명한 사람은?", answer:"안도 모모후쿠", aliases:["안도","Momofuku Ando"], decoys:["김복기","혼다 소이치로","마쓰시타 코노스케","손정의"], source:"닛신식품 공식" },
    { id:"f_024", question:"치킨라멘이 발명된 해는?", answer:"1958", aliases:["1958년"], decoys:["1955","1956","1959","1961"], source:"닛신식품 공식" },
    { id:"f_025", question:"한국 김장문화가 유네스코 인류무형문화유산에 등재된 해는?", answer:"2013", aliases:["2013년"], decoys:["2010","2011","2014","2015"], source:"유네스코 공식" },
    { id:"f_026", question:"단무지의 일본 이름은?", answer:"다쿠앙", aliases:["다쿠완","Takuan","타쿠앙"], decoys:["와사비","우메보시","낫토","쓰케모노"], source:"일본 식품 표준명" },
    { id:"f_027", question:"햄버거 어원이 된 독일 도시는?", answer:"함부르크", aliases:["Hamburg"], decoys:["뮌헨","베를린","드레스덴","쾰른"], source:"음식 어원 사전" },
    { id:"f_028", question:"코카콜라가 발명된 해는?", answer:"1886", aliases:["1886년"], decoys:["1880","1885","1890","1895"], source:"코카콜라 공식" },
    { id:"f_029", question:"코카콜라를 처음 만든 사람은?", answer:"존 펨버튼", aliases:["펨버튼","John Pemberton"], decoys:["에디슨","라이트형제","마크 트웨인","록펠러"], source:"코카콜라 공식 역사" },
    { id:"f_030", question:"오뚜기 3분 카레 출시년도는?", answer:"1981", aliases:["1981년"], decoys:["1978","1979","1982","1983"], source:"오뚜기 공식 연혁" },
  ],

  korea: [
    { id:"k_001", question:"한글날은 몇 월 며칠?", answer:"10월 9일", aliases:["10/9","10.9","10월9일"], decoys:["9월 9일","10월 1일","10월 3일","10월 25일"], source:"대한민국 국경일" },
    { id:"k_002", question:"광복절은 몇 월 며칠?", answer:"8월 15일", aliases:["8/15","8.15","8월15일"], decoys:["3월 1일","6월 25일","8월 25일","10월 1일"], source:"대한민국 국경일" },
    { id:"k_003", question:"6.25 전쟁이 발발한 해는?", answer:"1950", aliases:["1950년"], decoys:["1948","1949","1951","1952"], source:"한국 현대사 공식" },
    { id:"k_004", question:"서울올림픽 개최년도는?", answer:"1988", aliases:["1988년"], decoys:["1986","1987","1989","1990"], source:"IOC 공식" },
    { id:"k_005", question:"대한민국 초대 대통령은?", answer:"이승만", aliases:["Syngman Rhee","리승만"], decoys:["박정희","김구","윤보선","장면"], source:"대한민국 정부 공식" },
    { id:"k_006", question:"카카오톡 출시년도는?", answer:"2010", aliases:["2010년"], decoys:["2008","2009","2011","2012"], source:"카카오 공식 (2010.3.18 출시)" },
    { id:"k_007", question:"네이버(NHN→네이버) 분사 창립년도는?", answer:"1999", aliases:["1999년"], decoys:["1996","1998","2000","2001"], source:"네이버 공식 연혁 (1999년 6월 분사)" },
    { id:"k_008", question:"다음(Daum) 창립년도는?", answer:"1995", aliases:["1995년"], decoys:["1993","1994","1996","1997"], source:"다음 공식 연혁" },
    { id:"k_009", question:"싸이월드 창립년도는?", answer:"1999", aliases:["1999년"], decoys:["1997","1998","2000","2001"], source:"싸이월드 공식 연혁" },
    { id:"k_010", question:"서울 지하철 1호선 개통년도는?", answer:"1974", aliases:["1974년"], decoys:["1972","1973","1975","1976"], source:"서울교통공사 공식" },
    { id:"k_011", question:"KBS TV 첫 방송년도는?", answer:"1961", aliases:["1961년"], decoys:["1958","1960","1962","1963"], source:"KBS 공식 연혁" },
    { id:"k_012", question:"SBS 개국년도는?", answer:"1991", aliases:["1991년"], decoys:["1989","1990","1992","1993"], source:"SBS 공식 연혁" },
    { id:"k_013", question:"카카오톡을 처음 만든 회사 이름은?", answer:"아이위랩", aliases:["IWILAB","카카오"], decoys:["네이버","NHN","SK텔레콤","다음"], source:"카카오 공식 (현 (주)카카오의 전신)" },
    { id:"k_014", question:"BTS(방탄소년단) 데뷔년도는?", answer:"2013", aliases:["2013년"], decoys:["2011","2012","2014","2015"], source:"빅히트(현 HYBE) 공식" },
    { id:"k_015", question:"블랙핑크 데뷔년도는?", answer:"2016", aliases:["2016년"], decoys:["2014","2015","2017","2018"], source:"YG 공식" },
    { id:"k_016", question:"트와이스 데뷔년도는?", answer:"2015", aliases:["2015년"], decoys:["2013","2014","2016","2017"], source:"JYP 공식" },
    { id:"k_017", question:"소녀시대 데뷔년도는?", answer:"2007", aliases:["2007년"], decoys:["2005","2006","2008","2009"], source:"SM 공식" },
    { id:"k_018", question:"빅뱅 데뷔년도는?", answer:"2006", aliases:["2006년"], decoys:["2004","2005","2007","2008"], source:"YG 공식" },
    { id:"k_019", question:"동방신기 데뷔년도는?", answer:"2003", aliases:["2003년"], decoys:["2001","2002","2004","2005"], source:"SM 공식 (2003.12.26 데뷔무대)" },
    { id:"k_020", question:"SM엔터테인먼트 창립자는?", answer:"이수만", aliases:["Lee Soo-man","SM Lee"], decoys:["박진영","양현석","방시혁","김광수"], source:"SM 공식" },
    { id:"k_021", question:"JYP엔터테인먼트 창립자는?", answer:"박진영", aliases:["JYP","J.Y. Park"], decoys:["이수만","양현석","방시혁","현빈"], source:"JYP 공식" },
    { id:"k_022", question:"YG엔터테인먼트 창립자는?", answer:"양현석", aliases:["Yang Hyun-suk"], decoys:["이수만","박진영","방시혁","지누"], source:"YG 공식" },
    { id:"k_023", question:"HYBE(구 빅히트) 창립자는?", answer:"방시혁", aliases:["Bang Si-hyuk","Hitman Bang"], decoys:["이수만","박진영","양현석","RM"], source:"HYBE 공식" },
    { id:"k_024", question:"2002 한일 월드컵에서 한국 국가대표팀 최종 순위는?", answer:"4위", aliases:["4","4등","4th"], decoys:["3위","5위","6위","8위"], source:"FIFA 공식" },
    { id:"k_025", question:"박지성이 처음 진출한 유럽 클럽은?", answer:"PSV 에인트호번", aliases:["PSV","에인트호번","Eindhoven","PSV Eindhoven"], decoys:["맨체스터 유나이티드","아인트라흐트","AC밀란","QPR"], source:"PSV 공식 (2003년 입단)" },
    { id:"k_026", question:"손흥민이 처음 진출한 유럽 클럽은?", answer:"함부르크 SV", aliases:["함부르크","HSV","Hamburg","Hamburg SV"], decoys:["레버쿠젠","토트넘","도르트문트","바이에른"], source:"함부르크 SV 공식" },
    { id:"k_027", question:"한국 첫 동계올림픽 개최 도시는?", answer:"평창", aliases:["Pyeongchang","평창군"], decoys:["서울","부산","강릉","속초"], source:"IOC 공식" },
    { id:"k_028", question:"평창 동계올림픽 개최년도는?", answer:"2018", aliases:["2018년"], decoys:["2014","2016","2020","2022"], source:"IOC 공식" },
    { id:"k_029", question:"싸이의 '강남스타일' 발매년도는?", answer:"2012", aliases:["2012년"], decoys:["2010","2011","2013","2014"], source:"YG 공식 (2012.7.15 발매)" },
    { id:"k_030", question:"한국 가수 최초로 빌보드 핫100 1위에 오른 곡은?", answer:"Dynamite", aliases:["다이너마이트","BTS Dynamite"], decoys:["Butter","Boy with Luv","Gangnam Style","Like Crazy"], source:"빌보드 공식 (BTS, 2020)" },
  ],

  internet: [
    { id:"i_001", question:"페이스북 창립년도는?", answer:"2004", aliases:["2004년"], decoys:["2002","2003","2005","2006"], source:"Meta 공식" },
    { id:"i_002", question:"유튜브 창립년도는?", answer:"2005", aliases:["2005년"], decoys:["2003","2004","2006","2007"], source:"구글/유튜브 공식" },
    { id:"i_003", question:"트위터 창립년도는?", answer:"2006", aliases:["2006년"], decoys:["2004","2005","2007","2008"], source:"트위터(X) 공식" },
    { id:"i_004", question:"인스타그램 창립년도는?", answer:"2010", aliases:["2010년"], decoys:["2008","2009","2011","2012"], source:"Meta 공식" },
    { id:"i_005", question:"디시인사이드 창립년도는?", answer:"1999", aliases:["1999년"], decoys:["1997","1998","2000","2001"], source:"디시인사이드 공식 연혁" },
    { id:"i_006", question:"네이버 지식인 출시년도는?", answer:"2002", aliases:["2002년"], decoys:["2000","2001","2003","2004"], source:"네이버 공식 (2002.10 오픈)" },
    { id:"i_007", question:"비트코인 백서가 발표된 해는?", answer:"2008", aliases:["2008년"], decoys:["2006","2007","2009","2010"], source:"Bitcoin Whitepaper 공식 (2008.10)" },
    { id:"i_008", question:"비트코인 백서를 작성한 사람의 가명은?", answer:"사토시 나카모토", aliases:["Satoshi","Satoshi Nakamoto","나카모토 사토시"], decoys:["일론 머스크","팀 쿡","빌 게이츠","이세돌"], source:"Bitcoin Whitepaper 공식" },
    { id:"i_009", question:"이더리움 메인넷 출시년도는?", answer:"2015", aliases:["2015년"], decoys:["2013","2014","2016","2017"], source:"이더리움 재단 공식" },
    { id:"i_010", question:"도지코인(Dogecoin) 출시년도는?", answer:"2013", aliases:["2013년"], decoys:["2011","2012","2014","2015"], source:"Dogecoin 공식" },
    { id:"i_011", question:"ChatGPT 첫 공개년도는?", answer:"2022", aliases:["2022년"], decoys:["2020","2021","2023","2024"], source:"OpenAI 공식 (2022.11.30)" },
    { id:"i_012", question:"ChatGPT 개발사는?", answer:"OpenAI", aliases:["오픈AI","오픈에이아이"], decoys:["구글","메타","마이크로소프트","Anthropic"], source:"OpenAI 공식" },
    { id:"i_013", question:"페이스북이 사명을 'Meta'로 변경한 해는?", answer:"2021", aliases:["2021년"], decoys:["2019","2020","2022","2023"], source:"Meta 공식 (2021.10.28)" },
    { id:"i_014", question:"유튜브 첫 업로드 영상의 제목은?", answer:"Me at the zoo", aliases:["미 앳 더 주","Me at the Zoo"], decoys:["How to be cool","First video ever","Hello YouTube","Welcome"], source:"유튜브 공식 (2005.4.23 업로드)" },
    { id:"i_015", question:"Doge(도지) 밈의 강아지 견종은?", answer:"시바 이누", aliases:["Shiba Inu","시바","시바견"], decoys:["아키타","포메라니안","진돗개","사모예드"], source:"인터넷 밈 사전" },
    { id:"i_016", question:"Pepe the Frog(페페 더 프로그) 캐릭터를 만든 만화가는?", answer:"맷 퓨리", aliases:["Matt Furie","매트 퓨리"], decoys:["매트 그레이닝","스콧 캐버스","제프 카플란","요시 노다"], source:"Boy's Club 공식 (2005)" },
    { id:"i_017", question:"한국 인터넷 용어 '짤방'의 어원은?", answer:"짤림 방지", aliases:["짤림방지","잘림 방지","짤방지"], decoys:["짧은 사진","짜릿한 사진","짤박이","짤짤이"], source:"디시인사이드 게시판 유래 (게시글 짤림 방지용 이미지)" },
    { id:"i_018", question:"'TMI'의 풀네임은?", answer:"Too Much Information", aliases:["too much information","투 머치 인포메이션"], decoys:["Tell Me Inside","Time My Info","Trust Me Internet","Today My Info"], source:"영어 약어 사전" },
    { id:"i_019", question:"'ASMR'의 풀네임은?", answer:"Autonomous Sensory Meridian Response", aliases:["autonomous sensory meridian response"], decoys:["Audio Stream Mood Relaxation","Asleep Mode Resting","Acoustic Soft Mind Relax","Auto Soft Music Recording"], source:"공식 약어 표준" },
    { id:"i_020", question:"인터넷 신조어 'JMT'의 뜻은?", answer:"존맛탱", aliases:["존맛탱구리","ㅈㅁㅌ"], decoys:["정말 맛있는 탕","저녁 먹는 탕","존경하는 맛","진짜 매운 탕"], source:"한국 인터넷 신조어" },
    { id:"i_021", question:"'ㅂㄷㅂㄷ'은 무엇을 줄인 표현?", answer:"부들부들", aliases:["부들부들"], decoys:["반들반들","벌떡벌떡","번득번득","별달별달"], source:"한국 인터넷 신조어" },
    { id:"i_022", question:"'ㄱㅇㄷ'은 무엇을 줄인 표현?", answer:"개이득", aliases:["개이득"], decoys:["그 와 동","그래 응 다","괜찮 어 다","가요 옷 다"], source:"한국 인터넷 신조어" },
    { id:"i_023", question:"'ㅇㅈ'은 무엇을 줄인 표현?", answer:"인정", aliases:["인정","ㅇㅈ"], decoys:["엉정","응 짱","이지","오징어"], source:"한국 인터넷 신조어" },
    { id:"i_024", question:"'ㄹㅇ'은 무엇을 줄인 표현?", answer:"리얼", aliases:["리얼","Real"], decoys:["라이크","렐로","로얄","럭키"], source:"한국 인터넷 신조어" },
    { id:"i_025", question:"신세기 에반게리온 일본 첫 방영년도는?", answer:"1995", aliases:["1995년"], decoys:["1993","1994","1996","1997"], source:"가이낙스 공식" },
    { id:"i_026", question:"트위치(Twitch) 창립년도는?", answer:"2011", aliases:["2011년"], decoys:["2009","2010","2012","2013"], source:"Twitch 공식 (Justin.tv에서 분리)" },
    { id:"i_027", question:"'GTA' 시리즈의 풀네임은?", answer:"Grand Theft Auto", aliases:["grand theft auto","그랜드 테프트 오토"], decoys:["Great Thunder Action","Global Trade Auto","Game Time Auto","Get The Auto"], source:"Rockstar Games 공식" },
    { id:"i_028", question:"게임 용어 'NPC'의 풀네임은?", answer:"Non-Player Character", aliases:["non-player character","non player character"], decoys:["No Player Click","Network Personal Char","Next Player Card","None Personal Card"], source:"게임 표준 용어" },
    { id:"i_029", question:"인터넷 커뮤니티 '일베저장소'의 독립 분리 해는?", answer:"2010", aliases:["2010년"], decoys:["2008","2009","2011","2012"], source:"디시 일간베스트 → 일베저장소 분리 시기" },
    { id:"i_030", question:"인스타그램을 인수한 회사는?", answer:"페이스북", aliases:["Facebook","Meta","메타"], decoys:["구글","마이크로소프트","트위터","아마존"], source:"Meta 공식 (2012년 10억달러 인수)" },
  ],
};

// helper: 카테고리에서 랜덤 질문 1개 (used 제외)
export function pickRandomQuestion(category, usedIds) {
  const pool = FB_QUESTIONS[category] || [];
  const candidates = pool.filter(q => !usedIds.has(q.id));
  if (candidates.length === 0) {
    // 모든 질문 소진 시 used 초기화 후 다시
    return pool[Math.floor(Math.random() * pool.length)] || null;
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// helper: 정답 정규화 (luckyHit 매칭/가짜 중복 검사용)
export function normalizeAnswer(s) {
  return String(s || "")
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[.,!?'"()\-_~·~]/g, "");
}

// helper: 가짜 답이 진짜 답(또는 alias)과 일치하는지
export function isLuckyHit(fakeText, question) {
  const norm = normalizeAnswer(fakeText);
  if (!norm) return false;
  if (normalizeAnswer(question.answer) === norm) return true;
  for (const a of (question.aliases || [])) {
    if (normalizeAnswer(a) === norm) return true;
  }
  return false;
}

// helper: 빈 답/트롤 → decoys에서 랜덤 채우기 (사용된 텍스트 제외)
export function pickDecoy(question, usedTexts) {
  const decoys = (question.decoys || []).slice();
  for (let i = decoys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [decoys[i], decoys[j]] = [decoys[j], decoys[i]];
  }
  for (const d of decoys) {
    const norm = normalizeAnswer(d);
    if (!usedTexts.has(norm)) return d;
  }
  return decoys[0] || "(미입력)";
}
