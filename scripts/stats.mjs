import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
const db = new DatabaseSync(
  resolve(process.env.DATA_DIR || "data", "quiet-height.sqlite"),
  { readOnly: true },
);
const days = Number(process.argv[2] || 30);
if (!Number.isInteger(days) || days < 1 || days > 36500)
  throw Error("Укажи количество дней: npm run stats -- 30");
const since = new Date(Date.now() - days * 86400000).toISOString();
const result = {
  period: { since, until: new Date().toISOString() },
  totals: db
    .prepare(
      "SELECT COUNT(*) AS visits, COUNT(DISTINCT visitor) AS browsers FROM visits WHERE at >= ?",
    )
    .get(since),
  daily: db
    .prepare(
      "SELECT substr(at,1,10) AS day, COUNT(*) AS visits, COUNT(DISTINCT visitor) AS browsers FROM visits WHERE at >= ? GROUP BY day ORDER BY day",
    )
    .all(since),
  originCountries: db.prepare("SELECT COALESCE(country, 'unknown') AS country, COUNT(*) AS visits, COUNT(DISTINCT visitor) AS browsers FROM visits WHERE at >= ? GROUP BY country ORDER BY visits DESC").all(since),
  selectedCountries: db.prepare("SELECT country, COUNT(*) AS selections, COUNT(DISTINCT visitor) AS browsers FROM place_choices WHERE at >= ? GROUP BY country ORDER BY selections DESC").all(since),
  origins: db
    .prepare(
      "SELECT COALESCE(country,'unknown') AS country, COALESCE(region,'unknown') AS region, COALESCE(city,'unknown') AS city, COUNT(*) AS visits, COUNT(DISTINCT visitor) AS browsers FROM visits WHERE at >= ? GROUP BY country,region,city ORDER BY visits DESC",
    )
    .all(since),
  selectedPlaces: db
    .prepare(
      "SELECT city,country,region,source,COUNT(*) AS selections,COUNT(DISTINCT visitor) AS browsers FROM place_choices WHERE at >= ? GROUP BY place_id,source ORDER BY selections DESC",
    )
    .all(since),
};
console.log(JSON.stringify(result, null, 2));
db.close();
