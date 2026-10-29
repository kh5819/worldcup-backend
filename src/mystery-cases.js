// =========================
// 플듀 미스터리 — 사건 등록부 (솔로·멀티 공용)
// 새 사건 추가: src/mystery-epNN.js 를 만들고 아래 CASES 에 한 줄, UPCOMING 에서 지운다.
// 데이터 형식과 순서는 docs/mystery-authoring.md, 검사는 node scripts/validate-cases.mjs
// =========================

import { EP01 } from "./mystery-ep01.js";

export const CASES = { ep01: EP01 };

// 사건 선택 화면에 "준비 중"으로 보여 줄 예정작 (데이터 없음)
const UPCOMING = [
  { id: "ep02", episode: "EP.02", title: "사라진 열차의 승객" },
  { id: "ep03", episode: "EP.03", title: "거울 속의 초대장" },
  { id: "ep04", episode: "EP.04", title: "아무도 없는 호텔" },
  { id: "ep05", episode: "EP.05", title: "마지막 편지의 비밀" },
  { id: "ep06", episode: "EP.06", title: "8번째 탐정" },
];

export function getCase(id) { return CASES[id] || null; }
export function defaultCaseId() { return Object.keys(CASES)[0]; }
export function listCases() {
  const ready = Object.values(CASES).map((c) => ({
    id: c.id, episode: c.presentation?.episode || c.id.toUpperCase(), title: c.title,
    playtime: c.presentation?.playtime || "", available: true,
  }));
  return [...ready, ...UPCOMING.filter((u) => !CASES[u.id]).map((u) => ({ ...u, available: false }))];
}
