import { readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const scenes = ["sunset", "day", "dawn", "night", "rain", "fog", "winter", "spring", "autumn"];
const entries = scenes.map(scene => {
  const path = `public/scenes/uhd/${scene}.webp`;
  const info = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", path], {encoding:"utf8"})).streams[0];
  if (info.width !== 3840 || info.height !== 2160) throw Error(`Wrong resolution: ${scene}`);
  return {scene, ...info, bytes:statSync(path).size, sha256:createHash("sha256").update(readFileSync(path)).digest("hex"), originalSha256:createHash("sha256").update(readFileSync(`public/scenes/${scene}.webp`)).digest("hex")};
});
writeFileSync("public/scenes/uhd/manifest.json", JSON.stringify({method:"Real-ESRGAN x4plus → Lanczos 4K → WebP q92", entries}, null, 2));
console.log(`Verified ${entries.length} 4K scenes, ${(entries.reduce((n,e)=>n+e.bytes,0)/1048576).toFixed(1)} MiB total`);
