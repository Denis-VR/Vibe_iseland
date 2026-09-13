import http from "node:http";
import { createInsights } from "./insights.mjs";
import { DatabaseSync } from "node:sqlite";
import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { resolve, join, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { z } from "zod";
const root = fileURLToPath(new URL("..", import.meta.url));
const data = resolve(process.env.DATA_DIR || join(root, "data"));
await mkdir(join(data, "audio"), { recursive: true });
const db = new DatabaseSync(join(data, "quiet-height.sqlite"));
db.exec(
  "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS library (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL, revision INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS tracks (id TEXT PRIMARY KEY,name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL)",
);
db.prepare("INSERT OR IGNORE INTO library VALUES(1,?,0)").run(
  JSON.stringify({
    playlists: [{ id: "personal", name: "Мой горный плейлист", tracks: [] }],
  }),
);
const publicSite = process.env.PUBLIC_SITE === "1";
const defaultLibrary = JSON.stringify({
  playlists: [{ id: "personal", name: "Мой горный плейлист", tracks: [] }],
});
db.exec(
  "CREATE TABLE IF NOT EXISTS browser_libraries (owner TEXT PRIMARY KEY, value TEXT NOT NULL, revision INTEGER NOT NULL)",
);
function libraryOwner(req, res) {
  const cookie = (req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("__Host-vibe-list="))
    ?.split("=")[1];
  if (cookie && /^[a-f0-9]{64}$/.test(cookie)) return cookie;
  const owner = randomBytes(32).toString("hex");
  res.setHeader(
    "Set-Cookie",
    `__Host-vibe-list=${owner}; Path=/; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax`,
  );
  return owner;
}
const insights = createInsights(db);
const schema = z.object({
  revision: z.number().int().min(0),
  state: z.object({
    playlists: z
      .array(
        z.object({
          id: z.string().min(1).max(80),
          name: z.string().trim().min(1).max(100),
          tracks: z.array(z.string().max(80)).max(300),
        }),
      )
      .max(100),
  }),
});
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".json": "application/json",
};
const password = process.env.ACCESS_PASSWORD;
function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}
async function read(req, limit) {
  let length = 0;
  const parts = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > limit)
      throw Object.assign(Error("Слишком большой запрос"), { status: 413 });
    parts.push(chunk);
  }
  return Buffer.concat(parts).toString("utf8");
}
async function sendFile(req, res, path, mime) {
  const file = await stat(path);
  if (!file.isFile()) throw Object.assign(Error("Не найдено"), { status: 404 });
  let start = 0,
    end = file.size - 1,
    status = 200;
  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!m || (!m[1] && !m[2])) {
      res.writeHead(416, { "Content-Range": `bytes */${file.size}` });
      return res.end();
    }
    if (!m[1]) {
      start = Math.max(0, file.size - Number(m[2]));
    } else {
      start = Number(m[1]);
      if (m[2]) end = Math.min(end, Number(m[2]));
    }
    if (start > end || start >= file.size) {
      res.writeHead(416, { "Content-Range": `bytes */${file.size}` });
      return res.end();
    }
    status = 206;
  }
  const headers = {
    "Content-Type": mime,
    "Content-Length": end - start + 1,
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": path.startsWith(data) ? "private, no-store" : "no-cache",
  };
  if (status === 206)
    headers["Content-Range"] = `bytes ${start}-${end}/${file.size}`;
  res.writeHead(status, headers);
  if (req.method === "HEAD") return res.end();
  await pipeline(createReadStream(path, { start, end }), res);
}
const dev = process.argv.includes("--dev");
const vite = dev
  ? await (
      await import("vite")
    ).createServer({
      configFile: join(root, "vite.local.config.ts"),
      server: { middlewareMode: true },
      appType: "spa",
    })
  : null;
const server = http.createServer(async (req, res) => {
  try {
    if (password) {
      const auth = req.headers.authorization || "";
      let pass = "";
      try {
        pass = Buffer.from(auth.replace(/^Basic /, ""), "base64")
          .toString()
          .split(":")
          .slice(1)
          .join(":");
      } catch {}
      const a = Buffer.from(pass),
        b = Buffer.from(password);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        res.writeHead(401, {
          "WWW-Authenticate": 'Basic realm="Quiet Height", charset="UTF-8"',
        });
        return res.end("Authentication required");
      }
    }
    const url = new URL(req.url, "http://" + req.headers.host);
    const path = url.pathname;
    if (!["GET", "HEAD"].includes(req.method) && req.headers.origin) {
      let origin;
      try {
        origin = new URL(req.headers.origin);
      } catch {}
      if (!origin || origin.host !== req.headers.host)
        return json(res, 403, { error: "Запрос с другого сайта отклонён" });
    }
    if (await insights(req, res, url, { json, read })) return;
    if (path === "/api/health") return json(res, 200, { ok: true });
    if (path === "/api/state" && req.method === "GET") {
      const row = publicSite
        ? db
            .prepare(
              "SELECT value,revision FROM browser_libraries WHERE owner=?",
            )
            .get(libraryOwner(req, res)) || {
            value: defaultLibrary,
            revision: 0,
          }
        : db.prepare("SELECT value,revision FROM library WHERE id=1").get();
      return json(res, 200, {
        state: JSON.parse(row.value),
        revision: row.revision,
      });
    }
    if (path === "/api/state" && req.method === "PUT") {
      const parsed = schema.safeParse(JSON.parse(await read(req, 500000)));
      if (!parsed.success) return json(res, 400, { error: "Проверь плейлист" });
      const { state, revision } = parsed.data;
      let result;
      if (publicSite) {
        const owner = libraryOwner(req, res);
        db.prepare("INSERT OR IGNORE INTO browser_libraries VALUES(?,?,0)").run(
          owner,
          defaultLibrary,
        );
        result = db
          .prepare(
            "UPDATE browser_libraries SET value=?,revision=revision+1 WHERE owner=? AND revision=?",
          )
          .run(JSON.stringify(state), owner, revision);
      } else {
        result = db
          .prepare(
            "UPDATE library SET value=?,revision=revision+1 WHERE id=1 AND revision=?",
          )
          .run(JSON.stringify(state), revision);
      }
      return result.changes
        ? json(res, 200, { revision: revision + 1 })
        : json(res, 409, {
            error:
              "Плейлисты изменились на другом устройстве. Обнови страницу.",
          });
    }
    if (path === "/api/tracks" && req.method === "GET")
      return json(
        res,
        200,
        db.prepare("SELECT * FROM tracks ORDER BY rowid DESC").all(),
      );
    if (path === "/api/tracks" && req.method === "POST")
      return json(res, 405, { error: "Загрузка своих треков отключена" });

    if (
      path.startsWith("/api/tracks/") &&
      ["GET", "HEAD"].includes(req.method)
    ) {
      const id = path.split("/").pop(),
        track = db.prepare("SELECT * FROM tracks WHERE id=?").get(id);
      if (!track) return json(res, 404, { error: "Трек не найден" });
      return await sendFile(
        req,
        res,
        join(data, "audio", track.id),
        track.mime,
      );
    }
    if (path.startsWith("/api/"))
      return json(res, 404, { error: "Не найдено" });
    if (vite) return vite.middlewares(req, res);
    if (!["GET", "HEAD"].includes(req.method))
      return json(res, 405, { error: "Метод не поддерживается" });
    const publicRoot = join(root, "dist-local");
    let file = resolve(publicRoot, "." + decodeURIComponent(path));
    if (!file.startsWith(publicRoot + sep) && file !== publicRoot)
      return json(res, 403, { error: "Доступ запрещён" });
    if (path === "/") file = join(publicRoot, "index.html");
    await sendFile(
      req,
      res,
      file,
      types[extname(file)] || "application/octet-stream",
    );
  } catch (e) {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    json(
      res,
      e.status ||
        (e.code === "ENOENT" ? 404 : e instanceof SyntaxError ? 400 : 500),
      {
        error: e.status
          ? e.message
          : e.code === "ENOENT"
            ? "Не найдено"
            : "Не удалось выполнить запрос",
      },
    );
    if (!e.status && e.code !== "ENOENT") console.error(e);
  }
});
const port = Number(process.env.PORT || (dev ? 5173 : 4173)),
  host = process.env.HOST || "127.0.0.1";
server.listen(port, host, () =>
  console.log(
    `Тихая высота: http://${host === "0.0.0.0" ? "localhost" : host}:${server.address().port}\nДанные: ${data}`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(async () => {
      await vite?.close();
      db.close();
      process.exit(0);
    });
  });
