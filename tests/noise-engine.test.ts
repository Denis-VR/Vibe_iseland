import { test } from "node:test";
import assert from "node:assert/strict";
import { NoiseEngine } from "../app/noise-engine.ts";

test("a late recording load respects the latest channel volume and disposal", async (t) => {
  const originalContext = globalThis.AudioContext,
    originalFetch = globalThis.fetch;
  const pending: (() => void)[] = [];
  const sources: { stop: () => void; stopped: boolean }[] = [];
  function buffer(channels: number, length: number, sampleRate: number) {
    const data = Array.from(
      { length: channels },
      () => new Float32Array(length),
    );
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: (c: number) => data[c],
      copyToChannel: (a: Float32Array, c: number) => data[c].set(a),
    };
  }
  class FakeContext {
    currentTime = 0;
    destination = {};
    createGain() {
      return {
        gain: {
          value: 0,
          setTargetAtTime(value: number) {
            this.value = value;
          },
        },
        connect() {},
      };
    }
    createBiquadFilter() {
      return {
        type: "lowpass",
        frequency: { value: 0, setTargetAtTime() {} },
        connect() {},
      };
    }
    createBuffer = buffer;
    async decodeAudioData() {
      return buffer(2, 2000, 1000);
    }
    createBufferSource() {
      const s = {
        buffer: null,
        loop: false,
        connect() {},
        start() {},
        stopped: false,
        stop() {
          this.stopped = true;
        },
      };
      sources.push(s);
      return s;
    }
    async resume() {}
    async close() {}
  }
  globalThis.AudioContext = FakeContext as unknown as typeof AudioContext;
  globalThis.fetch = (() =>
    new Promise((resolve) =>
      pending.push(() =>
        resolve(new Response(new ArrayBuffer(1))),
      ),
    )) as typeof fetch;
  t.after(() => {
    globalThis.AudioContext = originalContext;
    globalThis.fetch = originalFetch;
  });
  const engine = new NoiseEngine();
  engine.set("fire", 70);
  engine.set("fire", 0);
  assert.equal(pending.length, 1, "only one request per channel");
  pending.shift()!();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    engine.nodes.get("fire")!.gain.gain.value,
    0,
    "late loading must not bring back a muted channel",
  );
  engine.set("fire", 35);
  assert.equal(engine.nodes.get("fire")!.gain.gain.value, 0.35);
  engine.set("stream", 70);
  await engine.close();
  pending.shift()!();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(engine.nodes.has("stream"), false);
  assert.ok(sources[0].stopped);
});
