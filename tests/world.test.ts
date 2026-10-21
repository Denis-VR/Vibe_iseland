import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nextWeather,
  scheduleWeather,
  validWeatherMinutes,
} from "../app/world.ts";
test("weather follows a complete cycle", () => {
  assert.deepEqual(
    [
      "dawn",
      "day",
      "fog",
      "rain",
      "sunset",
      "night",
      "winter",
      "spring",
      "autumn",
    ].map(nextWeather),
    [
      "day",
      "fog",
      "rain",
      "sunset",
      "night",
      "winter",
      "spring",
      "autumn",
      "dawn",
    ],
  );
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
  assert.equal(weather, "night");
  stop();
  assert.ok(cleared);
});

test("custom weather interval is validated and used exactly", () => {
  for (const value of [1, 7, 47, 1440]) assert.ok(validWeatherMinutes(value));
  for (const value of [0, -1, 1.5, 1441, NaN, Infinity, "7", null])
    assert.equal(validWeatherMinutes(value), false);
  let ms = 0;
  const cancel = scheduleWeather(7, () => {}, {
    setInterval: (_, value) => {
      ms = value;
      return 1;
    },
    clearInterval: () => {},
  });
  assert.equal(ms, 420000);
  cancel();
});

import { validFocusMinutes, focusTime, weatherForPlace } from "../app/world.ts";
test("focus duration accepts 5 minutes through 24 hours and formats long sessions", () => {
  for (const value of [5, 25, 1440])
    assert.ok(validFocusMinutes(value));
  for (const value of [0, 4, 5.5, 1441, Infinity, NaN, "25"])
    assert.equal(validFocusMinutes(value), false);
  assert.equal(focusTime(5 * 60), "05:00");
  assert.equal(focusTime(1440 * 60), "1 д · 00:00:00");
});
test("local weather follows sun times and weather codes independently of browser timezone", () => {
  const base = {
    code: 0,
    isDay: 1,
    temperature: 4,
    sunrise: [100000],
    sunset: [140000],
    fetchedAt: 0,
    timezone: "Asia/Tokyo",
  };
  assert.equal(weatherForPlace(base, 100000000), "dawn");
  assert.equal(weatherForPlace(base, 140000000), "sunset");
  assert.equal(weatherForPlace(base, 150000000), "night");
  assert.equal(weatherForPlace(base, 120000000), "day");
  assert.equal(weatherForPlace({ ...base, code: 73 }, 120000000), "winter");
  assert.equal(weatherForPlace({ ...base, code: 63 }, 120000000), "rain");
  assert.equal(weatherForPlace({ ...base, code: 45 }, 120000000), "fog");
  assert.equal(
    weatherForPlace(
      { ...base, sunrise: [0], sunset: [0], isDay: 0 },
      120000000,
    ),
    "night",
  );
});

import { seasonForPlace } from "../app/world.ts";
import { sceneAsset } from "../app/season-light.ts";
test("season follows city calendar, timezone and hemisphere and survives night or rain", () => {
  const north = { latitude: 55.75, timezone: "Europe/Moscow", code: 0 };
  assert.equal(
    seasonForPlace(north, Date.parse("2026-09-13T12:00:00Z")),
    "autumn",
  );
  assert.equal(
    seasonForPlace(
      { ...north, latitude: -33.87, timezone: "Australia/Sydney" },
      Date.parse("2026-09-13T12:00:00Z"),
    ),
    "spring",
  );
  assert.equal(
    seasonForPlace(north, Date.parse("2026-06-13T12:00:00Z")),
    "summer",
  );
  assert.equal(
    seasonForPlace(north, Date.parse("2026-02-28T22:00:00Z")),
    "spring",
  );
  assert.equal(
    seasonForPlace({ ...north, code: 73 }, Date.parse("2026-09-13T12:00:00Z")),
    "winter",
  );
  assert.equal(sceneAsset("night", "autumn"), "autumn");
  assert.equal(sceneAsset("rain", "spring"), "spring");
  assert.equal(sceneAsset("spring", "winter"), "spring");
  assert.equal(sceneAsset("night", "summer"), "night");
});
