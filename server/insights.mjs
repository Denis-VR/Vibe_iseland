import geoip from "geoip-lite";
import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import { z } from "zod";
const cities = JSON.parse(
  readFileSync(new URL("./cities.json", import.meta.url), "utf8"),
);
const byId = new Map(cities.map((c) => [c.id, c]));
const names = new Intl.DisplayNames(["ru"], { type: "region" });
const regions = JSON.parse(
  readFileSync(new URL("./regions.json", import.meta.url), "utf8"),
);
const publicCity = (c) => ({
  id: c.id,
  name: c.name,
  country: c.country,
  countryName: names.of(c.country),
  region: regions[c.country + "." + c.region] || c.region,
  timezone: c.timezone,
});
const dimensions = z.object({ width: z.number().min(0).max(100000), height: z.number().min(0).max(100000) });
const reportSchema = z.object({
  id: z.string().uuid(), version: z.string().max(80), browser: z.string().max(512), language: z.string().max(40),
  screen: dimensions, viewport: dimensions, document: dimensions,
  visual: dimensions.extend({ scale: z.number().positive().max(100) }),
  quality: z.enum(["auto", "hd", "uhd"]).optional(), sourceResolution: z.string().max(40).optional(),
  rendered: z.array(dimensions.extend({ selector: z.enum([".sanctuary", ".landscape-layers", ".landscape-canvas"]), x: z.number().min(-100000).max(100000), y: z.number().min(-100000).max(100000) })).max(3).optional(),
  canvas: dimensions.optional(),
  pixelRatio: z.number().positive().max(100), fullscreen: z.boolean(), fullscreenSupported: z.boolean(),
  touch: z.number().int().min(0).max(100), fit: z.enum(["contain", "cover"]),
  weather: z.string().max(30), season: z.string().max(30), zen: z.boolean(),
});
const eventSchema = z.object({
  id: z.string().uuid(),
  visitor: z.string().uuid(),
});
function clientIp(req, trustProxy = process.env.TRUST_PROXY === "1") {
  let ip = req.socket.remoteAddress || "";
  // Only a local, explicitly configured reverse proxy may supply X-Real-IP.
  if (trustProxy && ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip)) {
    const forwarded = req.headers["x-real-ip"];
    if (typeof forwarded === "string" && isIP(forwarded)) ip = forwarded;
  }
  return ip;
}
export function visitorRegion(
  req,
  trustProxy = process.env.TRUST_PROXY === "1",
) {
  return geoip.lookup(clientIp(req, trustProxy)) || {};
}
export function createInsights(
  db,
  { lookup = visitorRegion, fetchWeather = fetch } = {},
) {
  db.exec(`CREATE TABLE IF NOT EXISTS visits (id TEXT PRIMARY KEY, visitor TEXT NOT NULL, at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), country TEXT, region TEXT, city TEXT);
    CREATE INDEX IF NOT EXISTS visits_at ON visits(at);
    CREATE TABLE IF NOT EXISTS place_choices (id TEXT PRIMARY KEY, visitor TEXT NOT NULL, at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), place_id INTEGER NOT NULL, city TEXT NOT NULL, country TEXT NOT NULL, region TEXT, source TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS choices_at ON place_choices(at);`);
  db.exec("CREATE TABLE IF NOT EXISTS device_reports (id TEXT PRIMARY KEY, at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), data TEXT NOT NULL)");
  const reportsCounts = new Map();
  const cache = new Map();
  const requestCounts = new Map();
  return async function route(req, res, url, { json, read }) {
    const path = url.pathname;
    if (
      ![
        "/api/device-report",
        "/api/visit",
        "/api/place-choice",
        "/api/places",
        "/api/nearest-place",
        "/api/local-weather",
      ].includes(path)
    )
      return false;
    const isEvent = [
      "/api/device-report",
      "/api/visit",
      "/api/place-choice",
      "/api/nearest-place",
    ].includes(path);
    if (req.method !== (isEvent ? "POST" : "GET")) {
      json(res, 405, { error: "Метод не поддерживается" });
      return true;
    }
    // Short lived, bounded abuse protection. Addresses are never written to disk.
    const ip = clientIp(req);
    const minute = Math.floor(Date.now() / 60000);
    if (requestCounts.size > 10000) requestCounts.clear();
    const counter = requestCounts.get(ip);
    const count = counter?.minute === minute ? counter.count + 1 : 1;
    requestCounts.set(ip, { minute, count });
    if (count > 180) {
      json(res, 429, {
        error: "Слишком много запросов. Попробуй через минуту.",
      });
      return true;
    }
    try {
      if (path === "/api/device-report") {
        if (reportsCounts.size > 10000) reportsCounts.clear();
        const previous = reportsCounts.get(ip);
        const n = previous?.minute === minute ? previous.n + 1 : 1;
        reportsCounts.set(ip, { minute, n });
        if (n > 5) { json(res, 429, { error: "Попробуй через минуту" }); return true; }
        const report = reportSchema.parse(JSON.parse(await read(req, 8000)));
        db.prepare("INSERT OR IGNORE INTO device_reports(id,data) VALUES(?,?)").run(report.id, JSON.stringify(report));
        json(res, 202, { ok: true, id: report.id });
      } else if (path === "/api/visit") {
        const body = eventSchema.parse(JSON.parse(await read(req, 2000)));
        const region = lookup(req);
        db.prepare(
          "INSERT OR IGNORE INTO visits(id,visitor,country,region,city) VALUES(?,?,?,?,?)",
        ).run(
          body.id,
          body.visitor,
          region.country || null,
          region.region || null,
          region.city || null,
        );
        json(res, 202, { ok: true });
      } else if (path === "/api/place-choice") {
        const body = eventSchema
          .extend({
            placeId: z.number().int(),
            source: z.enum(["manual", "geolocation"]),
          })
          .parse(JSON.parse(await read(req, 2000)));
        const city = byId.get(body.placeId);
        if (!city) throw Error("Город не найден");
        db.prepare(
          "INSERT OR IGNORE INTO place_choices(id,visitor,place_id,city,country,region,source) VALUES(?,?,?,?,?,?,?)",
        ).run(
          body.id,
          body.visitor,
          city.id,
          city.name,
          city.country,
          city.region,
          body.source,
        );
        json(res, 202, { ok: true });
      } else if (path === "/api/places") {
        const q = (url.searchParams.get("q") || "").trim().toLocaleLowerCase();
        if (q.length < 2 || q.length > 100)
          throw Error("Введи от 2 до 100 символов");
        const found = cities
          .filter((c) =>
            (c.name + "," + c.aliases)
              .toLocaleLowerCase()
              .split(",")
              .some((n) => n.startsWith(q)),
          )
          .sort((a, b) => b.population - a.population)
          .slice(0, 8);
        json(res, 200, found.map(publicCity));
      } else if (path === "/api/nearest-place") {
        const body = z
          .object({
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
          })
          .parse(JSON.parse(await read(req, 1000)));
        const rad = Math.PI / 180;
        let closest,
          distance = Infinity;
        for (const c of cities) {
          const a =
            Math.sin(((c.latitude - body.latitude) * rad) / 2) ** 2 +
            Math.cos(body.latitude * rad) *
              Math.cos(c.latitude * rad) *
              Math.sin(((c.longitude - body.longitude) * rad) / 2) ** 2;
          const d = 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
          if (d < distance) {
            distance = d;
            closest = c;
          }
        }
        if (!closest || distance > 150)
          throw Error(
            "Рядом нет города в справочнике. Выбери ближайший город вручную.",
          );
        json(res, 200, { ...publicCity(closest), approximate: true });
      } else {
        const c = byId.get(Number(url.searchParams.get("placeId")));
        if (!c) throw Error("Город не найден");
        let entry = cache.get(c.id);
        if (!entry || entry.expires < Date.now()) {
          const params = new URLSearchParams({
            latitude: String(c.latitude),
            longitude: String(c.longitude),
            current: "weather_code,is_day,temperature_2m",
            daily: "sunrise,sunset",
            timezone: c.timezone,
            timeformat: "unixtime",
            forecast_days: "2",
          });
          if (cache.size >= 500) cache.delete(cache.keys().next().value);
          // Cache in-flight requests too, to prevent duplicate provider requests.
          const promise = (async () => {
            const r = await fetchWeather(
              "https://api.open-meteo.com/v1/forecast?" + params,
              { signal: AbortSignal.timeout(12000) },
            );
            if (!r.ok)
              throw Error("Погода временно недоступна. Попробуй позже.");
            const data = await r.json();
            if (
              !Number.isFinite(data.current?.weather_code) ||
              !Array.isArray(data.daily?.sunrise)
            )
              throw Error("Не удалось прочитать погоду");
            return {
              code: data.current.weather_code,
              isDay: data.current.is_day,
              temperature: data.current.temperature_2m,
              sunrise: data.daily.sunrise,
              sunset: data.daily.sunset,
              fetchedAt: Date.now(),
              timezone: c.timezone,
              latitude: c.latitude,
            };
          })();
          entry = { expires: Date.now() + 900000, promise };
          cache.set(c.id, entry);
          promise.catch(() => {
            if (cache.get(c.id) === entry) cache.delete(c.id);
          });
        }
        json(res, 200, await entry.promise);
      }
    } catch (error) {
      json(
        res,
        error instanceof z.ZodError || error instanceof SyntaxError
          ? 400
          : path === "/api/local-weather"
            ? 502
            : 400,
        {
          error:
            error instanceof z.ZodError
              ? "Проверь введённые данные"
              : error.name === "TimeoutError"
                ? "Сервис погоды не отвечает. Попробуй позже."
                : error.message,
        },
      );
    }
    return true;
  };
}
