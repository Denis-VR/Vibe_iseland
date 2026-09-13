import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
const auth =
  "Basic " + Buffer.from("owner:qa-local-password").toString("base64");
async function start(dir, extraEnv = {}) {
  const child = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      DATA_DIR: dir,
      PORT: "0",
      HOST: "127.0.0.1",
      ACCESS_PASSWORD: "qa-local-password",
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const url = await new Promise((resolve, reject) => {
    child.stdout.on("data", (data) => {
      const found = data.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
      if (found) resolve(found[0]);
    });
    child.once("exit", (code) => reject(Error("Server exited " + code)));
    setTimeout(() => reject(Error("startup timeout")), 10000).unref();
  });
  return { child, url };
}
async function stop(child) {
  const done = once(child, "exit");
  child.kill("SIGTERM");
  await done;
}
test("portable server protects, persists and streams library without cloud services", async () => {
  const dir = await mkdtemp(join(tmpdir(), "quiet-height-test-"));
  let running;
  try {
    running = await start(dir);
    const req = (path, options = {}) =>
      fetch(running.url + path, {
        ...options,
        headers: { Authorization: auth, ...options.headers },
      });
    assert.equal((await fetch(running.url + "/api/state")).status, 401);
    let response = await req("/api/state");
    const first = await response.json();
    const state = {
      playlists: [
        { id: "qa", name: "Локальный плейлист", tracks: ["ambient-day"] },
      ],
    };
    const options = {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, revision: first.revision }),
    };
    assert.equal(
      (
        await req("/api/state", {
          ...options,
          headers: { ...options.headers, Origin: "https://example.invalid" },
        })
      ).status,
      403,
    );
    assert.equal((await req("/api/state", options)).status, 200);
    assert.equal((await req("/api/state", options)).status, 409);
    const audio = await readFile("public/audio/dawn.mp3");
    response = await req("/api/tracks", {
      method: "POST",
      headers: {
        "X-File-Name": encodeURIComponent("Мой трек.mp3"),
        "Content-Type": "application/octet-stream",
      },
      body: audio,
    });
    assert.equal(response.status, 405);
    assert.deepEqual(await (await req("/api/tracks")).json(), []);
    response = await req("/audio/dawn.mp3", {
      headers: { Range: "bytes=10-99" },
    });
    assert.equal(response.status, 206);
    assert.deepEqual(
      Buffer.from(await response.arrayBuffer()),
      audio.subarray(10, 100),
    );
    assert.equal(
      (
        await req("/audio/dawn.mp3", {
          headers: { Range: "bytes=99999999-" },
        })
      ).status,
      416,
    );
    assert.equal(
      (await req("/audio/dawn.mp3", { method: "HEAD" })).headers.get(
        "content-length",
      ),
      String(audio.length),
    );
    assert.equal(
      (
        await req("/api/tracks", {
          method: "POST",
          headers: { "X-File-Name": "bad.html" },
          body: "bad",
        })
      ).status,
      405,
    );
    const visit = { id: randomUUID(), visitor: randomUUID() };
    const post = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(visit),
    };
    assert.equal((await req("/api/visit", post)).status, 202);
    assert.equal((await req("/api/visit", post)).status, 202);
    assert.equal(
      (
        await req("/api/place-choice", {
          ...post,
          body: JSON.stringify({
            ...visit,
            id: randomUUID(),
            placeId: 524901,
            source: "manual",
          }),
        })
      ).status,
      202,
    );
    assert.equal((await req("/api/visit")).status, 405);
    assert.equal((await req("/api/stats")).status, 404);
    await stop(running.child);
    running = await start(dir);
    const analytics = new DatabaseSync(join(dir, "quiet-height.sqlite"), {
      readOnly: true,
    });
    assert.equal(
      analytics.prepare("SELECT COUNT(*) AS n FROM visits").get().n,
      1,
    );
    assert.equal(
      analytics.prepare("SELECT COUNT(*) AS n FROM place_choices").get().n,
      1,
    );
    analytics.close();
    const restored = await (await req("/api/state")).json();
    assert.deepEqual(restored.state, state);
    assert.deepEqual(await (await req("/api/tracks")).json(), []);
    for (const name of [
      "dawn",
      "day",
      "fog",
      "rain",
      "sunset",
      "night",
      "clouds",
      "winter",
      "spring",
      "autumn",
    ])
      assert.equal(
        (await req("/scenes/" + name + ".webp", { method: "HEAD" })).status,
        200,
      );
  } finally {
    if (running?.child.exitCode === null) await stop(running.child);
    await rm(dir, { recursive: true, force: true });
  }
});

test("public visitors have isolated playlists and secure opaque cookies", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vibe-public-test-"));
  let running;
  try {
    running = await start(dir, { PUBLIC_SITE: "1" });
    const get = () =>
      fetch(running.url + "/api/state", { headers: { Authorization: auth } });
    const a = await get(),
      b = await get();
    const ca = a.headers.get("set-cookie"),
      cb = b.headers.get("set-cookie");
    assert.match(ca, /Secure; HttpOnly; SameSite=Lax/);
    assert.notEqual(ca, cb);
    const state = {
      playlists: [
        { id: "mine", name: "Only my playlist", tracks: ["ambient-dawn"] },
      ],
    };
    const response = await fetch(running.url + "/api/state", {
      method: "PUT",
      headers: {
        Authorization: auth,
        Cookie: ca.split(";")[0],
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ state, revision: 0 }),
    });
    assert.equal(response.status, 200);
    const read = async (cookie) =>
      (
        await fetch(running.url + "/api/state", {
          headers: { Authorization: auth, Cookie: cookie.split(";")[0] },
        })
      ).json();
    assert.deepEqual((await read(ca)).state, state);
    assert.notDeepEqual((await read(cb)).state, state);
    await stop(running.child);
    running = await start(dir, { PUBLIC_SITE: "1" });
    assert.deepEqual((await read(ca)).state, state);
  } finally {
    if (running?.child.exitCode === null) await stop(running.child);
    await rm(dir, { recursive: true, force: true });
  }
});
