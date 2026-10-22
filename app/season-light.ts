import type { Season } from "./world.ts";
export function sceneAsset(weather: string, season: Season) {
  if (["spring", "autumn", "winter"].includes(weather)) return weather;
  return season === "summer" ? weather : season;
}
