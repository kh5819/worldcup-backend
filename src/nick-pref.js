// =========================
// 게임천국 게임 이름 정하기 (2026-11-21 사용자 결정)
// · 로그인한 사람도 "내 이름" 칸에 직접 적었으면 그 이름을 씀 (예전: 무조건 프로필 닉네임 → 적어도 안 바뀌어 버그처럼 보였음)
// · 빈칸·"게스트…"·이메일처럼 보이는 이름(@ 포함)은 무시하고 프로필 닉네임 (이메일 노출 막기)
// · 월드컵·퀴즈 멀티방 입장(room:join)은 이 규칙이 아님 — 그쪽은 계속 프로필 우선
// =========================
export function typedNick(nick) {
  if (typeof nick !== "string") return false;
  const t = nick.replace(/[\u0000-\u001f​-‏‪-‮⁠-⁯﻿<>]/g, "").trim();
  if (!t || t.includes("@") || /^게스트/.test(t) || /^guest/i.test(t)) return false;
  return true;
}
