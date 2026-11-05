// =========================
// 방 만들기 중복 막기 (모든 멀티 게임 공용)
// 같은 사람이 '방 만들기'를 거의 동시에 두 번 보내면(빠른 두 번 클릭 · 끊겼다 다시 보내기)
// 프로필·차단 확인을 기다리는 사이에 둘 다 통과해서 방이 2개 생기던 문제.
// → 진행 중인 요청이 있으면 새로 만들지 않고, 첫 번째 요청의 결과를 같이 돌려준다.
// =========================
const FLIGHT = new Map();
const WAIT_MS = 6000;

export function createFlight(game, userId, cb) {
  if (!userId) return cb;
  const key = `${game}:${userId}`, now = Date.now(), f = FLIGHT.get(key);
  if (f && now - f.at < WAIT_MS) { f.waiters.push(cb); return null; } // 첫 번째 결과를 기다림
  if (f) { clearTimeout(f.t); FLIGHT.delete(key); for (const w of f.waiters) try { w?.({ ok: false, error: "BUSY" }); } catch {} }
  const entry = { at: now, waiters: [], done: false };
  entry.t = setTimeout(() => { if (FLIGHT.get(key) === entry) FLIGHT.delete(key); for (const w of entry.waiters) try { w?.({ ok: false, error: "BUSY" }); } catch {} entry.waiters = []; }, WAIT_MS);
  FLIGHT.set(key, entry);
  return (res) => {
    if (entry.done) return; entry.done = true; clearTimeout(entry.t); if (FLIGHT.get(key) === entry) FLIGHT.delete(key);
    try { cb?.(res); } catch {}
    for (const w of entry.waiters) try { w?.(res); } catch {}
    entry.waiters = [];
  };
}
export const _flightTest = { FLIGHT };
