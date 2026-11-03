# 상식 진단소 문제은행 검증 보고서

생성: 2026-11-03 13:31 · 스키마 v1 · 채점 v1

## 요약
- 등록 686문항 · 출제 중(checked+approved) 686문항 · 운영자 승인(approved) 0문항 · 목표 630문항
- 검수 방식: AI 근거 자료 대조 686
- **주의:** "AI 근거 자료 대조"는 사람이 검수한 것이 아니에요. 운영자 승인 전까지는 사실관계 최종 확인으로 보지 않아요.
- 자동 검사 오류 0건 · 주의 1건 · 무작위 찍기 평균 부분점수 0.254 (채점에서 찍기 보정 적용)

## 분야별 (출제 중 / 목표)
- 역사·사회: 120 / 90
- 과학·자연: 131 / 90
- 지리·세계: 157 / 90
- 문화·예술: 87 / 90
- 생활상식: 62 / 90
- 경제·기술: 73 / 90
- 종합·기타: 56 / 90
- (한국사 표시: 75 / 45)

## 난이도별
- 쉬움: 208 (30% · 목표 30%)
- 보통: 337 (49% · 목표 45%)
- 어려움: 116 (17% · 목표 20%)
- 전문가: 25 (4% · 목표 5%)

## 미니게임/조작 방식별
- catch/catch: 50
- culture/mcq: 33
- detective/case: 50
- fake/fake: 50
- final/mcq: 28
- final/num: 3
- final/order: 4
- life/mcq: 50
- life/ox: 2
- linker/link: 50
- number/num: 31
- ox/ox: 55
- reveal/reveal: 50
- science/mcq: 30
- sortfac/sort: 50
- timeline/mcq: 31
- timeline/order: 19
- where/where: 50
- world/map: 21
- world/mcq: 25
- world/pair: 4

## 출제 시뮬레이션
- 빠른 상식 검사(15문항): 200세트 출제 성공. 분야 % {"culture":14,"geo":18,"life":12,"history":15,"science":18,"econ":13,"mix":10} · 난이도 % {"1":33,"2":49,"3":13,"4":5}
- 정밀 상식 검사(40문항): 200세트 출제 성공. 분야 % {"science":19,"history":16,"mix":12,"life":8,"culture":16,"geo":18,"econ":11} · 난이도 % {"1":30,"2":45,"3":20,"4":5}
- 오늘의 상식 챌린지(10문항): 200세트 출제 성공. 분야 % {"geo":15,"science":19,"history":16,"culture":16,"econ":12,"mix":14,"life":9} · 난이도 % {"1":30,"2":40,"3":20,"4":10}
- 분야별 역사·사회: 출제 가능
- 분야별 과학·자연: 출제 가능
- 분야별 지리·세계: 출제 가능
- 분야별 문화·예술: 출제 가능
- 분야별 생활상식: 출제 가능
- 분야별 경제·기술: 출제 가능

## 번역 (日本語 · English)
- 번역 대상 578문항 (한국사·한국 전용 108문항 제외) · 번역 완료 ja 578 · en 578
- ja: 출제 578문항 (역사·사회 46 · 과학·자연 131 · 지리·세계 153 · 문화·예술 75 · 생활상식 49 · 경제·기술 71 · 종합·기타 53)
- en: 출제 578문항 (역사·사회 46 · 과학·자연 131 · 지리·세계 153 · 문화·예술 75 · 생활상식 49 · 경제·기술 71 · 종합·기타 53)

## 자동 검사 항목
스키마 · 정답 존재 · 보기 중복 · 정답 유일성('모두 정답' 금지, 거짓 문장 정확히 1개, 같은 연도 금지, 짝 중복 금지) · 문항 중복·유사도(내용 2-gram) · 해설 · 출처(https) · 검증일 · 검수 상태 · 난이도 1~4 · 게임 유형-조작 방식 적합성 · 지도 나라 존재 · 숫자 정답=만점/먼 답=0점 · 단서에 정답 이름 노출 금지 · 화면 정보에 정답 재료 없음 · 실제 출제(서버 serve)에서 정답 입력=만점

## 오류
- 없음

## 주의 (사람 확인 권장)
- ⚠ R0002 ↔ D0008: 질문·정답이 비슷 (0.65)

## 문항 표준 필드 예시
```json
{
 "questionId": "W0001",
 "category": "geo",
 "subcategory": null,
 "gameType": "world",
 "kind": "mcq",
 "difficulty": 1,
 "questionText": "프랑스의 수도는 어디일까요?",
 "answerOptions": [
  "파리",
  "리옹",
  "마르세유",
  "니스"
 ],
 "correctAnswer": {
  "index": 0,
  "text": "파리"
 },
 "explanation": "프랑스의 수도는 파리예요. 리옹·마르세유는 프랑스의 큰 도시지만 수도가 아니에요.",
 "funFact": null,
 "sourceUrl": [
  "https://www.britannica.com/place/Paris"
 ],
 "sources": [
  {
   "t": "Britannica — Paris",
   "u": "https://www.britannica.com/place/Paris"
  }
 ],
 "verifiedAt": "2026-11-03",
 "verifiedBy": "ai-ref",
 "contentVersion": 1,
 "assetId": null,
 "estimatedTime": 7,
 "reviewStatus": "checked",
 "asOf": null,
 "tags": [],
 "usageCount": 0,
 "correctRate": null,
 "errorReportCount": 0
}
```