// =========================
// 상식 진단소 문제은행 저장소 (서버 전용)
// 코드 문제은행(know-bank.js) 위에 DB(know_questions, 관리자 등록·수정분)를 덮어써서 출제 목록을 만듦
// 출제 목록 = 검수 상태 checked/approved + 자동 검사 오류 0인 문항만 (검수 대기·보류·비활성은 안 나감)
// 문항 사용 통계는 메모리에 모았다가 1분마다 know_qstats_add 로 한 번에 더함 (DB 부하 최소화)
// =========================
import * as C from "./know-core.js";
import { BANK } from "./know-bank.js";
import { validateItem, LIVE_STATUS } from "./know-validate.js";

export const STORE = { all: new Map(), pool: [], invalid: [], dbIds: new Set(), loadedAt: 0, ver: 0 };
for (const q of BANK) STORE.all.set(q.id, q);

export function rebuild() {
  const pool = [], invalid = [];
  for (const q of STORE.all.values()) {
    if (!LIVE_STATUS.has(q.status)) continue;
    const v = validateItem(q);
    if (v.errors.length) { invalid.push({ id: q.id, errors: v.errors }); continue; }
    pool.push(q);
  }
  STORE.pool = pool; STORE.invalid = invalid; STORE.ver++;
  return STORE;
}
rebuild();
export const bankVersion = () => `${C.CORE_VERSION}.${STORE.pool.length}`;

// DB 행 → 문항 (data 에 문항 전체, 상태·버전은 칸 값이 우선)
export function rowToItem(row) { return { ...row.data, id: row.id, status: row.review_status, ver: row.content_ver, sub: row.subcategory ?? row.data?.sub ?? null }; }
export async function loadDb(sb) {
  if (!sb) return { ok: false };
  try {
    const { data, error } = await sb.from("know_questions").select("id, data, subcategory, review_status, content_ver, updated_at").limit(5000);
    if (error) { console.warn("[know] 문제은행 DB 읽기 실패:", error.message); return { ok: false }; }
    STORE.dbIds = new Set();
    for (const row of data || []) { STORE.all.set(row.id, rowToItem(row)); STORE.dbIds.add(row.id); }
    rebuild(); STORE.loadedAt = Date.now();
    return { ok: true, n: data?.length || 0 };
  } catch (e) { console.warn("[know] 문제은행 DB", e?.message); return { ok: false }; }
}

// ---------- 사용 통계 ----------
const BUF = new Map();
export function countUse(res) {
  const s = BUF.get(res.id) || { id: res.id, used: 0, correct: 0, part: 0, timeouts: 0, ms: 0 };
  s.used++; if (res.part >= 1) s.correct++; s.part += res.part; if (res.timeout) s.timeouts++; s.ms += Math.round(res.ms || 0);
  BUF.set(res.id, s);
}
export async function flushStats(sb) {
  if (!sb || !BUF.size) return 0;
  const rows = [...BUF.values()].map((s) => ({ ...s, part: Math.round(s.part * 100) / 100 })); BUF.clear();
  try { const { error } = await sb.rpc("know_qstats_add", { rows }); if (error) { console.warn("[know] 통계 저장 실패", error.message); for (const r of rows) BUF.set(r.id, r); return 0; } } catch { for (const r of rows) BUF.set(r.id, r); return 0; }
  return rows.length;
}
export const _statBuf = BUF;
