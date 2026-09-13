export type SceneQuality = "auto" | "hd" | "uhd";
// Cap the backing store at 4K's pixel budget, including portrait displays.
export function sceneResolution(width: number, height: number, dpr: number, quality: SceneQuality) {
  if (width <= 0 || height <= 0) return { width: 1, height: 1 };
  const requested = quality === "uhd" ? 3840 / Math.max(width, height)
    : quality === "hd" ? 1920 / Math.max(width, height)
    : Math.max(1, dpr || 1);
  const scale = Math.min(requested, 3840 / Math.max(width, height), Math.sqrt(8294400 / (width * height)));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
