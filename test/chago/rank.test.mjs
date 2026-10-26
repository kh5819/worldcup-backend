// 랭킹·시즌·부정행위 의심 판정 테스트
import test from "node:test";
import assert from "node:assert/strict";
import { RATING, seasonId, seasonRange, expectedScore, assessSuspicion, rankedEligible, computeRatingChanges, sortBoard } from "../../src/chago-rank.js";

const H = (uid, team, extra = {}) => ({ eid: team * 10 + uid.length, team, uid, isGuest: false, bot: false, ...extra });
const mk = (players, over = {}) => ({ mode: "ranked", reason: "time", winner: 0, players, ...over });

test("시즌: 한국 시간 기준 한 달 단위, 경계가 정확하다", () => {
  assert.equal(seasonId(Date.UTC(2026, 9, 26, 3)), "2026-10");
  assert.equal(seasonId(Date.UTC(2026, 9, 31, 14, 59)), "2026-10");          // 한국 10/31 23:59
  assert.equal(seasonId(Date.UTC(2026, 9, 31, 15, 0)), "2026-11");           // 한국 11/1 00:00
  assert.equal(seasonId(Date.UTC(2026, 11, 31, 15, 0)), "2027-01");          // 해가 바뀜
  const [a, b] = seasonRange("2026-11");
  assert.equal(seasonId(a), "2026-11"); assert.equal(seasonId(a - 1), "2026-10"); assert.equal(seasonId(b), "2026-12");
});

test("기대 승률: 같은 레이팅이면 50%, 400 차이면 약 91%", () => {
  assert.equal(expectedScore(1000, 1000), 0.5);
  assert.ok(Math.abs(expectedScore(1400, 1000) - 0.909) < 0.01);
});

test("랭킹 자격: 경쟁전 + 양 팀에 로그인한 사람이 있어야 한다(봇·게스트만 상대면 불가)", () => {
  const two = mk([H("a", 0), H("bb", 1)]);
  assert.equal(rankedEligible(two), true);
  assert.equal(rankedEligible({ ...two, mode: "friendly" }), false, "친선은 레이팅 없음");
  assert.equal(rankedEligible(mk([H("a", 0), { eid: 5, team: 1, bot: true, uid: null }])), false, "봇 상대");
  assert.equal(rankedEligible(mk([H("a", 0), H("g", 1, { isGuest: true })])), false, "게스트 상대");
  assert.equal(rankedEligible(mk([H("a", 0), H("bb", 1, { late: true })])), false, "중도 입장자는 제외");
  assert.equal(rankedEligible(mk([H("a", 0), H("bb", 1, { blocked: true })])), false, "의심 판정자 제외");
  assert.equal(rankedEligible({ ...two, winner: null }), false, "무승부/미결정");
  assert.equal(rankedEligible({ ...two, reason: "aborted" }), false);
});

test("레이팅 변화: 같은 실력이면 승자 +, 패자 −(절댓값 같음), 처음 10경기는 변동이 크다", () => {
  const ch = computeRatingChanges(mk([H("a", 0), H("bb", 1)]), {});
  const a = ch.find((c) => c.uid === "a"), b = ch.find((c) => c.uid === "bb");
  assert.equal(a.delta, 16); assert.equal(b.delta, -16);                      // K=32, E=0.5
  assert.equal(a.after, 1016); assert.equal(b.after, 984);
  const settled = computeRatingChanges(mk([H("a", 0), H("bb", 1)]), { a: { rating: 1000, ranked_games: 30 }, bb: { rating: 1000, ranked_games: 30 } });
  assert.equal(settled.find((c) => c.uid === "a").delta, 10, "K=20");
});

test("레이팅 변화: 약자가 강자를 이기면 더 많이 얻고, 강자가 약자를 이기면 조금만 얻는다", () => {
  const cur = { low: { rating: 800, ranked_games: 30 }, high: { rating: 1200, ranked_games: 30 } };
  const upset = computeRatingChanges(mk([H("low", 0), H("high", 1)], { winner: 0 }), cur);
  const expected = computeRatingChanges(mk([H("low", 0), H("high", 1)], { winner: 1 }), cur);
  assert.ok(upset.find((c) => c.uid === "low").delta >= 17, "이변: 크게 상승");
  assert.ok(expected.find((c) => c.uid === "high").delta <= 4 && expected.find((c) => c.uid === "high").delta >= 1, "당연한 승리: 소폭");
});

test("MVP 보너스, 이기면 최소 +1, 레이팅은 0 아래로 안 내려간다", () => {
  const cur = { a: { rating: 1000, ranked_games: 30 }, bb: { rating: 1000, ranked_games: 30 } };
  const base = computeRatingChanges(mk([H("a", 0), H("bb", 1)]), cur).find((c) => c.uid === "a").delta;
  const mvp = computeRatingChanges(mk([H("a", 0, { mvp: true }), H("bb", 1)]), cur).find((c) => c.uid === "a").delta;
  assert.equal(mvp, base + RATING.mvpBonus);
  const huge = computeRatingChanges(mk([H("a", 0), H("bb", 1)]), { a: { rating: 3000, ranked_games: 50 }, bb: { rating: 100, ranked_games: 50 } });
  assert.ok(huge.find((c) => c.uid === "a").delta >= 1);
  const floor = computeRatingChanges(mk([H("a", 0), H("bb", 1)]), { a: { rating: 1000, ranked_games: 30 }, bb: { rating: 3, ranked_games: 50 } });
  assert.ok(floor.find((c) => c.uid === "bb").after >= 0);
});

test("중도 이탈: 팀이 이겨도 패배 처리 + 추가 감점", () => {
  const cur = { a: { rating: 1000, ranked_games: 30 }, c: { rating: 1000, ranked_games: 30 }, bb: { rating: 1000, ranked_games: 30 } };
  const ch = computeRatingChanges(mk([H("a", 0), H("c", 0, { abandoned: true }), H("bb", 1)]), cur);
  const quitter = ch.find((c) => c.uid === "c");
  assert.equal(quitter.won, false);
  assert.ok(quitter.delta <= -(10 + RATING.abandonPenalty - 1), `이탈자 ${quitter.delta}`);
  assert.ok(ch.find((c) => c.uid === "a").delta > 0, "남은 팀원은 정상 승리");
});

test("부정행위 의심: 입력 폭주·퍼펙트 매크로·에임봇형은 차단, 평범한 플레이는 통과", () => {
  assert.equal(assessSuspicion({ dropped: 20, shots: 12, perfect: 2, onTarget: 7 }).blocked, false);
  assert.equal(assessSuspicion({ dropped: 600 }).blocked, true);
  assert.ok(assessSuspicion({ dropped: 600 }).flags.includes("input_flood"));
  const macro = assessSuspicion({ shots: 20, perfect: 19, onTarget: 19 });
  assert.ok(macro.blocked && macro.flags.includes("perfect_macro"));
  assert.equal(assessSuspicion({ shots: 5, perfect: 5, onTarget: 5 }).blocked, false, "표본이 적으면 판단하지 않음");
  assert.equal(assessSuspicion({ shots: 12, perfect: 9, onTarget: 11 }).blocked, false, "잘하는 사람일 뿐(75%)");
});

test("리더보드 정렬: 레이팅 → 승수 → 경기 수 적은 순", () => {
  const rows = [{ rating: 1010, wins: 5, ranked_games: 9 }, { rating: 1050, wins: 3, ranked_games: 4 }, { rating: 1010, wins: 5, ranked_games: 7 }, { rating: 1010, wins: 6, ranked_games: 20 }];
  const s = sortBoard(rows);
  assert.deepEqual(s.map((r) => r.rating + ":" + r.wins + ":" + r.ranked_games), ["1050:3:4", "1010:6:20", "1010:5:7", "1010:5:9"]);
});
