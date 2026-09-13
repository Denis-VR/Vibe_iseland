import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
const limit = Number(process.argv[2] || 20);
if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw Error("Укажи число отчётов от 1 до 1000");
const db = new DatabaseSync(resolve(process.env.DATA_DIR || "data", "quiet-height.sqlite"), { readOnly: true });
console.log(JSON.stringify(db.prepare("SELECT id, at, data FROM device_reports ORDER BY at DESC LIMIT ?").all(limit).map(({id, at, data}) => ({id, at, ...JSON.parse(data)})), null, 2));
db.close();
