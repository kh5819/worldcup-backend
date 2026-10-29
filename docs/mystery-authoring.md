# 플듀 미스터리 — 새 사건(에피소드) 만드는 법

엔진·솔로·멀티·화면 코드는 **사건 내용을 모른다.** 새 사건은 데이터 파일 하나(+필요하면 그림 파일 하나)만 추가하면 된다.

## 1. 파일 구성

| 무엇 | 위치 | 비고 |
|---|---|---|
| 사건 데이터 (정답 포함, 서버 전용) | `worldcup-backend/src/mystery-epNN.js` | `export const EPNN = { ... }` |
| 사건 등록 | `worldcup-backend/src/mystery-cases.js` | `CASES` 에 한 줄 추가, `UPCOMING` 에서 삭제 |
| 진실·타임라인 메모 (서버 전용) | `worldcup-backend/docs/mystery-epNN-scenario.md` | 프론트 폴더에 두지 말 것 |
| 장면 그림 (선택) | `홈페이지 제작/js/mystery/art-epNN.js` | `presentation.artModule: "art-epNN.js"` |
| 자동 플레이 테스트 | `worldcup-backend/scripts/test-mystery-epNN.mjs` | `test-mystery.mjs` 의 `play()` 를 본떠서 |

정답·범인·좌표 같은 건 **절대 프론트 폴더에 두지 않는다.** 화면에는 서버가 진행도만큼 계산한 것만 보낸다.

## 2. 사건 데이터 뼈대

```js
export const EP02 = {
  id: "ep02", title: "사라진 열차의 승객", subtitle: "EPISODE 02",
  startScene: "platform", introDialogue: "intro",
  characters: { narrator: {...}, detective: {...}, conductor: { name, role, color } , ... },
  evidence:   { E01: { name, desc, icon, key: true }, ... },        // key = 핵심 증거
  scenes:     { platform: { name, art: "platform", bgm, hotspots: [...] }, ... },
  dialogues:  { intro: { lines: [...] , variants: [{ when, not, lines, set, give }] } },
  puzzles:    { P01: { type, title, difficulty, requires, data, solution, hints:[3개], onSolve:{ give, set, lines } } },
  interrogations: { ... }, hypotheses: [...], relations: [...], deductions: [...], autoFlags: [...],
  final: { questions, solution, trueRule, endings: { true, normal, bad } },
  presentation: { ... },   // 3번 참고
  titles: [...],
};
```

- **대사 한 줄** = `[인물id, 표정, "문장"]`. `**강조**` 를 쓰면 금색으로 보인다. 인물id 는 `characters` 에 있어야 한다.
- **조사 지점** `x, y, w, h` 는 장면 크기 대비 0~1 비율.
- `action.type`: `talk`(대화) · `puzzle` · `interrogate` · `move`(장소 이동) · `final`.
- `requires` = 모두 켜져야 보임, `hideIf` = 하나라도 켜지면 숨김.

### 플래그 규칙
| 플래그 | 언제 켜지나 |
|---|---|
| `got_E05` | 증거 E05 를 얻으면 자동 |
| `seen_<인물>` | 그 인물의 대사가 처음 나오면 자동 (수첩 등장인물·용의자에 씀) |
| `d1`, `p09` 등 | 데이터의 `set: [...]` 로 직접 켠다 (관례: 추리 D1 → `d1`, 퍼즐 P09 → `p09`) |
| 심문 `done` | 심문을 끝내는 반박에 성공하면 |
| `autoFlags` | `when` 이 모두 모이면 자동 + 알림 대사 |

진행 조건용 플래그(`talked_mayor` 같은)는 `set` 으로 따로 켠다. `seen_*` 은 수첩 표시용이라 진행 조건으로 쓰지 않는다.

### 퍼즐 종류 (엔진이 판정)
circuit · slide · jigsaw · cipher · gears · order · number · grid · contradiction · clock · mirror · melody · rings · maze · lock · path,
특수: weigh(천칭, 두 번 재야 지목 가능) · hidden(숨은 물건, 좌표는 서버만) · 심문으로 푸는 퍼즐(`viaInterrogation`).
협동용 나눠 보기: `split: "cipher" | "clues" | "map"` — 멀티에서 사람마다 다른 조각을 본다.
`hidden: true` = 숨겨진 퍼즐(칭호), `optional: true` = 선택 조사.

## 3. presentation (화면 연출·수첩)

```js
presentation: {
  episode: "EP.02", label: "EPISODE 02", playtime: "약 60~80분",
  summary: "사건 개요 한 단락",
  tips: ["로딩 화면 팁", ...],
  prologue: [ { kind, ms, cap, sfx, ... } ],          // kind: rain-town · clock(sec, stop, mono) · object(object, lightning) · black · titlecard
  cinematics: { P05: { k, t, s, style, shake, push, sound } },   // 퍼즐을 풀면 서버가 이벤트로 보냄
  finalCine: { k, t, s, style, push, sound, ms }, finalScene: "final",
  relationLayout: { 인물id: [x, y] },                 // 640x420 안에서 관계도 위치
  artFlags: ["lucien_fled"],                          // 그림이 알아야 하는 플래그만
  notes: { 인물id: "등장인물 메모" },
  timeline: [ { ev: "E09", tm: "10/20", t: "문장", kind: "fact|claim|doubt", falseWhen: "p09" } ],
  openQuestions: [ { text: "풀리지 않은 의문", until: "d1" } ],
  suspects: [ { id, motive: [[조건, 문구]...], alibi, note, verdict: [[조건, "open|doubt|clear", "라벨"]...] } ],
  artModule: "art-ep02.js",                           // 새 그림 파일이 있을 때만
},
```
- 조건은 플래그 목록. 용의자 칸마다 **조건이 맞는 마지막 줄**이 보인다.
- 타임라인 줄은 그 증거를 가진 사람에게만 보인다.
- 범인 공개 문구는 `final.endings.true.reveal` / `normal.reveal` 에 둔다 (엔딩 때만 보냄, 미리 볼 수 없음).
- 프롤로그 `object` 컷의 그림이 새로 필요하면 `main.js` 의 `OBJECTS` 에 추가, 소리는 `PRO_SFX`.

## 4. 그림 (art-epNN.js)

```js
// art.js 를 직접 import 하지 않는다 — 화면 코드가 등록 함수를 넘겨준다
export default function ({ registerScenes, artKit }) {
  const { W, H, defs, grain, glow, fog, dust, stars, gear, lamp, figure } = artKit;
  registerScenes({
    ep02_platform: (ctx) => `${defs()}<rect width="${W}" height="${H}" fill="url(#gNight)"/> ... ${fog()}${grain()}`,
  });
}
```
- `ctx.solved` (푼 퍼즐), `ctx.flags` (추리 d1… + artFlags), `ctx.npcs` 로 진행에 따라 그림을 바꾼다.
- 이미 있는 장면 이름은 덮어쓰지 않는다 → 이름 앞에 사건 접두어 권장(`ep02_platform`).
- 인물 초상은 `art.js` 의 `portraitSVG` 에 인물 id 를 추가해야 한다 (EP.01 인물은 재사용 가능).
- 외부 에셋을 쓰면 `홈페이지 제작/assets/mystery/LICENSE.md` 에 출처·라이선스를 적는다. 출처가 불분명한 건 쓰지 않는다.

## 5. 확인 순서 (배포 전 필수)

1. `node scripts/validate-cases.mjs` — 오류 0 (없는 증거·장소·인물·켜지지 않는 플래그 검사)
2. `node scripts/test-mystery-epNN.mjs` — 진/보통/배드 엔딩 자동 플레이, 퍼즐 정답 유일성
3. `MYS_VOTE_MS=800 node scripts/test-mystery-multi.mjs` — 멀티 공통 동작
4. 브라우저로 처음부터 끝까지 한 번 (PC + 모바일 폭)
5. 플레이 시간: 결과의 소요 시간 기록으로 확인 (추정치로 "60분" 이라고 적지 않는다)

## 6. 저장 데이터
- 진행: `mystery_progress (user_key, case_id)` — 사건마다 따로 저장되므로 테이블 변경 필요 없음.
- 결과: `mystery_results.case_id` 로 사건별 기록.
- 이미 공개된 사건의 퍼즐·증거 id 를 바꾸면 기존 저장이 어긋난다. 공개 후에는 **추가만** 하고 지우거나 이름을 바꾸지 않는다.
