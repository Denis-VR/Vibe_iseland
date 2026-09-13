import { test } from "node:test";
import assert from "node:assert/strict";
import { nextWeather, scheduleWeather } from "../app/world.ts";
test("weather follows a complete cycle", () => {
  assert.deepEqual(["sunset", "fog", "rain", "night"].map(nextWeather), [
    "fog",
    "rain",
    "night",
    "sunset",
  ]);
});
test("automatic cycle uses selected interval and fixed mode cancels it", () => {
  let callback = () => {},
    delay = 0,
    cleared = false,
    weather = "sunset";
  const stop = scheduleWeather(
    20,
    () => {
      weather = nextWeather(weather);
    },
    {
      setInterval(fn, ms) {
        callback = fn;
        delay = ms;
        return 7;
      },
      clearInterval(id) {
        assert.equal(id, 7);
        cleared = true;
      },
    },
  );
  assert.equal(delay, 1200000);
  callback();
  assert.equal(weather, "fog");
  stop();
  assert.ok(cleared);
});
