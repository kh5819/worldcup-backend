// 효과음 모듈 테스트: 가짜 AudioContext로 모든 소리가 오류 없이 만들어지고, 음소거면 아무것도 안 만드는지 확인
import test from "node:test";
import assert from "node:assert/strict";

// 브라우저 환경 흉내 (sound-manager.js 가 document/localStorage/window 를 쓴다)
globalThis.localStorage = { _m: new Map(), getItem(k) { return this._m.has(k) ? this._m.get(k) : null; }, setItem(k, v) { this._m.set(k, String(v)); } };
globalThis.document = { readyState: "complete", addEventListener() {}, getElementById() { return null; }, body: null, createElement() { return { style: {}, addEventListener() {}, setAttribute() {} }; } };
globalThis.window = globalThis;
Object.defineProperty(globalThis, "navigator", { value: { vibrate: () => true }, configurable: true });

let created = 0;
function node() { const n = { connect(x) { return x || n; }, start() {}, stop() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, Q: {}, type: "", buffer: null, loop: false }; return n; }
class FakeCtx {
  constructor() { this.currentTime = 0; this.sampleRate = 8000; this.destination = {}; this.state = "running"; }
  resume() {}
  createOscillator() { created++; return node(); }
  createGain() { return node(); }
  createBiquadFilter() { return node(); }
  createBufferSource() { created++; return node(); }
  createBuffer(c, len) { return { sampleRate: this.sampleRate, getChannelData: () => new Float32Array(len) }; }
}
globalThis.AudioContext = FakeCtx;

const { default: sound } = await import("../../../홈페이지 제작/js/common/sound-manager.js");
const { sfx } = await import("../../../홈페이지 제작/js/chago-sfx.js");

test("모든 효과음이 오류 없이 재생된다 (소리 노드 생성)", () => {
  sound.setMuted(false); sound._unlock();
  const names = ["pass", "shot", "through", "whiff", "tackle", "tackleHit", "post", "dash", "bounce", "whistle", "whistleEnd", "tick", "go", "goal", "ownGoal", "overtime", "win", "lose", "draw", "seat"];
  for (const n of names) {
    const before = created;
    sfx.play(n, 0.8, 0);
    assert.ok(created > before, `${n} 소리가 만들어지지 않음`);
  }
});

test("서버 이벤트가 알맞은 소리로 연결된다 / 강슛은 약슛보다 소리 노드가 많다", () => {
  sound.setMuted(false);
  const count = (fn) => { sfx.reset(); const b = created; fn(); return created - b; };
  assert.ok(count(() => sfx.event({ type: "kick", kind: "pass" }, false)) > 0);
  assert.ok(count(() => sfx.event({ type: "goal", team: 0 }, false)) >= 5, "골은 함성+뿔피리");
  assert.ok(count(() => sfx.event({ type: "post" }, false)) > 0);
  const weak = count(() => { sfx.play("shot", 0.1, 0); }), strong = count(() => { sfx.play("shot", 0.95, 0); });
  assert.ok(strong > weak, `강슛 ${strong} > 약슛 ${weak}`);
  assert.equal(count(() => sfx.event({ type: "whiff" }, false)), 0, "남의 헛발질은 소리 없음");
  assert.ok(count(() => sfx.event({ type: "whiff" }, true)) > 0, "내 헛발질은 소리 있음");
});

test("음소거면 아무 소리도 만들지 않는다 / 알 수 없는 소리·이벤트는 무시", () => {
  sound.setMuted(true);
  const b = created;
  sfx.play("goal", null, 0); sfx.event({ type: "goal" }, false);
  assert.equal(created, b);
  sound.setMuted(false);
  assert.doesNotThrow(() => { sfx.play("없는소리", null, 0); sfx.event({ type: "???" }, true); sfx.event({}, false); });
});

test("같은 소리 연타는 최소 간격으로 막는다", () => {
  sound.setMuted(false); sfx.reset();
  const b = created;
  sfx.play("post", null, 100000); sfx.play("post", null, 100000);
  const first = created - b;
  assert.ok(first > 0 && first <= 4, `첫 재생만 반영 ${first}`);
});
