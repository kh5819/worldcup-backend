// 플듀 상식 진단소 — 지도용 나라 위치표 (공개 정보, 정답 아님). 서버·화면 공용 (js/know/know-geo.js와 같은 파일)
// lat/lon = 나라 대략 중심(수도 아님). 지도 선택 문제는 보기 나라들만 표시하므로 대략이면 충분
export const COUNTRIES = {
  KR: { ko: "대한민국", lat: 36.5, lon: 127.8 }, JP: { ko: "일본", lat: 36.2, lon: 138.3 }, CN: { ko: "중국", lat: 35.9, lon: 104.2 },
  MN: { ko: "몽골", lat: 46.9, lon: 103.8 }, VN: { ko: "베트남", lat: 14.1, lon: 108.3 }, TH: { ko: "태국", lat: 15.9, lon: 101.0 },
  ID: { ko: "인도네시아", lat: -2.5, lon: 118.0 }, PH: { ko: "필리핀", lat: 12.9, lon: 121.8 }, IN: { ko: "인도", lat: 20.6, lon: 79.0 },
  PK: { ko: "파키스탄", lat: 30.4, lon: 69.3 }, BD: { ko: "방글라데시", lat: 23.7, lon: 90.4 }, NP: { ko: "네팔", lat: 28.4, lon: 84.1 },
  KZ: { ko: "카자흐스탄", lat: 48.0, lon: 66.9 }, UZ: { ko: "우즈베키스탄", lat: 41.4, lon: 64.6 }, KG: { ko: "키르기스스탄", lat: 41.2, lon: 74.8 },
  SA: { ko: "사우디아라비아", lat: 23.9, lon: 45.1 }, IR: { ko: "이란", lat: 32.4, lon: 53.7 }, TR: { ko: "튀르키예", lat: 39.0, lon: 35.2 },
  EG: { ko: "이집트", lat: 26.8, lon: 30.8 }, LY: { ko: "리비아", lat: 26.3, lon: 17.2 }, SD: { ko: "수단", lat: 12.9, lon: 30.2 },
  KE: { ko: "케냐", lat: -0.0, lon: 37.9 }, ET: { ko: "에티오피아", lat: 9.1, lon: 40.5 }, NG: { ko: "나이지리아", lat: 9.1, lon: 8.7 },
  ZA: { ko: "남아프리카 공화국", lat: -30.6, lon: 22.9 }, MA: { ko: "모로코", lat: 31.8, lon: -7.1 }, MG: { ko: "마다가스카르", lat: -18.8, lon: 46.9 },
  FR: { ko: "프랑스", lat: 46.2, lon: 2.2 }, DE: { ko: "독일", lat: 51.2, lon: 10.5 }, IT: { ko: "이탈리아", lat: 41.9, lon: 12.6 },
  ES: { ko: "스페인", lat: 40.5, lon: -3.7 }, PT: { ko: "포르투갈", lat: 39.4, lon: -8.2 }, GB: { ko: "영국", lat: 55.4, lon: -3.4 },
  NO: { ko: "노르웨이", lat: 60.5, lon: 8.5 }, SE: { ko: "스웨덴", lat: 60.1, lon: 18.6 }, FI: { ko: "핀란드", lat: 61.9, lon: 25.7 },
  PL: { ko: "폴란드", lat: 51.9, lon: 19.1 }, GR: { ko: "그리스", lat: 39.1, lon: 21.8 }, CH: { ko: "스위스", lat: 46.8, lon: 8.2 },
  RU: { ko: "러시아", lat: 61.5, lon: 105.3 }, UA: { ko: "우크라이나", lat: 48.4, lon: 31.2 },
  US: { ko: "미국", lat: 37.1, lon: -95.7 }, CA: { ko: "캐나다", lat: 56.1, lon: -106.3 }, MX: { ko: "멕시코", lat: 23.6, lon: -102.6 },
  BR: { ko: "브라질", lat: -14.2, lon: -51.9 }, AR: { ko: "아르헨티나", lat: -38.4, lon: -63.6 }, CL: { ko: "칠레", lat: -35.7, lon: -71.5 },
  PE: { ko: "페루", lat: -9.2, lon: -75.0 }, CO: { ko: "콜롬비아", lat: 4.6, lon: -74.3 }, EC: { ko: "에콰도르", lat: -1.8, lon: -78.2 },
  AU: { ko: "오스트레일리아", lat: -25.3, lon: 133.8 }, NZ: { ko: "뉴질랜드", lat: -40.9, lon: 174.9 },
};
export const countryName = (code) => COUNTRIES[code]?.ko || code;
