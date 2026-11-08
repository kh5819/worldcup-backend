// =========================
// 언어 진단소 문항 검증 (서버 전용) — 자동 검사 도구(scripts/validate-lingo-bank.mjs)·출제 목록이 같이 씀
// 자동 검사는 "형식·정답 유일성"만 확인함. 언어 사실(맞춤법 규정 등)은 근거 자료 대조 기록(checked/by)으로만 확인
// 상식 진단소(know-validate.js)와 다른 점: 띄어쓰기·철자 문제는 보기끼리 공백 하나만 달라도 서로 다른 보기 → 공백을 지우지 않고 비교
// =========================
import * as C from "./lingo-core.js";

export const STATUSES = ["draft", "checked", "approved", "hold", "disabled"];
export const LIVE_STATUS = new Set(["checked", "approved"]);
// 유사도 비교용 (공백·문장부호 무시)
export const norm = (s) => String(s ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, "").replace(/[?!.,'"「」『』()·~\-:;。、！？]/g, "");
// 정답 유일성 비교용 (공백 하나도 다르면 다른 보기)
const exact = (s) => String(s ?? "").normalize("NFC").trim().replace(/\s+/g, " ");

export function answerText(q) {
  switch (q.kind) {
    case "mcq": case "reveal": return q.opts?.[0] ?? "";
    case "sort": return (q.items || []).map((x) => `${x[0]}>${q.bins?.[x[1]]}`).join("|");
    case "catch": return (q.items || []).filter((x) => x[1]).map((x) => x[0]).join("|");
    case "ox": return String(q.ans);
    case "order": return (q.parts || []).join("|");
    case "link": return (q.pairs || []).map((p) => p.join("=")).join("|");
    case "spot": return `${q.tokens?.[q.wrong] ?? ""}→${q.fix ?? ""}`;
    case "type": return q.text || "";
  }
  return "";
}
export function contentText(q) {
  const body = q.kind === "reveal" ? (q.clues || []).join(" ") : q.kind === "sort" ? `${(q.bins || []).join(" ")} ${(q.items || []).map((x) => x[0]).join(" ")}` : q.kind === "spot" ? (q.tokens || []).join(" ") : q.kind === "order" ? (q.parts || []).join(" ") : q.kind === "type" ? "" : String(q.q || "");
  return `${body} ${answerText(q)}`;
}

export function validateItem(q) {
  const errors = [], warns = [];
  const E = (m) => errors.push(m), W = (m) => warns.push(m);
  if (!q || typeof q !== "object") return { errors: ["문항 아님"], warns };
  if (!/^[A-Z]{2}\d{4}$/.test(q.id || "")) E("id 형식 (영문 대문자 2 + 숫자 4, 예: KS0001)");
  if (!C.LANGS.includes(q.lang)) E(`검사 언어 ${q.lang}`);
  if (!C.AREAS.includes(q.area)) E(`검사 종류 ${q.area}`);
  if (q.game !== q.area) E("game과 area는 같아야 함 (검사 = 분야)");
  if (!C.GAMES[q.area]) E(`검사 ${q.area}`);
  else if (!C.GAMES[q.area].kinds.includes(q.kind)) E(`${q.area}에 맞지 않는 방식 ${q.kind}`);
  if (![1, 2, 3, 4].includes(q.d)) E("난이도 1~4");
  if (!q.q || String(q.q).length < 4) E("질문 없음");
  if (String(q.q || "").length > 200) W("질문이 김 (200자)");
  if (!q.exp || String(q.exp).length < 10) E("해설 부족");
  if (String(q.exp || "").length > 400) W("해설이 김 (400자)");
  if (!Array.isArray(q.src) || !q.src.length || q.src.some((s) => !s?.t || !/^https:\/\//.test(s?.u || ""))) E("근거 출처(https) 없음");
  if (!/^\d{4}-\d\d-\d\d$/.test(q.checked || "")) E("검증 날짜");
  if (!STATUSES.includes(q.status)) E("검수 상태");
  if (!["ai-ref", "auto", "op", "native"].includes(q.by)) E("검수자 표시");
  if (q.expert && q.status === "approved") W("전문가 검수 필요 표시가 있는데 승인됨");
  if (!Number.isInteger(q.ver) || q.ver < 1) E("콘텐츠 버전");
  if (!Array.isArray(q.tags)) E("태그 배열");
  if (q.volatile && !/^\d{4}-\d\d(-\d\d)?$/.test(q.asOf || "")) E("바뀔 수 있는 표현(신조어 등)은 기준일(asOf) 필수");
  const uniq = (a) => new Set(a.map(exact)).size === a.length;
  switch (q.kind) {
    case "mcq": case "reveal":
      if (!Array.isArray(q.opts) || q.opts.length !== 4) E("보기 4개 필요");
      else {
        if (!uniq(q.opts)) E("보기 중복");
        if (q.opts.some((o) => !String(o).trim())) E("빈 보기");
        if (/모두|전부|위의 것|all of the above|すべて/i.test(q.opts.join(" "))) E("'모두 정답' 같은 보기 금지 (정답 유일성)");
      }
      if (q.kind === "reveal") {
        if (!Array.isArray(q.clues) || q.clues.length < 3 || q.clues.length > 5) E("단서 3~5개");
        else if (q.opts && q.clues.some((c) => q.opts.some((o) => norm(o).length >= 2 && norm(c).includes(norm(o))))) E("단서에 보기가 그대로 들어 있음 (정답 노출)");
      }
      break;
    case "ox": if (typeof q.ans !== "boolean") E("O/X 정답"); break;
    case "order":   // 문장 배열: parts = 바른 순서의 조각들 (서버가 섞어서 냄)
      if (!Array.isArray(q.parts) || q.parts.length < 3 || q.parts.length > 7) E("조각 3~7개");
      else { if (!uniq(q.parts)) E("같은 조각이 있어 순서가 모호함"); if (q.parts.some((p) => !String(p).trim())) E("빈 조각"); }
      if (q.alt) E("다른 순서도 맞는 문장은 출제 금지 (alt)");
      break;
    case "spot":    // 오류 찾기: tokens(문장 조각) 중 wrong번이 틀림, fix = 바른 표현
      if (!Array.isArray(q.tokens) || q.tokens.length < 3 || q.tokens.length > 12) { E("조각 3~12개"); break; }
      if (!Number.isInteger(q.wrong) || q.wrong < 0 || q.wrong >= q.tokens.length) E("틀린 조각 번호");
      if (!q.fix || exact(q.fix) === exact(q.tokens[q.wrong])) E("고친 표현(fix) 필요");
      if (q.tokens.some((t) => !String(t).trim())) E("빈 조각");
      break;
    case "type":    // 타자: text = 따라 칠 문장
      if (!q.text || [...String(q.text)].length < 8 || [...String(q.text)].length > 80) E("타자 문장 8~80자");
      break;
    case "sort":
      if (!Array.isArray(q.bins) || q.bins.length < 2 || q.bins.length > 4) { E("분류함 2~4개"); break; }
      if (!uniq(q.bins)) E("분류함 이름 중복");
      if (!Array.isArray(q.items) || q.items.length < 5 || q.items.length > 8) { E("물건 5~8개"); break; }
      if (q.items.some((x) => !Array.isArray(x) || !String(x[0] || "").trim() || !Number.isInteger(x[1]) || x[1] < 0 || x[1] >= q.bins.length)) E("형식 [이름, 분류함 번호]");
      if (!uniq(q.items.map((x) => x[0]))) E("물건 이름 중복");
      for (let b = 0; b < q.bins.length; b++) if (!q.items.some((x) => x[1] === b)) E(`분류함 '${q.bins[b]}'에 들어갈 것이 없음`);
      break;
    case "link":
      if (!Array.isArray(q.pairs) || q.pairs.length < 4 || q.pairs.length > 6) E("연결 4~6쌍");
      else if (!uniq(q.pairs.map((p) => p[0])) || !uniq(q.pairs.map((p) => p[1]))) E("짝 중복 (정답 유일성)");
      break;
    case "catch": {
      if (!q.topic || String(q.topic).length < 2) E("주제(topic) 없음");
      if (!Array.isArray(q.items) || q.items.length < 10 || q.items.length > 16) { E("떨어지는 것 10~16개"); break; }
      if (!uniq(q.items.map((x) => x[0]))) E("이름 중복");
      break;
    }
    default: E(`방식 ${q.kind}`);
  }
  return { errors, warns };
}

const grams = (s) => { const t = norm(s), g = new Set(); for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2)); return g; };
export const gramSet = grams;
export function jaccard(A, B) { if (!A.size || !B.size) return 0; if (A.size > B.size) [A, B] = [B, A]; let n = 0; for (const x of A) if (B.has(x)) n++; return n / (A.size + B.size - n); }
export function findDupes(bank, { th = 0.7 } = {}) {
  const out = [], items = bank.map((q) => ({ q, g: grams(contentText(q)), a: norm(answerText(q)) }));
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const x = items[i], y = items[j]; if (x.q.lang !== y.q.lang) continue;
    const s = jaccard(x.g, y.g);
    if (s >= th) out.push({ a: x.q.id, b: y.q.id, sim: Math.round(s * 100) / 100, why: "내용이 비슷" });
    else if (x.a && x.a === y.a && x.q.kind === y.q.kind && x.q.kind !== "ox") out.push({ a: x.q.id, b: y.q.id, sim: Math.round(s * 100) / 100, why: "같은 정답" });
  }
  return out;
}
