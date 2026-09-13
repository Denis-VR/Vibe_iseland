import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createNoiseSamples,
  noiseChannels,
  fieldRecordings,
} from "../app/noise-engine.ts";
function seeded() {
  let state = 42;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
test("all sound channels are bounded, finite and seamless", () => {
  for (const { id } of noiseChannels.filter((c) => !fieldRecordings[c.id])) {
    const s = createNoiseSamples(id, 22050, 16, seeded());
    let energy = 0,
      peak = 0;
    for (const v of s) {
      assert.ok(Number.isFinite(v));
      energy += v * v;
      peak = Math.max(peak, Math.abs(v));
    }
    assert.ok(energy > 0, id);
    assert.ok(peak < 0.5, id);
    let maxStep = 0;
    for (let i = 1; i < s.length; i++)
      maxStep = Math.max(maxStep, Math.abs(s[i] - s[i - 1]));
    assert.ok(
      Math.abs(s[0] - s[s.length - 1]) <= maxStep * 1.01,
      id + " loop seam",
    );
  }
});
test("waterfall has no tonal bird whistle", () => {
  const stream = createNoiseSamples("water", 22050, 4, seeded());
  // A stationary oscillator creates a narrow spectral peak; a water bed should not.
  const n = 8192;
  const powers = [];
  for (let f = 400; f <= 600; f += 10) {
    let re = 0,
      im = 0;
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * f * i) / 22050;
      re += stream[i] * Math.cos(a);
      im += stream[i] * Math.sin(a);
    }
    powers.push(re * re + im * im);
  }
  assert.ok(Math.max(...powers) < powers.reduce((a, b) => a + b, 0) * 0.5);
});

test("natural channels never fall back to synthetic noise", () => {
  for (const kind of ["fire", "stream", "rain", "village", "sea", "night", "crickets", "frogs"] as const) {
    assert.ok(fieldRecordings[kind]);
    assert.throws(() => createNoiseSamples(kind));
  }
});
