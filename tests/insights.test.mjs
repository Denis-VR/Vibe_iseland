import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { createInsights, visitorRegion } from "../server/insights.mjs";
test("private analytics deduplicate visits, separate choices and store no coordinates or IP", async () => {
  const db = new DatabaseSync(":memory:");
  let providerCalls = 0;
  const route = createInsights(db, {
    lookup: () => ({ country: "RU", region: "MOW", city: "Moscow" }),
    fetchWeather: async () => {
      providerCalls++;
      return {
        ok: true,
        json: async () => ({
          current: { weather_code: 73, is_day: 1, temperature_2m: -4 },
          daily: { sunrise: [100], sunset: [200] },
        }),
      };
    },
  });
  async function call(path, method = "GET", body = {}) {
    let result;
    const handled = await route(
      { method, socket: { remoteAddress: "127.0.0.1" }, headers: {} },
      {},
      new URL(path, "http://localhost"),
      {
        read: async () => JSON.stringify(body),
        json: (_, status, data) => {
          result = { status, data };
        },
      },
    );
    return { handled, ...result };
  }
  const event = { id: randomUUID(), visitor: randomUUID() };
  assert.equal((await call("/api/visit", "POST", event)).status, 202);
  await call("/api/visit", "POST", event);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM visits").get().n, 1);
  assert.equal((await call("/api/visit")).status, 405);
  assert.equal(
    (await call("/api/visit", "POST", { ...event, visitor: "bad" })).status,
    400,
  );
  const search = await call("/api/places?q=Москва");
  assert.equal(search.status, 200);
  const moscow = search.data.find((c) => c.name === "Moscow");
  assert.ok(moscow);
  const choice = {
    id: randomUUID(),
    visitor: event.visitor,
    placeId: moscow.id,
    source: "manual",
  };
  assert.equal((await call("/api/place-choice", "POST", choice)).status, 202);
  await call("/api/place-choice", "POST", choice);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM place_choices").get().n,
    1,
  );
  const cols = db
    .prepare("PRAGMA table_info(place_choices)")
    .all()
    .map((c) => c.name);
  assert.ok(
    !cols.includes("latitude") &&
      !cols.includes("longitude") &&
      !cols.includes("ip"),
  );
  const nearest = await call("/api/nearest-place", "POST", {
    latitude: 55.75,
    longitude: 37.62,
  });
  assert.equal(nearest.data.id, moscow.id);
  assert.equal(
    (await call("/api/nearest-place", "POST", { latitude: 100, longitude: 37 }))
      .status,
    400,
  );
  await Promise.all([
    call("/api/local-weather?placeId=" + moscow.id),
    call("/api/local-weather?placeId=" + moscow.id),
  ]);
  assert.equal(providerCalls, 1);
  assert.equal((await call("/api/stats")).handled, false);
  db.close();
});
test("client cannot spoof origin region without explicitly trusted local proxy", () => {
  const local = {
    socket: { remoteAddress: "127.0.0.1" },
    headers: { "x-real-ip": "8.8.8.8" },
  };
  assert.deepEqual(visitorRegion(local, false), {});
  assert.ok(visitorRegion(local, true).country);
  const remote = {
    socket: { remoteAddress: "10.0.0.1" },
    headers: { "x-real-ip": "8.8.8.8" },
  };
  assert.deepEqual(visitorRegion(remote, true), {});
});

test("device reports validate, deduplicate, discard private extras and cannot be read publicly", async () => {
  const db = new DatabaseSync(":memory:");
  const route = createInsights(db);
  const size = { width: 1280, height: 720 };
  const report = { id: randomUUID(), version: "test", browser: "TV", language: "ru", screen: size, viewport: size, document: size, visual: {...size, scale: 1}, pixelRatio: 1, fullscreen: false, fullscreenSupported: false, touch: 0, fit: "contain", weather: "night", season: "summer", zen: false, latitude: 55, cookie: "private" };
  async function call(method, body) {
    let status;
    await route({ method, headers: {}, socket: {remoteAddress: "127.0.0.1"} }, {}, new URL("http://localhost/api/device-report"), { read: async () => JSON.stringify(body), json: (_, code) => { status = code; } });
    return status;
  }
  assert.equal(await call("POST", report), 202);
  assert.equal(await call("POST", report), 202);
  const rows = db.prepare("SELECT * FROM device_reports").all();
  assert.equal(rows.length, 1);
  assert.equal(JSON.parse(rows[0].data).cookie, undefined);
  assert.equal(JSON.parse(rows[0].data).latitude, undefined);
  assert.equal(await call("GET"), 405);
  assert.equal(await call("POST", {...report, viewport: {width: -1, height: 2}}), 400);
  assert.equal(await call("POST", {...report, browser: "x".repeat(513)}), 400);
  await call("POST", report);
  assert.equal(await call("POST", report), 429);
  db.close();
});
