// =========================
// 상식 문제은행 번역 (日本語 · English) — 서버 전용 (정답 해설 포함, 화면에 올리지 말 것)
// - 한국어 원문(know-bank.js)과 배열 순서가 같아야 함 → 정답 위치·채점은 원문 그대로
//   opts·clues·stmts(문장만)·events(사건 이름만)·pairs([왼쪽, 오른쪽])·yl(연도 표시 이름)·unit(숫자 단위)
// - 번역이 없는 문항은 일본어·영어 검사에 나오지 않음
// - LOCAL: 한국에서만 의미 있는 문항(맞춤법·한국 제도·한국 지리·한국 전통문화 등) → 번역하지 않음
//   한국사(tags "한국사")도 일본어·영어에서는 나오지 않음 (사용자 요청 2026-11-03)
// - 검사: scripts/validate-know-bank.mjs (배열 길이·한글 남음·빠진 칸)
// =========================
export const LOCAL = new Set([
  // 생활: 한국 신고 번호·주민번호·맞춤법·기상특보·소비기한 표시·우편번호·주민등록증·평
  "L0001", "L0002", "L0102", "L0010", "L0011", "L0012", "L0103", "L0016", "L0017", "L0020", "L0024", "L0203", "L0302",
  // 지리: 남한의 섬·산·강·넓이
  "W0017", "W0018", "W0019", "W0401",
  // 문화: 한국 전통 예술·문학
  "C0019", "C0020", "C0021", "C0022", "C0027", "C0028", "C0029", "C0101", "C0104", "C0301", "C0302",
  // 경제: 한국은행·원화 지폐
  "E0001", "E0002",
  // 종합: 대한민국 상징 · 한국 금속활자 포함 순서 문제
  "M0002", "M0102", "X0101",
]);
const J = (ja, en) => ({ ja, en });
export const I18N = {};
// 번역 묶음은 아래 파일들에서 합침
import P1 from "./know-i18n-1.js";
import P2 from "./know-i18n-2.js";
import P3 from "./know-i18n-3.js";
import P4 from "./know-i18n-4.js";
import P5 from "./know-i18n-5.js";
import { TR6 } from "./know-bank-6.js";
import { TR7 } from "./know-bank-7.js";
import { TR8 } from "./know-bank-8.js";
import { TR9 } from "./know-bank-9.js";
import { TR10 } from "./know-bank-10.js";
import { TR11 } from "./know-bank-11.js";
for (const P of [P1, P2, P3, P4, P5, TR6, TR7, TR8, TR9, TR10, TR11]) for (const [id, v] of Object.entries(P)) I18N[id] = v;
export { J };
