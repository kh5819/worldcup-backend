// 증강 체스 AI 계산 전용 스레드 (서버 본 스레드가 멈추지 않게)
import { parentPort } from "worker_threads";
import { ChessGame } from "./chess-game.js";
import { bestMove, bestAction, pickAug } from "./chess-ai.js";

parentPort.on("message", (job) => {
  try {
    if (job.kind === "pick") return parentPort.postMessage({ id: job.id, ok: true, pick: pickAug(job.offer) });
    const G = new ChessGame({ mode: job.mode });
    Object.assign(G, { S: job.S, P: job.P, armed: job.armed, extra: job.extra, forbid: job.forbid, hist: job.recs.map((rec, i) => ({ rec, before: { pk: job.pks ? job.pks[i] : job.pickIdx } })), pickIdx: job.pickIdx ?? 0, phase: "play", _legal: null });
    const c = G.S.turn;
    const bm = bestMove(G, c, job.level);
    const ba = job.mode === "augment" ? bestAction(G, c, job.level, bm ? bm.v : -99999) : null;
    parentPort.postMessage({ id: job.id, ok: true, move: ba ? null : bm ? { from: bm.m.from, to: bm.m.to, promo: bm.m.promo || null } : null, action: ba ? { id: ba.id, pl: ba.pl } : null });
  } catch (e) { parentPort.postMessage({ id: job.id, ok: false, error: String(e && e.stack || e) }); }
});
