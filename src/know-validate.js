// =========================
// 상식 진단소 문항 검증 (서버 전용) — 자동 검사 도구 · 관리자 등록/수정 · 보고서가 같이 씀
// 자동 검사는 "형식·일관성"만 확인함. 사실관계는 출처 대조(사람/AI 검수 기록)로만 확인 — 자동 통과 ≠ 사실 검증
// =========================
import * as C from "./know-core.js";
import { COUNTRIES } from "./know-geo.js";

export const STATUSES = ["draft", "checked", "approved", "hold", "disabled"];
export const LIVE_STATUS = new Set(["checked", "approved"]);
export const norm = (s) => String(s ?? "").normalize("NFC").toLowerCase().replace(/\s+/g, "").replace(/[?!.,'"「」『』()·~\-:;]/g, "");

// 문항이 가진 정답 텍스트 (중복·유사도 비교용)
export function answerText(q) {
  switch (q.kind) {
    case "mcq": case "reveal": case "case": return q.opts?.[0] ?? "";
    case "map": return q.codes?.[0] ?? "";
    case "where": return `${q.place || ""}@${q.codes?.[0] ?? ""}`;
    case "sort": return (q.items || []).map((x) => `${x[0]}>${q.bins?.[x[1]]}`).join("|");
    case "catch": return (q.items || []).filter((x) => x[1]).map((x) => x[0]).join("|");
    case "ox": return String(q.ans);
    case "order": return (q.events || []).map((e) => e[0]).join("|");
    case "pair": case "link": return (q.pairs || []).map((p) => p.join("=")).join("|");
    case "num": return String(q.n?.v);
    case "fake": return (q.stmts || []).find((s) => s[1] === false)?.[0] ?? "";
  }
  return "";
}
// 내용 비교용 글: 틀 문장("단서를 보고…", "순서대로 놓으세요")보다 실제 내용(단서·사건·문장·정답)이 중심
export function contentText(q) {
  const body = q.kind === "reveal" || q.kind === "case" || q.kind === "where" ? `${(q.clues || []).join(" ")} ${q.place || ""}` : q.kind === "sort" ? `${(q.bins || []).join(" ")} ${(q.items || []).map((x) => x[0]).join(" ")}` : q.kind === "catch" ? `${q.topic || ""} ${(q.items || []).map((x) => x[0]).join(" ")}` : q.kind === "link" ? (q.pairs || []).flat().join(" ") : q.kind === "reveal" ? (q.clues || []).join(" ") : q.kind === "order" ? (q.events || []).map((e) => e[0]).join(" ") : q.kind === "fake" ? (q.stmts || []).map((x) => x[0]).join(" ") : q.kind === "pair" ? (q.pairs || []).flat().join(" ") : q.q;
  return `${body} ${answerText(q)}`;
}
// 예상 풀이 시간(초): 글자 수·보기 수 기반 추정 (제한시간과 별개, 관리용)
export function estimateTime(q) {
  const len = String(q.q || "").length + (q.opts || q.stmts?.map((s) => s[0]) || q.events?.map((e) => e[0]) || []).join("").length;
  const base = { mcq: 6, map: 8, ox: 4, order: 14, pair: 12, num: 9, reveal: 12, fake: 12, sort: 18, case: 20, link: 16, where: 14, catch: 30 }[q.kind] || 8;
  return Math.round(base + len / 18 + (q.d - 1) * 2);
}
// 요청한 표준 필드 이름으로 내보내기 (관리자·보고서용)
export function toSchema(q, stats = null) {
  const opts = q.kind === "sort" ? q.items.map((x) => x[0]) : q.kind === "catch" ? q.items.map((x) => x[0]) : q.opts || q.codes || q.stmts?.map((s) => s[0]) || q.events?.map((e) => e[0]) || q.pairs?.map((p) => `${p[0]} = ${p[1]}`) || null;
  let correct;
  switch (q.kind) {
    case "mcq": case "reveal": case "map": correct = { index: 0, text: answerText(q) }; break;
    case "ox": correct = { value: q.ans }; break;
    case "order": correct = { order: [...q.events].sort((a, b) => a[1] - b[1]).map((e) => e[0]), years: [...q.events].map((e) => e[1]).sort((a, b) => a - b) }; break;
    case "pair": case "link": correct = { pairs: q.pairs }; break;
    case "case": correct = { index: 0, text: q.opts[0] }; break;
    case "where": correct = { country: q.codes[0], place: q.place }; break;
    case "sort": correct = { bins: q.bins, binOf: q.items.map((x) => q.bins[x[1]]) }; break;
    case "catch": correct = { topic: q.topic, catchThese: q.items.filter((x) => x[1]).map((x) => x[0]) }; break;
    case "num": correct = { value: q.n.v, tolerance: q.n.tol, zeroAt: q.n.far, absolute: !!q.n.abs, unit: q.n.unit }; break;
    case "fake": correct = { falseIndex: q.stmts.findIndex((s) => s[1] === false), truth: q.stmts.map((s) => s[1]) }; break;
  }
  return {
    questionId: q.id, category: q.area, subcategory: q.sub || null, gameType: q.game, kind: q.kind, difficulty: q.d,
    questionText: q.q, answerOptions: opts, correctAnswer: correct, explanation: q.exp, funFact: q.fun || null,
    sourceUrl: (q.src || []).map((s) => s.u), sources: q.src || [], verifiedAt: q.checked, verifiedBy: q.by, contentVersion: q.ver,
    assetId: q.art || q.lab || null, estimatedTime: estimateTime(q), reviewStatus: q.status, asOf: q.asOf || null, tags: q.tags || [],
    usageCount: stats?.used ?? 0, correctRate: stats?.used ? Math.round((100 * stats.correct) / stats.used) : null, errorReportCount: stats?.reports ?? 0,
  };
}

// 한 문항 검사 → { errors: [], warns: [] }
export function validateItem(q, { worldCodes = null } = {}) {
  const errors = [], warns = [];
  const E = (m) => errors.push(m), W = (m) => warns.push(m);
  if (!q || typeof q !== "object") return { errors: ["문항 아님"], warns };
  if (!/^[A-Z]\d{4}$/.test(q.id || "")) E("id 형식 (영문 대문자 1 + 숫자 4)");
  if (!C.BANK_AREAS.includes(q.area)) E(`분야 ${q.area}`);
  if (!C.GAMES[q.game]) E(`미니게임 ${q.game}`);
  else if (!C.GAMES[q.game].kinds.includes(q.kind)) E(`${q.game}에 맞지 않는 방식 ${q.kind}`);
  if (![1, 2, 3, 4].includes(q.d)) E("난이도 1~4");
  if (!q.q || String(q.q).length < 6) E("질문 없음");
  if (String(q.q || "").length > 160) W("질문이 너무 김 (160자)");
  if (!q.exp || String(q.exp).length < 15) E("해설 부족");
  if (String(q.exp || "").length > 400) W("해설이 김 (400자) — 짧게 다듬기");
  if (!Array.isArray(q.src) || !q.src.length || q.src.some((s) => !s?.t || !/^https:\/\//.test(s?.u || ""))) E("근거 출처(https) 없음");
  if (!/^\d{4}-\d\d-\d\d$/.test(q.checked || "")) E("검증 날짜");
  if (!STATUSES.includes(q.status)) E("검수 상태");
  if (!["ai-ref", "auto", "op"].includes(q.by)) E("검수자 표시");
  if (!Number.isInteger(q.ver) || q.ver < 1) E("콘텐츠 버전");
  if (!Array.isArray(q.tags)) E("태그 배열");
  if (q.volatile && !/^\d{4}-\d\d(-\d\d)?$/.test(q.asOf || "")) E("바뀔 수 있는 사실은 기준일(asOf) 필수");
  const uniq = (a) => new Set(a.map(norm)).size === a.length;
  switch (q.kind) {
    case "mcq": case "reveal":
      if (!Array.isArray(q.opts) || q.opts.length !== 4) E("보기 4개 필요");
      else {
        if (!uniq(q.opts)) E("보기 중복");
        if (q.opts.some((o) => !String(o).trim())) E("빈 보기");
        // 정답 유일성: 정답 보기가 다른 보기를 그대로 포함하거나 반대면 모호
        const a = norm(q.opts[0]); if (q.opts.slice(1).some((o) => { const b = norm(o); return b && (a.includes(b) || b.includes(a)); })) W("보기끼리 글자가 겹쳐 헷갈릴 수 있음");
        if (/모두|전부|위의 것/.test(q.opts.join(" "))) E("'모두 정답' 같은 보기 금지 (정답 유일성)");
      }
      if (q.kind === "reveal") {
        if (!Array.isArray(q.clues) || q.clues.length < 3 || q.clues.length > 5) E("단서 3~5개");
        else if (q.opts && q.clues.some((c) => q.opts.some((o) => norm(o).length >= 2 && norm(c).includes(norm(o))))) E("단서에 보기 이름이 그대로 들어 있음 (정답 노출)");
      }
      break;
    case "map":
      if (!Array.isArray(q.codes) || q.codes.length < 3 || q.codes.length > 6) E("지도 보기 3~6개");
      else { for (const c of q.codes) { if (!COUNTRIES[c]) E(`나라표에 없는 나라 ${c}`); if (worldCodes && !worldCodes.has(c)) E(`지도에 없는 나라 ${c}`); } if (!uniq(q.codes)) E("지도 보기 중복"); }
      break;
    case "ox": if (typeof q.ans !== "boolean") E("O/X 정답"); break;
    case "order": {
      if (!Array.isArray(q.events) || q.events.length < 3 || q.events.length > 6) { E("사건 3~6개"); break; }
      const ys = q.events.map((e) => e[1]);
      if (ys.some((y) => !Number.isFinite(y))) E("연도 숫자 아님");
      if (new Set(ys).size !== ys.length) E("같은 연도가 있어 순서가 모호함");
      if (!uniq(q.events.map((e) => e[0]))) E("사건 이름 중복");
      break;
    }
    case "pair":
      if (!Array.isArray(q.pairs) || q.pairs.length < 3 || q.pairs.length > 5) E("짝 3~5개");
      else if (!uniq(q.pairs.map((p) => p[0])) || !uniq(q.pairs.map((p) => p[1]))) E("짝 중복 (정답 유일성)");
      break;
    case "num": {
      const n = q.n || {};
      if (!Number.isFinite(n.v) || !Number.isFinite(n.tol) || !Number.isFinite(n.far) || !(n.far > n.tol)) { E("숫자 정답/범위"); break; }
      if (!(n.min <= n.v && n.v <= n.max)) E("정답이 입력 범위 밖");
      if (!n.unit) E("단위 없음");
      const key = { v: n.v, tol: n.tol, far: n.far, abs: !!n.abs };
      if (C.judge("num", null, n.v, key) !== 1) E("정답 입력이 만점이 아님");
      if (C.judge("num", null, n.abs ? n.v + n.far + 1 : n.v * (1 + n.far) * 1.05, key) !== 0) E("멀리 틀려도 점수가 남");
      break;
    }
    case "fake": {
      if (!Array.isArray(q.stmts) || q.stmts.length < 3 || q.stmts.length > 4) { E("문장 3~4개"); break; }
      const f = q.stmts.filter((s) => s[1] === false).length;
      if (f !== 1) E(`거짓 문장이 ${f}개 (정확히 1개여야 정답이 유일)`);
      if (q.stmts.some((s) => typeof s[1] !== "boolean")) E("참/거짓 표시");
      if (!uniq(q.stmts.map((s) => s[0]))) E("문장 중복");
      break;
    }
    // ---- 6차 신규 ----
    case "case": {   // 지식 탐정단: 용의자 6명(0번 정답) + 단서 3~5개
      if (!Array.isArray(q.opts) || q.opts.length !== 6) E("용의자 6명 필요");
      else { if (!uniq(q.opts)) E("용의자 중복"); if (q.opts.some((o) => !String(o).trim())) E("빈 용의자"); }
      if (!Array.isArray(q.clues) || q.clues.length < 3 || q.clues.length > 5) E("단서 3~5개");
      else if (q.opts && q.clues.some((c) => q.opts.some((o) => norm(o).length >= 2 && norm(c).includes(norm(o))))) E("단서에 용의자 이름이 그대로 들어 있음 (정답 노출)");
      break;
    }
    case "where": {  // 여기는 어디?: 엽서 단서 2~4개 + 지도 보기 4~6개(0번 정답 나라) + 장소 이름
      if (!q.place || String(q.place).length < 2) E("장소 이름(place) 없음");
      if (!Array.isArray(q.clues) || q.clues.length < 2 || q.clues.length > 4) E("엽서 단서 2~4개");
      if (!Array.isArray(q.codes) || q.codes.length < 4 || q.codes.length > 6) E("지도 보기 4~6개");
      else {
        for (const c of q.codes) { if (!COUNTRIES[c]) E(`나라표에 없는 나라 ${c}`); if (worldCodes && !worldCodes.has(c)) E(`지도에 없는 나라 ${c}`); }
        if (!uniq(q.codes)) E("지도 보기 중복");
        const names = q.codes.map((c) => COUNTRIES[c]?.ko).filter(Boolean);
        if ((q.clues || []).some((t) => names.some((n) => norm(t).includes(norm(n))) || (q.place && norm(t).includes(norm(q.place))))) E("단서에 나라·장소 이름이 그대로 들어 있음 (정답 노출)");
      }
      if (Array.isArray(q.assets) && q.assets.some((a) => !a?.license || !a?.by || !/^https:\/\//.test(a?.from || ""))) E("사진 자료는 라이선스·작가·출처 필수");
      break;
    }
    case "sort": {   // 분류 공장: 분류함 2~4개 + 물건 5~8개 [이름, 분류함 번호]
      if (!Array.isArray(q.bins) || q.bins.length < 2 || q.bins.length > 4) { E("분류함 2~4개"); break; }
      if (!uniq(q.bins)) E("분류함 이름 중복");
      if (!Array.isArray(q.items) || q.items.length < 5 || q.items.length > 8) { E("물건 5~8개"); break; }
      if (q.items.some((x) => !Array.isArray(x) || !String(x[0] || "").trim() || !Number.isInteger(x[1]) || x[1] < 0 || x[1] >= q.bins.length)) E("물건 형식 [이름, 분류함 번호]");
      if (!uniq(q.items.map((x) => x[0]))) E("물건 이름 중복");
      for (let b = 0; b < q.bins.length; b++) if (!q.items.some((x) => x[1] === b)) E(`분류함 '${q.bins[b]}'에 들어갈 물건이 없음`);
      break;
    }
    case "link":     // 지식 연결왕: 짝 4~6개
      if (!Array.isArray(q.pairs) || q.pairs.length < 4 || q.pairs.length > 6) E("연결 4~6쌍");
      else if (!uniq(q.pairs.map((p) => p[0])) || !uniq(q.pairs.map((p) => p[1]))) E("짝 중복 (정답 유일성)");
      break;
    case "catch": {  // 상식 캐치!: 주제 + 떨어지는 것 10~16개 [이름, 주제에 맞음?]
      if (!q.topic || String(q.topic).length < 2) E("주제(topic) 없음");
      if (!Array.isArray(q.items) || q.items.length < 10 || q.items.length > 16) { E("떨어지는 것 10~16개"); break; }
      if (q.items.some((x) => !Array.isArray(x) || !String(x[0] || "").trim() || typeof x[1] !== "boolean")) E("형식 [이름, 참/거짓]");
      if (!uniq(q.items.map((x) => x[0]))) E("이름 중복");
      const t = q.items.filter((x) => x[1]).length; if (t < 4 || q.items.length - t < 4) E("맞는 것·틀린 것 각각 4개 이상");
      break;
    }
    default: E(`방식 ${q.kind}`);
  }
  return { errors, warns };
}

// 글자 2-gram 유사도 (0~1)
const grams = (s) => { const t = norm(s), g = new Set(); for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2)); return g; };
export const gramSet = grams;
// 미리 만든 2-gram 집합끼리 유사도 (similarity와 같은 값, 출제 계획용 빠른 버전)
export function jaccard(A, B) { if (!A.size || !B.size) return 0; if (A.size > B.size) [A, B] = [B, A]; let n = 0; for (const x of A) if (B.has(x)) n++; return n / (A.size + B.size - n); }
export function similarity(a, b) { return jaccard(grams(a), grams(b)); }
// 문제은행 전체: 중복·유사 문항 쌍 (같은 정답 + 질문 비슷, 또는 질문이 거의 같음)
export function findDupes(bank, { th = 0.62, only = null } = {}) {
  // only: 이 id가 낀 쌍만 (관리자 저장 때 — 전체 쌍 비교를 피함). 2-gram 집합은 문항마다 한 번만 만듦
  const out = [], items = bank.map((q) => { const t = contentText(q); return { q, g: grams(t), a: norm(answerText(q)) }; });
  const qg = new Map(), qGrams = (x) => { let g = qg.get(x); if (!g) { g = grams(x.q.q); qg.set(x, g); } return g; };
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const x = items[i], y = items[j];
    if (only && x.q.id !== only && y.q.id !== only) continue;
    if (x.q.kind === "map" || y.q.kind === "map") { if (x.q.kind === y.q.kind && x.a === y.a) out.push({ a: x.q.id, b: y.q.id, sim: 1, why: "같은 나라 지도 문제" }); continue; }
    const s = jaccard(x.g, y.g);
    if (s >= th) out.push({ a: x.q.id, b: y.q.id, sim: Math.round(s * 100) / 100, why: "질문·정답이 비슷" });
    else if (x.a && x.a === y.a && x.q.kind === y.q.kind && jaccard(qGrams(x), qGrams(y)) >= 0.4) out.push({ a: x.q.id, b: y.q.id, sim: Math.round(s * 100) / 100, why: "같은 정답 + 비슷한 질문" });
  }
  return out;
}
