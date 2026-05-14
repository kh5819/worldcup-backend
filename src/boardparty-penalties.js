// =========================
// DUO GAME ZONE — 보드파티 꼴지 벌칙 풀 v20260515_1 Phase 5
// 카테고리:
//   drink   — 술 한잔류
//   aegyo   — 애교/귀여움
//   sing    — 노래
//   dance   — 춤
//   polite  — 존댓말/말투
//   horror  — 공포게임
//   face    — 표정/짤
//   random  — 기타 랜덤
// =========================

export const PENALTIES = [
  { id: "p_drink",     category: "drink",  emoji: "🍺", title: "술 한잔",         desc: "원샷!" },
  { id: "p_drink_two", category: "drink",  emoji: "🥂", title: "원샷 ×2",         desc: "더블 원샷!" },
  { id: "p_aegyo5",    category: "aegyo",  emoji: "😊", title: "애교 5초",        desc: "최선을 다해 5초" },
  { id: "p_aegyo_song",category: "aegyo",  emoji: "💝", title: "애교송",          desc: "사랑해요 노래 한 소절 + 애교" },
  { id: "p_sing",      category: "sing",   emoji: "🎤", title: "노래 한소절",     desc: "랜덤 노래 후렴구" },
  { id: "p_sing_solo", category: "sing",   emoji: "🎙️", title: "독창 30초",       desc: "한 곡 30초 풀로" },
  { id: "p_dance",     category: "dance",  emoji: "💃", title: "춤 5초",          desc: "현장 즉석 5초" },
  { id: "p_chicken",   category: "dance",  emoji: "🐔", title: "닭다리 춤",       desc: "닭다리 흔들기 5초" },
  { id: "p_polite",    category: "polite", emoji: "🫡", title: "존댓말 3분",      desc: "이 시간부터 3분간 친구에게 존댓말" },
  { id: "p_nyan",      category: "polite", emoji: "😼", title: "냥체 3분",        desc: "모든 말끝에 '냥'" },
  { id: "p_horror",    category: "horror", emoji: "👻", title: "공포게임 5분",    desc: "다음 게임은 공포게임" },
  { id: "p_face",      category: "face",   emoji: "📸", title: "이상한 표정",     desc: "단체 스샷 — 가장 못생긴 표정" },
  { id: "p_laugh_no",  category: "random", emoji: "🤣", title: "웃음 참기 30초",  desc: "친구들이 웃기는데 30초 참기" },
  { id: "p_again",     category: "random", emoji: "🎲", title: "한 번 더!",       desc: "룰렛 즉시 한 번 더 회전" },
];

export const PENALTY_CATEGORIES = [
  { key: "drink",  emoji: "🍺", label: "술" },
  { key: "aegyo",  emoji: "😊", label: "애교" },
  { key: "sing",   emoji: "🎤", label: "노래" },
  { key: "dance",  emoji: "💃", label: "춤" },
  { key: "polite", emoji: "🫡", label: "말투" },
  { key: "horror", emoji: "👻", label: "공포" },
  { key: "face",   emoji: "📸", label: "표정" },
  { key: "random", emoji: "🎲", label: "랜덤" },
];

export const DEFAULT_PENALTY_KINDS = {
  drink: true, aegyo: true, sing: true, dance: true,
  polite: true, horror: false, face: true, random: true,
};

export function pickPenalty(enabledKinds) {
  const pool = PENALTIES.filter(p => enabledKinds?.[p.category]);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function publicPenaltyList() {
  return PENALTIES.map(p => ({ id: p.id, category: p.category, emoji: p.emoji, title: p.title, desc: p.desc }));
}
