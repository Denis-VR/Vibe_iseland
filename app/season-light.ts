import type { Season } from "./world.ts";
export function sceneAsset(weather: string, season: Season) {
  if (["spring", "autumn", "winter"].includes(weather)) return weather;
  return season === "summer" ? weather : season;
}
// Lighting is rendered into a transition frame, so the season never disappears at night.
export function lightSeason(image: HTMLImageElement, weather: string) {
  const surface = document.createElement("canvas");
  surface.width = image.naturalWidth;
  surface.height = image.naturalHeight;
  const ctx = surface.getContext("2d")!;
  const w = surface.width,
    h = surface.height;
  ctx.drawImage(image, 0, 0);
  const tint = (
    color: string,
    mode: GlobalCompositeOperation = "source-over",
  ) => {
    ctx.globalCompositeOperation = mode;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
  };
  if (weather === "night") {
    tint("#172d52", "multiply");
    tint("#08122688");
    // Stars stay in the open sky above the ridge; deterministic placement avoids flashing.
    let seed = 427;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 90; i++) {
      const x = rand() * w,
        y = rand() * h * 0.1,
        r = ((0.3 + rand() * 0.6) * w) / 1672;
      ctx.beginPath();
      ctx.fillStyle = `rgba(221,236,255,${0.25 + rand() * 0.6})`;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Warm windows at the lakeside settlement, never floating sky lanterns.
    for (const [x, y] of [
      [0.333, 0.716],
      [0.338, 0.716],
      [0.359, 0.714],
      [0.375, 0.715],
      [0.385, 0.716],
    ]) {
      const glow = ctx.createRadialGradient(
        x * w,
        y * h,
        0,
        x * w,
        y * h,
        w * 0.006,
      );
      glow.addColorStop(0, "#ffd78caf");
      glow.addColorStop(1, "#ffc26300");
      ctx.fillStyle = glow;
      ctx.fillRect((x - 0.007) * w, (y - 0.012) * h, 0.014 * w, 0.024 * h);
    }
  } else if (weather === "dawn" || weather === "sunset") {
    tint(weather === "dawn" ? "#98a9c7" : "#bea09b", "multiply");
    const x = weather === "dawn" ? w * 0.08 : w * 0.86;
    const sky = ctx.createRadialGradient(x, h * 0.26, 0, x, h * 0.26, w * 0.7);
    sky.addColorStop(0, weather === "dawn" ? "#ffc89970" : "#ffb26070");
    sky.addColorStop(1, "#f5b8bb00");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
  } else if (weather === "rain" || weather === "fog") {
    tint(weather === "rain" ? "#81929f" : "#bcc8cd", "multiply");
    const mist = ctx.createLinearGradient(0, 0, 0, h);
    mist.addColorStop(0, weather === "rain" ? "#81919dbb" : "#d6e1e4bb");
    mist.addColorStop(0.55, weather === "rain" ? "#94a5b755" : "#dae3e599");
    mist.addColorStop(1, "#a9bdcc00");
    ctx.fillStyle = mist;
    ctx.fillRect(0, 0, w, h);
  }
  return surface;
}
