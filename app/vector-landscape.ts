// The valley is drawn from code, not loaded: sharp at any screen size and alive in motion.
// Static layers render once per size and scene; each frame only moves clouds, mist, water and particles.
import type { Season } from "./world.ts";

type RGB = [number, number, number];
export type Light = "dawn" | "day" | "fog" | "rain" | "sunset" | "night";

const hex = (s: string): RGB => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a: RGB, b: RGB): RGB => [(a[0] * b[0]) / 255, (a[1] * b[1]) / 255, (a[2] * b[2]) / 255];
const rgba = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function noise(seed: number) {
  const r = random(seed), table = Float32Array.from({ length: 1024 }, () => r() * 2 - 1);
  return (x: number) => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return table[i & 1023] + (table[(i + 1) & 1023] - table[i & 1023]) * u;
  };
}
function fbm(n: (x: number) => number, x: number, octaves = 4) {
  let sum = 0, amp = 0.5, f = 1;
  for (let i = 0; i < octaves; i++, amp *= 0.5, f *= 2.07) sum += amp * n(x * f + i * 17.3);
  return sum;
}

type LightPreset = {
  sky: [string, string, string];
  sun?: { x: number; y: number; r: number; color: string; glow: number; moon?: boolean };
  light: string; // multiplies lit surfaces
  shadow: string; // the side of the peaks turned away from the sun
  shadowAlpha: number;
  haze: string; // atmospheric perspective
  hazeAmount: number;
  cloud: { count: number; lit: string; shade: string; alpha: number };
  mist: number;
  windows: number;
  water: string;
  glitter?: string;
  stars?: boolean;
  rain?: boolean;
};
const lights: Record<Light, LightPreset> = {
  day: {
    sky: ["#3c6fb3", "#7eaedb", "#d5e4ee"], sun: { x: 0.16, y: 0.1, r: 0.026, color: "#fffbea", glow: 0.75 },
    light: "#ffffff", shadow: "#33476a", shadowAlpha: 0.42, haze: "#b9cfe2", hazeAmount: 0.5,
    cloud: { count: 7, lit: "#ffffff", shade: "#b7c5d6", alpha: 0.92 }, mist: 0.35, windows: 0, water: "#2a8796", glitter: "#fff8e8",
  },
  dawn: {
    sky: ["#2b3a66", "#a48dad", "#f6bf96"], sun: { x: 0.1, y: 0.37, r: 0.035, color: "#ffd8a6", glow: 0.9 },
    light: "#f0d4c6", shadow: "#3c3866", shadowAlpha: 0.5, haze: "#dcb6ad", hazeAmount: 0.62,
    cloud: { count: 6, lit: "#ffd0b8", shade: "#8b7ca3", alpha: 0.85 }, mist: 0.65, windows: 0.45, water: "#5f7898", glitter: "#ffcf9e",
  },
  sunset: {
    sky: ["#2f2d5c", "#c06a5d", "#f7ad52"], sun: { x: 0.82, y: 0.31, r: 0.04, color: "#ffd27e", glow: 1 },
    light: "#f6c29a", shadow: "#3f2a52", shadowAlpha: 0.55, haze: "#e3a383", hazeAmount: 0.58,
    cloud: { count: 7, lit: "#ffab6e", shade: "#71496c", alpha: 0.9 }, mist: 0.45, windows: 0.7, water: "#76586c", glitter: "#ffbb63",
  },
  night: {
    sky: ["#050a1a", "#0e1c3a", "#24385c"], sun: { x: 0.74, y: 0.1, r: 0.018, color: "#eef3ff", glow: 0.35, moon: true },
    light: "#7489b8", shadow: "#060a18", shadowAlpha: 0.6, haze: "#1d2c4d", hazeAmount: 0.5,
    cloud: { count: 4, lit: "#3c4d70", shade: "#141d33", alpha: 0.55 }, mist: 0.32, windows: 1, water: "#0c1830", glitter: "#cfdcff", stars: true,
  },
  fog: {
    sky: ["#97a5ae", "#b8c3c8", "#d5dcde"],
    light: "#c7cfd2", shadow: "#5a6873", shadowAlpha: 0.3, haze: "#cfd7da", hazeAmount: 0.86,
    cloud: { count: 9, lit: "#e3e8ea", shade: "#a7b2b9", alpha: 0.75 }, mist: 1, windows: 0.25, water: "#7b8f97",
  },
  rain: {
    sky: ["#46525f", "#6c7a86", "#96a3ab"],
    light: "#9eabb5", shadow: "#2c3742", shadowAlpha: 0.4, haze: "#8797a2", hazeAmount: 0.72,
    cloud: { count: 10, lit: "#9aa6b0", shade: "#4c5864", alpha: 0.9 }, mist: 0.7, windows: 0.55, water: "#3d535f", rain: true,
  },
};

type SeasonPreset = {
  pine: string; pineLight: string; hill: string; hillFar: string; grass: string; rock: string;
  leaves?: string[]; flowers?: string[]; snowLine: number; snowy?: boolean; lake: string;
};
const seasons: Record<Season, SeasonPreset> = {
  summer: { pine: "#1b3628", pineLight: "#2f5537", hill: "#3f6e3c", hillFar: "#4f7a55", grass: "#6c8b42", rock: "#6c6d72", snowLine: 0.42, lake: "#1f8a99" },
  spring: { pine: "#1e3a2b", pineLight: "#355d3a", hill: "#5a8d46", hillFar: "#5e8a5c", grass: "#86a854", rock: "#6e6f73", leaves: ["#8cbf5a", "#a7cf6d"], flowers: ["#f4c7d8", "#fff4e4", "#ecd46a", "#c9b4ef"], snowLine: 0.36, lake: "#2a96a0" },
  autumn: { pine: "#1f3729", pineLight: "#36553a", hill: "#7b7840", hillFar: "#6d7357", grass: "#a8874a", rock: "#6f6b66", leaves: ["#d79a35", "#c2652c", "#e6bb4b", "#a9472a"], snowLine: 0.3, lake: "#2b7f8a" },
  winter: { pine: "#1b302d", pineLight: "#2d4943", hill: "#dfe8ef", hillFar: "#d5e0e9", grass: "#e9eff4", rock: "#646a74", snowLine: 1, snowy: true, lake: "#8eb0c0" },
};

export function sceneParts(weather: string, season: Season): { light: Light; season: Season } {
  if (weather === "spring" || weather === "autumn" || weather === "winter") return { light: "day", season: weather };
  return { light: (weather in lights ? weather : "day") as Light, season };
}

// The painting is composed in a 16:9 world, one unit tall, and covers any screen.
const WORLD = 16 / 9, WATER = 0.665;
type Layer = HTMLCanvasElement;
type Cloud = { sprite: Layer; x: number; y: number; w: number; speed: number; alpha: number };
type Particle = { x: number; y: number; vx: number; vy: number; size: number; phase: number; color: string; spin: number };

export type Scene = {
  element: HTMLDivElement; // stacked canvases, composited by the browser
  tick(time: number): void; // moves clouds, mist, water and particles
  dispose(): void;
};

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function buildScene(width: number, height: number, weather: string, seasonName: Season): Scene {
  const { light: lightName, season: seasonKey } = sceneParts(weather, seasonName);
  const L = lights[lightName];
  // Snow keeps falling in winter even when the scene asks for rain.
  const S = seasons[seasonKey];
  const lit = hex(L.light), haze = hex(L.haze), shadow = hex(L.shadow);
  const aspect = width / height;
  // Cover: wide screens crop the sky and the foreground; tall ones keep the main peak in view.
  const scale = aspect > WORLD ? width / WORLD : height;
  const focusX = 1.08;
  const offsetX = aspect > WORLD ? 0 : Math.min(0, Math.max(width - WORLD * scale, width / 2 - focusX * scale));
  const offsetY = aspect > WORLD ? (height - scale) * 0.55 : 0;
  const view = { x0: -offsetX / scale, x1: (width - offsetX) / scale };
  const Y = (y: number) => offsetY + y * scale;
  const tone = (base: RGB, depth: number) => mix(mul(base, lit), haze, Math.min(1, depth * L.hazeAmount));

  function setWorld(ctx: CanvasRenderingContext2D, k = 1) {
    ctx.setTransform(scale * k, 0, 0, scale * k, offsetX * k, offsetY * k);
  }

  // ---- Sky with its stars, sun or moon ----
  const sky = canvas(width, height);
  {
    const ctx = sky.getContext("2d")!;
    setWorld(ctx);
    const g = ctx.createLinearGradient(0, -0.1, 0, WATER);
    g.addColorStop(0, L.sky[0]);
    g.addColorStop(0.55, L.sky[1]);
    g.addColorStop(1, L.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(view.x0 - 1, -1, view.x1 - view.x0 + 2, 3);
    if (L.sun) {
      const sx = view.x0 + (view.x1 - view.x0) * L.sun.x, sy = L.sun.y, c = hex(L.sun.color);
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 0.9);
      glow.addColorStop(0, rgba(c, 0.55 * L.sun.glow));
      glow.addColorStop(0.25, rgba(c, 0.18 * L.sun.glow));
      glow.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(view.x0 - 1, -1, view.x1 - view.x0 + 2, 3);
    }
    if (L.stars) {
      // A faint band of the Milky Way across the upper sky.
      const r = random(91);
      ctx.save();
      ctx.translate((view.x0 + view.x1) / 2 + 0.25, 0.05);
      ctx.rotate(-0.35);
      for (let i = 0; i < 70; i++) {
        const x = (r() - 0.5) * 2.4, y = (r() - 0.5) * 0.12 * (1 + r()), rad = 0.04 + r() * 0.08;
        const g2 = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g2.addColorStop(0, `rgba(178,190,240,${0.07 + r() * 0.06})`);
        g2.addColorStop(1, "rgba(170,185,235,0)");
        ctx.fillStyle = g2;
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      ctx.restore();
    }
  }
  const sunPos = L.sun ? { x: view.x0 + (view.x1 - view.x0) * L.sun.x, y: L.sun.y } : null;
  const area = view.x1 - view.x0;
  // Most stars are painted once; a few bright ones twinkle in the particle layer.
  const starRand = random(313);
  const twinkles: { x: number; y: number; r: number; a: number; tw: number; ph: number }[] = [];
  {
    const ctx = sky.getContext("2d")!;
    if (L.stars) for (let i = 0; i < Math.round(240 * area / WORLD); i++) {
      const st = { x: view.x0 + starRand() * area, y: starRand() * 0.42 * starRand() + starRand() * 0.04, r: 0.0006 + starRand() * starRand() * 0.0022, a: 0.35 + starRand() * 0.6, tw: 0.6 + starRand() * 1.8, ph: starRand() * 6.3 };
      if (i % 8 === 0) { twinkles.push(st); continue; }
      ctx.fillStyle = `rgba(226,236,255,${st.a})`;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (L.sun && sunPos) {
      const c = hex(L.sun.color);
      const halo = ctx.createRadialGradient(sunPos.x, sunPos.y, L.sun.r * 0.8, sunPos.x, sunPos.y, L.sun.r * (L.sun.moon ? 5 : 3.2));
      halo.addColorStop(0, L.sun.moon ? "rgba(220,230,255,0.18)" : rgba(c, 0.45));
      halo.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(sunPos.x - L.sun.r * 5, sunPos.y - L.sun.r * 5, L.sun.r * 10, L.sun.r * 10);
      if (L.sun.moon) {
        // A crescent: the disc minus an offset disc, cut on its own small canvas.
        const px = Math.ceil(L.sun.r * scale * 2) + 4, moon = canvas(px, px), m = moon.getContext("2d")!, rr = L.sun.r * scale;
        m.fillStyle = rgba(c, 0.96);
        m.beginPath();
        m.arc(px / 2, px / 2, rr, 0, Math.PI * 2);
        m.fill();
        m.globalCompositeOperation = "destination-out";
        m.beginPath();
        m.arc(px / 2 + rr * 0.48, px / 2 - rr * 0.22, rr * 0.86, 0, Math.PI * 2);
        m.fill();
        ctx.drawImage(moon, sunPos.x - px / 2 / scale, sunPos.y - px / 2 / scale, px / scale, px / scale);
      } else {
        ctx.fillStyle = rgba(c);
        ctx.beginPath();
        ctx.arc(sunPos.x, sunPos.y, L.sun.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  const sunLeft = !sunPos || sunPos.x < WORLD * 0.55;

  // ---- Mountains ----
  const ridge = (seed: number, base: number, peaks: [number, number, number][], rough: number, sharp = 1.25) => {
    const n = noise(seed), fine = noise(seed + 7), step = 1.5 / scale;
    const xs: number[] = [], ys: number[] = [];
    let top = base;
    for (const p of peaks) top = Math.min(top, p[1]);
    for (let x = Math.min(-0.15, view.x0 - 0.05); x <= Math.max(WORLD + 0.15, view.x1 + 0.05); x += step) {
      let h = 0;
      for (const [px, py, pw] of peaks) {
        const t = 1 - Math.abs(x - px) / pw;
        // sharp < 0.8 means a rounded wooded hill instead of a stone pyramid.
        if (t > 0) h = Math.max(h, (base - py) * (sharp < 0.8 ? 0.5 - 0.5 * Math.cos(Math.PI * t) : Math.pow(t, sharp)));
      }
      const height = h / Math.max(0.01, base - top);
      const y = base - h + fbm(n, x * 7) * rough * (0.35 + height) + fbm(fine, x * 60, 3) * rough * 0.18 * (0.2 + height);
      xs.push(x);
      ys.push(y);
    }
    return { xs, ys, base, top };
  };
  type Ridge = ReturnType<typeof ridge>;
  const trace = (ctx: CanvasRenderingContext2D, r: Ridge, bottom: number) => {
    ctx.beginPath();
    ctx.moveTo(r.xs[0], bottom);
    for (let i = 0; i < r.xs.length; i++) ctx.lineTo(r.xs[i], r.ys[i]);
    ctx.lineTo(r.xs[r.xs.length - 1], bottom);
    ctx.closePath();
  };

  function drawRange(ctx: CanvasRenderingContext2D, r: Ridge, depth: number, seed: number, snowLine: number) {
    const rand = random(seed), n = noise(seed + 3);
    const rock = tone(hex(S.rock), depth), rockLow = tone(mix(hex(S.rock), hex(S.hillFar), 0.55), depth + 0.12);
    const bottom = r.base + 0.25;
    const g = ctx.createLinearGradient(0, r.top, 0, r.base);
    g.addColorStop(0, rgba(rock));
    g.addColorStop(1, rgba(rockLow));
    trace(ctx, r, bottom);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    trace(ctx, r, bottom);
    ctx.clip();
    // Snow follows the ridge downwards, deeper on the high peaks, with a ragged lower edge.
    const snow = tone(hex(S.snowy ? "#f4f8fc" : "#f7f9fb"), depth * 0.8);
    const span = r.base - r.top;
    ctx.beginPath();
    for (let i = 0; i < r.xs.length; i++) ctx.lineTo(r.xs[i], r.ys[i]);
    for (let i = r.xs.length - 1; i >= 0; i--) {
      const height = Math.max(0, (r.base - r.ys[i]) / span);
      const depthSnow = span * snowLine * Math.pow(height, 1.6) * (0.75 + 0.5 * fbm(n, r.xs[i] * 9)) + Math.abs(fbm(n, r.xs[i] * 80, 2)) * 0.02 * height;
      ctx.lineTo(r.xs[i], r.ys[i] + depthSnow);
    }
    ctx.closePath();
    ctx.fillStyle = rgba(snow);
    ctx.fill();
    // Faces turned away from the light: one facet from every summit to the next valley.
    const sh = rgba(shadow, L.shadowAlpha * (1 - depth * 0.45));
    const peaks: number[] = [];
    const win = Math.max(3, Math.round(0.03 * scale / 1.5));
    for (let i = win; i < r.ys.length - win; i++) {
      let best = true;
      for (let k = -win; k <= win && best; k++) if (r.ys[i + k] < r.ys[i]) best = false;
      if (best && r.base - r.ys[i] > span * 0.18 && (!peaks.length || i - peaks[peaks.length - 1] > win)) peaks.push(i);
    }
    const dir = sunLeft ? 1 : -1;
    for (const [k, p] of peaks.entries()) {
      // The valley is the lowest point between this summit and the next one towards the shade.
      const next = peaks[k + dir] ?? (dir > 0 ? r.ys.length - 1 : 0);
      let v = p;
      for (let i = p; i !== next; i += dir) if (r.ys[i] > r.ys[v]) v = i;
      if (v === p) continue;
      const px = r.xs[p], py = r.ys[p], vx = r.xs[v], vy = r.ys[v];
      const kp = 0.2 + rand() * 0.25, kv = 0.55 + rand() * 0.4;
      const meet = Math.min(bottom, (dir * (vx - px) + kp * py + kv * vy) / (kp + kv));
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (let i = p; i !== v; i += dir) ctx.lineTo(r.xs[i], r.ys[i]);
      ctx.lineTo(vx, vy);
      for (let y = vy; y < meet; y += 0.01) ctx.lineTo(vx - dir * kv * (y - vy) + fbm(n, y * 40 + vx) * 0.006, y);
      for (let y = meet; y > py; y -= 0.01) ctx.lineTo(px + dir * kp * (y - py) + fbm(n, y * 40 + px) * 0.008, y);
      ctx.closePath();
      ctx.fillStyle = sh;
      ctx.fill();
    }
    // Couloirs and ribs give the stone some structure.
    ctx.lineCap = "round";
    for (let i = 0; i < r.xs.length; i += Math.max(1, Math.round(win * 0.7))) {
      const height = (r.base - r.ys[i]) / span;
      if (height < 0.2 || rand() > 0.35) continue;
      const len = span * (0.08 + rand() * 0.22) * height;
      ctx.beginPath();
      ctx.moveTo(r.xs[i], r.ys[i] + 0.003);
      ctx.quadraticCurveTo(r.xs[i] + dir * len * 0.15, r.ys[i] + len * 0.5, r.xs[i] + dir * len * (0.2 + rand() * 0.2), r.ys[i] + len);
      ctx.lineWidth = 0.0012 + rand() * 0.0018;
      ctx.strokeStyle = rgba(shadow, 0.08 + rand() * 0.08);
      ctx.stroke();
    }
    // Smaller spurs in shade and snow streaks running down the gullies.
    for (let j = 0; j < 70; j++) {
      const i = Math.floor(rand() * r.xs.length), x = r.xs[i], y = r.ys[i];
      const height = (r.base - y) / span;
      if (height < 0.3) continue;
      const len = span * (0.12 + rand() * 0.3) * height;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dir * len * (0.35 + rand() * 0.3), y + len);
      ctx.lineTo(x + dir * len * 0.08, y + len * 0.85);
      ctx.closePath();
      ctx.fillStyle = rgba(shadow, L.shadowAlpha * 0.35 * (1 - depth * 0.5));
      ctx.fill();
    }
    // Haze pools at the foot of each range.
    const fog = ctx.createLinearGradient(0, r.base - span * 0.45, 0, r.base + 0.02);
    fog.addColorStop(0, rgba(haze, 0));
    fog.addColorStop(1, rgba(haze, 0.55 + L.mist * 0.35));
    ctx.fillStyle = fog;
    ctx.fillRect(view.x0 - 1, r.base - span * 0.45, view.x1 - view.x0 + 2, span + 0.3);
    ctx.restore();
    // A thin rim of light along the summits.
    if (L.sun && !L.sun.moon) {
      ctx.beginPath();
      for (let i = 0; i < r.xs.length; i++) ctx.lineTo(r.xs[i], r.ys[i]);
      ctx.lineWidth = 0.0016;
      ctx.strokeStyle = rgba(hex(L.sun.color), 0.22 * (1 - depth));
      ctx.stroke();
    }
  }

  const pine = (ctx: CanvasRenderingContext2D, x: number, y: number, h: number, color: string, side: string, snow: boolean, rand: () => number) => {
    const w = h * (0.26 + rand() * 0.08), tiers = 4;
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    for (let t = 1; t <= tiers; t++) {
      const ty = y - h + (h * 0.92 * t) / tiers, tw = (w * (0.35 + 0.65 * t / tiers)) / 2;
      ctx.lineTo(x + tw, ty);
      if (t < tiers) ctx.lineTo(x + tw * 0.45, ty - h * 0.03);
    }
    for (let t = tiers; t >= 1; t--) {
      const ty = y - h + (h * 0.92 * t) / tiers, tw = (w * (0.35 + 0.65 * t / tiers)) / 2;
      if (t < tiers) ctx.lineTo(x - tw * 0.45, ty - h * 0.03);
      ctx.lineTo(x - tw, ty);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    // The lit half of the crown.
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    const s = sunLeft ? -1 : 1;
    for (let t = 1; t <= tiers; t++) {
      const ty = y - h + (h * 0.92 * t) / tiers, tw = (w * (0.35 + 0.65 * t / tiers)) / 2;
      ctx.lineTo(x + s * tw, ty);
      ctx.lineTo(x + s * tw * 0.2, ty - h * 0.02);
    }
    ctx.lineTo(x, y - h * 0.1);
    ctx.closePath();
    ctx.fillStyle = side;
    ctx.fill();
    if (snow) {
      ctx.fillStyle = "rgba(240,246,250,0.85)";
      for (let t = 1; t <= tiers; t++) {
        const ty = y - h + (h * 0.92 * t) / tiers, tw = (w * (0.35 + 0.65 * t / tiers)) / 2;
        ctx.beginPath();
        ctx.moveTo(x - tw * 0.7, ty - h * 0.02);
        ctx.quadraticCurveTo(x, ty - h * 0.12, x + tw * 0.7, ty - h * 0.02);
        ctx.quadraticCurveTo(x, ty - h * 0.06, x - tw * 0.7, ty - h * 0.02);
        ctx.fill();
      }
    }
  };
  const broadleaf = (ctx: CanvasRenderingContext2D, x: number, y: number, h: number, color: string, rand: () => number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const cx = x + (rand() - 0.5) * h * 0.35, cy = y - h * (0.45 + rand() * 0.3), r = h * (0.18 + rand() * 0.12);
      ctx.moveTo(cx + r, cy);
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
    ctx.fill();
  };
  function forest(ctx: CanvasRenderingContext2D, r: Ridge, band: number, size: number, density: number, depth: number, seed: number, floor = 1) {
    const rand = random(seed);
    const trees: [number, number, number][] = [];
    const count = Math.round((r.xs[r.xs.length - 1] - r.xs[0]) * density);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(rand() * r.xs.length), x = r.xs[idx], y = r.ys[idx] + rand() * band;
      if (y > floor) continue;
      trees.push([x, y, size * (0.6 + rand() * 0.7)]);
    }
    trees.sort((a, b) => a[1] - b[1]);
    const dark = rgba(tone(hex(S.pine), depth)), light = rgba(tone(hex(S.pineLight), depth));
    const leaves = S.leaves?.map((c) => rgba(tone(hex(c), depth)));
    for (const [x, y, h] of trees) {
      if (leaves && rand() < 0.3) broadleaf(ctx, x, y, h * 0.8, leaves[Math.floor(rand() * leaves.length)], rand);
      else pine(ctx, x, y, h, dark, light, !!S.snowy && depth < 0.5, rand);
    }
  }
  function hill(ctx: CanvasRenderingContext2D, r: Ridge, depth: number, color: string, bottom = WATER + 0.002) {
    const c = tone(hex(color), depth);
    const g = ctx.createLinearGradient(0, r.top, 0, bottom);
    g.addColorStop(0, rgba(mix(c, [255, 255, 255], S.snowy ? 0.15 : 0.06)));
    g.addColorStop(1, rgba(mix(c, [0, 0, 0], 0.28)));
    trace(ctx, r, bottom);
    ctx.fillStyle = g;
    ctx.fill();
  }

  const mountains = canvas(width, height);
  {
    const ctx = mountains.getContext("2d")!;
    setWorld(ctx);
    const far = ridge(11, 0.42, [[-0.1, 0.25, 0.26], [0.18, 0.22, 0.25], [0.46, 0.25, 0.22], [0.72, 0.21, 0.24], [0.95, 0.24, 0.2], [1.36, 0.2, 0.24], [1.6, 0.22, 0.24], [1.86, 0.24, 0.24]], 0.03, 1.05);
    drawRange(ctx, far, 0.85, 21, Math.min(1, S.snowLine * 1.4));
    const main = ridge(5, 0.5, [[-0.06, 0.19, 0.26], [0.2, 0.21, 0.22], [0.44, 0.235, 0.2], [0.66, 0.27, 0.16], [0.88, 0.205, 0.2], [1.13, 0.085, 0.34], [1.37, 0.19, 0.2], [1.6, 0.235, 0.22], [1.86, 0.26, 0.2]], 0.045, 1.08);
    drawRange(ctx, main, 0.38, 37, S.snowLine);
  }

  // ---- Valley: green ridges, forest, the shore and the village ----
  const valley = canvas(width, height);
  const cabins: { x: number; y: number; w: number }[] = [];
  {
    const ctx = valley.getContext("2d")!;
    setWorld(ctx);
    ctx.save();
    ctx.beginPath();
    ctx.rect(view.x0 - 1, -1, view.x1 - view.x0 + 2, WATER + 1.002);
    ctx.clip();
    const green = ridge(17, 0.64, [[-0.08, 0.37, 0.42], [0.24, 0.41, 0.4], [0.6, 0.47, 0.34], [0.9, 0.485, 0.3], [1.1, 0.45, 0.36], [1.38, 0.47, 0.3], [1.64, 0.42, 0.4], [1.9, 0.39, 0.34]], 0.035, 1);
    hill(ctx, green, 0.45, S.hillFar);
    forest(ctx, green, 0.2, 0.022, 900, 0.45, 3);
    const near = ridge(23, 0.7, [[0.3, 0.545, 0.42], [0.66, 0.57, 0.34], [0.98, 0.525, 0.4], [1.28, 0.575, 0.3], [1.55, 0.535, 0.38], [-0.05, 0.5, 0.36]], 0.025, 1);
    hill(ctx, near, 0.18, S.hill);
    forest(ctx, near, 0.12, 0.034, 1100, 0.18, 9);
    ctx.restore();
    // The shore with the village pushes out into the lake.
    const shore = tone(hex(S.snowy ? "#d9e3ea" : S.grass), 0.12).map((v, i) => v * 0.72 + hex(S.pine)[i] * 0.28) as RGB;
    ctx.beginPath();
    ctx.moveTo(0.2, WATER - 0.01);
    ctx.bezierCurveTo(0.35, WATER + 0.004, 0.52, WATER + 0.046, 0.68, WATER + 0.04);
    ctx.bezierCurveTo(0.73, WATER + 0.036, 0.76, WATER + 0.016, 0.8, WATER);
    ctx.lineTo(0.8, WATER - 0.02);
    ctx.closePath();
    ctx.fillStyle = rgba(shore);
    ctx.fill();
    ctx.strokeStyle = rgba(mix(shore, [0, 0, 0], 0.4), 0.7);
    ctx.lineWidth = 0.002;
    ctx.beginPath();
    ctx.moveTo(0.2, WATER);
    ctx.bezierCurveTo(0.35, WATER + 0.006, 0.52, WATER + 0.048, 0.68, WATER + 0.042);
    ctx.bezierCurveTo(0.73, WATER + 0.038, 0.76, WATER + 0.018, 0.8, WATER + 0.002);
    ctx.stroke();
    const rand = random(44);
    for (const [x, w] of [[0.5, 0.016], [0.535, 0.012], [0.565, 0.018], [0.6, 0.013], [0.63, 0.016], [0.665, 0.011]] as const) {
      const y = WATER + 0.03 + Math.sin((x - 0.5) * 9) * 0.006;
      cabins.push({ x, y, w });
      const wall = tone(hex("#8a5a3a"), 0.1), roof = tone(hex(S.snowy ? "#eef3f7" : "#5b3b2d"), 0.1);
      ctx.fillStyle = rgba(wall);
      ctx.fillRect(x - w / 2, y - w * 0.55, w, w * 0.55);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.62, y - w * 0.5);
      ctx.lineTo(x, y - w * 0.95);
      ctx.lineTo(x + w * 0.62, y - w * 0.5);
      ctx.closePath();
      ctx.fillStyle = rgba(roof);
      ctx.fill();
      ctx.fillStyle = rgba(mix(wall, [0, 0, 0], 0.5));
      ctx.fillRect(x + w * 0.22, y - w * 1.0, w * 0.12, w * 0.28);
    }
    for (let i = 0; i < 26; i++) {
      const x = 0.24 + rand() * 0.52, y = WATER + 0.01 + rand() * 0.02;
      if (cabins.some((c) => Math.abs(c.x - x) < c.w)) continue;
      pine(ctx, x, y + 0.012, 0.03 + rand() * 0.03, rgba(tone(hex(S.pine), 0.1)), rgba(tone(hex(S.pineLight), 0.1)), !!S.snowy, rand);
    }
    // A small wooded islet.
    ctx.beginPath();
    ctx.ellipse(0.79, WATER + 0.012, 0.05, 0.007, 0, 0, Math.PI * 2);
    ctx.fillStyle = rgba(tone(hex(S.snowy ? "#d9e3ea" : S.hill), 0.15));
    ctx.fill();
    for (let i = 0; i < 9; i++) pine(ctx, 0.75 + rand() * 0.08, WATER + 0.013, 0.015 + rand() * 0.02, rgba(tone(hex(S.pine), 0.15)), rgba(tone(hex(S.pineLight), 0.15)), !!S.snowy, rand);
  }

  // ---- Foreground: tall pines, the rock and the hiker ----
  const front = canvas(width, height);
  const hiker = { x: 1.535, y: 0.628 };
  {
    const ctx = front.getContext("2d")!;
    setWorld(ctx);
    const rand = random(71);
    const dark = rgba(tone(hex(S.pine), 0)), light = rgba(tone(hex(S.pineLight), 0));
    const near = tone(hex(S.pine), 0);
    // Right outcrop.
    const rock = tone(hex(S.rock), 0);
    for (let i = 0; i < 12; i++) pine(ctx, 1.62 + rand() * 0.3, 0.72 + rand() * 0.03, 0.18 + rand() * 0.16, dark, light, !!S.snowy, rand);
    // A granite outcrop: steep towards the lake, stepping down to the right.
    const outline: [number, number][] = [[1.42, 1.08], [1.44, 0.86], [1.46, 0.76], [1.48, 0.69], [1.505, 0.648], [1.53, 0.634], [1.565, 0.631], [1.6, 0.64], [1.63, 0.658], [1.66, 0.663], [1.7, 0.69], [1.74, 0.704], [1.79, 0.732], [1.84, 0.748], [1.9, 0.768], [1.98, 0.79], [1.98, 1.08]];
    const rn = noise(5);
    const rockPath = () => {
      ctx.beginPath();
      outline.forEach(([x, y], i) => {
        if (!i) return ctx.moveTo(x, y);
        const [x0, y0] = outline[i - 1];
        for (let t = 0.25; t <= 1; t += 0.25) ctx.lineTo(x0 + (x - x0) * t + rn((x0 + t) * 50) * 0.003, y0 + (y - y0) * t + rn((y0 + t) * 50) * 0.003);
      });
      ctx.closePath();
    };
    rockPath();
    const rg = ctx.createLinearGradient(1.5, 0.63, 1.62, 1.02);
    rg.addColorStop(0, rgba(mix(rock, [255, 255, 255], 0.08)));
    rg.addColorStop(0.5, rgba(mix(rock, [0, 0, 0], 0.25)));
    rg.addColorStop(1, rgba(mix(rock, [0, 0, 0], 0.55)));
    ctx.fillStyle = rg;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // Light catches the upper edge; planes facing away fall into shade.
    ctx.beginPath();
    outline.slice(1, -1).forEach(([x, y], i) => (i ? ctx.lineTo(x, y + 0.004) : ctx.moveTo(x, y + 0.004)));
    ctx.lineWidth = 0.022;
    ctx.lineJoin = "round";
    ctx.strokeStyle = rgba(S.snowy ? [236, 243, 248] : mix(mix(rock, lit, 0.3), [255, 255, 255], 0.22), S.snowy ? 0.95 : 0.55);
    ctx.stroke();
    ctx.lineWidth = 0.0014;
    ctx.strokeStyle = rgba(mix(rock, [0, 0, 0], 0.6), 0.5);
    for (let c = 0; c < 9; c++) {
      const x = 1.46 + rand() * 0.48, y = 0.66 + rand() * 0.12;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + (rand() - 0.5) * 0.02, y + 0.06, x + (rand() - 0.5) * 0.03, y + 0.1 + rand() * 0.15);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.save();
    if (S.snowy) {
      ctx.fillStyle = "rgba(238,244,249,0.9)";
      ctx.beginPath();
      ctx.moveTo(1.47, 0.705);
      ctx.quadraticCurveTo(1.54, 0.61, 1.72, 0.705);
      ctx.quadraticCurveTo(1.6, 0.66, 1.47, 0.705);
      ctx.fill();
    }
    ctx.restore();
    // The hiker, looking at the valley.
    {
      const { x, y } = hiker, k = 0.078;
      const body = rgba(mix(mul(hex("#2b3440"), lit), [0, 0, 0], 0.2));
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(x - k * 0.1, y);
      ctx.lineTo(x - k * 0.08, y - k * 0.45);
      ctx.lineTo(x - k * 0.13, y - k * 0.78);
      ctx.quadraticCurveTo(x, y - k * 0.86, x + k * 0.13, y - k * 0.78);
      ctx.lineTo(x + k * 0.08, y - k * 0.45);
      ctx.lineTo(x + k * 0.1, y);
      ctx.lineTo(x + k * 0.03, y);
      ctx.lineTo(x, y - k * 0.38);
      ctx.lineTo(x - k * 0.03, y);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y - k * 0.9, k * 0.075, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y - k * 0.975, k * 0.12, k * 0.025, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba(mul(hex("#6b5338"), lit));
      ctx.beginPath();
      ctx.roundRect(x - k * 0.11, y - k * 0.8, k * 0.22, k * 0.32, k * 0.05);
      ctx.fill();
      if (L.sun && !L.sun.moon) {
        ctx.fillStyle = rgba(hex(L.sun.color), 0.35);
        const s = sunLeft ? -1 : 1;
        ctx.fillRect(x + s * k * 0.12 - (s > 0 ? k * 0.02 : 0), y - k * 0.78, k * 0.02, k * 0.36);
      }
    }
    // Left forest edge and the near shore line.
    const left: [number, number, number][] = [];
    for (let i = 0; i < 22; i++) left.push([-0.08 + Math.pow(rand(), 1.4) * 0.5, 0.78 + rand() * 0.3, 0.28 + rand() * 0.34]);
    for (let i = 0; i < 14; i++) left.push([(i % 2 ? 0.3 + rand() * 0.3 : 1.05 + rand() * 0.35), 1.0 + rand() * 0.08, 0.08 + rand() * 0.16]);
    left.sort((a, b) => a[1] - b[1]);
    for (const [x, y, h] of left) pine(ctx, x, y, h, dark, light, !!S.snowy, rand);
    // Ground along the bottom edge.
    ctx.beginPath();
    ctx.moveTo(view.x0 - 0.1, 1.2);
    ctx.lineTo(view.x0 - 0.1, 0.97);
    for (let x = view.x0 - 0.1; x < view.x1 + 0.1; x += 0.02) ctx.lineTo(x, 0.975 + Math.sin(x * 9) * 0.012 + Math.sin(x * 23) * 0.006);
    ctx.lineTo(view.x1 + 0.1, 1.2);
    ctx.closePath();
    ctx.fillStyle = rgba(mix(near, hex(S.snowy ? "#e6edf2" : S.grass), S.snowy ? 0.85 : 0.35));
    ctx.fill();
    if (S.flowers) for (let i = 0; i < 70; i++) {
      ctx.fillStyle = S.flowers[i % S.flowers.length];
      ctx.beginPath();
      ctx.arc(view.x0 + rand() * (view.x1 - view.x0), 0.985 + rand() * 0.04, 0.0025 + rand() * 0.002, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- Reflection (half resolution, softened by the ripples) ----
  const reflection = canvas(width / 2, height / 2);
  {
    const ctx = reflection.getContext("2d")!;
    const yW = Y(WATER) / 2;
    ctx.save();
    ctx.translate(0, yW * 2);
    ctx.scale(1, -1);
    ctx.drawImage(sky, 0, 0, width / 2, height / 2);
    ctx.drawImage(mountains, 0, 0, width / 2, height / 2);
    ctx.drawImage(valley, 0, 0, width / 2, height / 2);
    ctx.restore();
    const water = mix(mul(hex(S.lake), lit), hex(L.water), 0.5);
    const g = ctx.createLinearGradient(0, yW, 0, height / 2);
    g.addColorStop(0, rgba(water, S.snowy ? 0.5 : 0.28));
    g.addColorStop(1, rgba(mix(water, [0, 0, 0], 0.35), S.snowy ? 0.8 : 0.75));
    ctx.fillStyle = g;
    ctx.fillRect(0, yW, width / 2, height / 2 - yW);
  }

  // ---- Moving parts ----
  const rand = random(Date.now() & 0xffff);
  const clouds: Cloud[] = [];
  const cloudSprite = (w: number, seed: number) => {
    const r = random(seed), px = Math.max(40, Math.round(w * scale)), c = canvas(px, px * 0.5), ctx = c.getContext("2d")!;
    const litC = hex(L.cloud.lit), shadeC = hex(L.cloud.shade), H = c.height;
    // Puffs stay inside the sprite so no edge is ever cut.
    const puffs: [number, number, number][] = [];
    for (let i = 0; i < 22; i++) {
      const t = 0.08 + r() * 0.84, bulge = Math.sin(t * Math.PI);
      const rad = H * (0.12 + bulge * 0.2 * (0.6 + r() * 0.5));
      const y = Math.min(H - rad, Math.max(rad, H * (0.66 - bulge * 0.22 * r())));
      puffs.push([Math.min(px - rad, Math.max(rad, px * t)), y, rad]);
    }
    for (const [color, dy, a] of [[shadeC, 0.04, 0.8], [litC, -0.03, 0.85]] as const) {
      for (const [x, y, rad] of puffs) {
        const cy = Math.min(H - rad, Math.max(rad, y + dy * H));
        const g = ctx.createRadialGradient(x, cy, 0, x, cy, rad);
        g.addColorStop(0, rgba(color, a));
        g.addColorStop(0.5, rgba(color, a * 0.55));
        g.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - rad, cy - rad, rad * 2, rad * 2);
      }
    }
    return c;
  };
  for (let i = 0; i < L.cloud.count; i++) {
    const w = 0.35 + rand() * 0.45;
    clouds.push({ sprite: cloudSprite(w, 100 + i * 13), x: view.x0 - 0.4 + rand() * (view.x1 - view.x0 + 0.8), y: 0.02 + rand() * 0.24, w, speed: 0.0025 + rand() * 0.003, alpha: L.cloud.alpha * (0.6 + rand() * 0.4) });
  }
  // Long soft bands of valley mist.
  const mistSprite = (() => {
    const c = canvas(Math.max(64, scale * 0.9), Math.max(16, scale * 0.1)), ctx = c.getContext("2d")!;
    const m = mix(haze, [255, 255, 255], lightName === "night" ? 0.1 : 0.45), h = c.height;
    ctx.scale(4, 1);
    for (let i = 0; i < 14; i++) {
      const x = (c.width / 4) * (0.22 + (i / 13) * 0.56), y = h * (0.5 + Math.sin(i * 1.7) * 0.06), r = h * (0.3 + (i % 3) * 0.06);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(m, 0.45));
      g.addColorStop(1, rgba(m, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return c;
  })();
  const mists = Array.from({ length: Math.round(3 + L.mist * 5) }, (_, i) => ({ x: view.x0 - 0.5 + rand() * (view.x1 - view.x0 + 1), y: [0.4, 0.47, 0.55, 0.6][i % 4] + rand() * 0.03, speed: (0.004 + rand() * 0.004) * (i % 2 ? 1 : -1), alpha: (0.25 + rand() * 0.35) * (0.4 + L.mist * 0.6) }));
  const lakeMist = lightName === "fog" || lightName === "dawn" || lightName === "rain" ? Math.round(2 + L.mist * 3) : 0;
  for (let i = 0; i < lakeMist; i++) mists.push({ x: view.x0 - 0.5 + rand() * (view.x1 - view.x0 + 1), y: WATER - 0.03 + rand() * 0.08, speed: 0.006 * (i % 2 ? 1 : -1), alpha: 0.3 + L.mist * 0.3 });

  const particles: Particle[] = [];
  let kind: "rain" | "snow" | "leaves" | "petals" | "fireflies" | null = null;
  if (L.rain) kind = S.snowy ? "snow" : "rain";
  else if (S.snowy) kind = "snow";
  else if (lightName === "night" && (seasonKey === "summer" || seasonKey === "spring")) kind = "fireflies";
  else if (seasonKey === "autumn") kind = "leaves";
  else if (seasonKey === "spring") kind = "petals";
  const count = kind === "rain" ? 260 : kind === "snow" ? (L.rain ? 260 : 150) : kind === "fireflies" ? 26 : kind === "leaves" ? 16 : kind === "petals" ? 18 : 0;
  const palette = kind === "leaves" ? S.leaves! : kind === "petals" ? ["#f6d3df", "#fff3ea", "#f1bfd1"] : ["#fff"];
  for (let i = 0; i < Math.round(count * Math.min(1.6, area / WORLD)); i++) {
    particles.push({
      x: view.x0 + rand() * area, y: rand(),
      vx: kind === "rain" ? -0.08 : kind === "snow" ? -0.004 : 0.02 + rand() * 0.02,
      vy: kind === "rain" ? 1.3 + rand() * 0.5 : kind === "snow" ? 0.03 + rand() * 0.05 : kind === "fireflies" ? 0 : 0.03 + rand() * 0.03,
      size: kind === "rain" ? 0.012 + rand() * 0.02 : kind === "snow" ? 0.0012 + rand() * 0.0028 : 0.003 + rand() * 0.003,
      phase: rand() * Math.PI * 2, color: palette[i % palette.length], spin: (rand() - 0.5) * 3,
    });
  }
  if (kind === "fireflies") for (const p of particles) { p.x = 0.2 + rand() * 1.4; p.y = 0.7 + rand() * 0.28; }
  const birds = (lightName === "day" || lightName === "dawn") && !S.snowy ? Array.from({ length: 3 }, (_, i) => ({ x: view.x0 + rand() * area, y: 0.18 + rand() * 0.12, speed: 0.012 + rand() * 0.006, phase: i * 1.7 })) : [];
  const smoke = L.windows > 0.3 || S.snowy || seasonKey === "autumn";
  let shooting = { start: 6 + rand() * 20, x: 0, y: 0 };
  const ripples: { x: number; y: number; t: number }[] = [];

  // Static layers stay untouched; the browser composites them. Soft moving layers run at half resolution.
  const stack = document.createElement("div");
  stack.className = "landscape-scene";
  const layer = (c: Layer) => (stack.appendChild(c), c);
  const dynamic = (half = true) => {
    const c = layer(canvas(half ? width / 2 : width, half ? height / 2 : height));
    const ctx = c.getContext("2d")!;
    return { c, ctx, k: half ? 0.5 : 1 };
  };
  layer(sky);
  const cloudLayer = dynamic();
  layer(mountains);
  const mistLayer = mists.some((m) => m.y <= WATER - 0.04) ? dynamic() : null;
  const waterLayer = dynamic();
  layer(valley);
  const villageLayer = dynamic();
  layer(front);
  const particleLayer = kind || L.stars ? dynamic() : null;
  const lakeTop = Math.floor(Y(WATER) / 2);

  const moveMist = (m: { x: number; speed: number }, dt: number) => {
    m.x += m.speed * dt;
    if (m.x > view.x1 + 0.1) m.x = view.x0 - 1;
    if (m.x < view.x0 - 1) m.x = view.x1 + 0.1;
  };
  const clear = (l: { c: Layer; ctx: CanvasRenderingContext2D; k: number }, from = 0) => {
    l.ctx.setTransform(1, 0, 0, 1, 0, 0);
    l.ctx.clearRect(0, from, l.c.width, l.c.height - from);
    setWorld(l.ctx, l.k);
  };

  let last = -1;
  function tick(time: number) {
    const t = time / 1000, dt = last < 0 ? 0 : Math.min(0.1, t - last);
    last = t;
    // Clouds and birds.
    {
      const l = cloudLayer, ctx = l.ctx;
      clear(l);
      for (const c of clouds) {
        c.x += c.speed * dt;
        if (c.x > view.x1 + 0.1) c.x = view.x0 - c.w - 0.1;
        ctx.globalAlpha = c.alpha;
        ctx.drawImage(c.sprite, c.x, c.y, c.w, c.w * 0.5);
      }
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = "#2b3644";
      ctx.lineWidth = 0.0013;
      for (const b of birds) {
        b.x += b.speed * dt;
        if (b.x > view.x1 + 0.05) b.x = view.x0 - 0.05;
        const flap = Math.sin(t * 5 + b.phase) * 0.004, y = b.y + Math.sin(t * 0.4 + b.phase) * 0.01;
        ctx.beginPath();
        ctx.moveTo(b.x - 0.008, y - flap);
        ctx.quadraticCurveTo(b.x - 0.003, y - 0.003, b.x, y);
        ctx.quadraticCurveTo(b.x + 0.003, y - 0.003, b.x + 0.008, y - flap);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    const mistH = 0.1;
    if (mistLayer) {
      const ctx = mistLayer.ctx;
      clear(mistLayer);
      for (const m of mists) {
        if (m.y > WATER - 0.04) continue;
        moveMist(m, dt);
        ctx.globalAlpha = m.alpha * (0.85 + 0.15 * Math.sin(t * 0.2 + m.y * 40));
        ctx.drawImage(mistSprite, m.x, m.y - mistH / 2, 0.9, mistH);
      }
      ctx.globalAlpha = 1;
    }
    // Water: the mirrored valley, broken into gently moving rows.
    {
      const l = waterLayer, ctx = l.ctx, h = l.c.height, w = l.c.width;
      clear(l, lakeTop);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const rows = Math.max(1, Math.round(h / 300)), unit = h / 450;
      for (let y = lakeTop; y < h; y += rows) {
        const depth = (y - lakeTop) / Math.max(1, h - lakeTop);
        const wave = Math.sin((y * 0.09) / rows + t * 1.1) * (1 + depth * 5) * unit + Math.sin(y * 0.062 + t * 0.6) * depth * 3 * unit;
        ctx.drawImage(reflection, 0, y, w, rows, wave, y, w, rows);
      }
      setWorld(ctx, l.k);
      if (L.glitter && sunPos) {
        const g = hex(L.glitter), rr = random(Math.floor(t * 3));
        for (let i = 0; i < 60; i++) {
          const d = rr(), y = WATER + 0.005 + d * d * 0.3, spread = 0.02 + d * 0.12;
          ctx.fillStyle = rgba(g, (0.15 + rr() * 0.5) * (1 - d) * (L.sun?.moon ? 0.9 : 0.7));
          ctx.fillRect(sunPos.x + (rr() - 0.5) * spread * 2, y, 0.004 + rr() * 0.012 * (1 + d), 0.0014);
        }
      }
      if (kind === "rain") {
        if (rand() < dt * 14) ripples.push({ x: view.x0 + rand() * area, y: WATER + 0.01 + rand() * 0.3, t });
        ctx.lineWidth = 0.0012;
        for (let i = ripples.length - 1; i >= 0; i--) {
          const r = ripples[i], age = (t - r.t) / 1.2;
          if (age > 1) { ripples.splice(i, 1); continue; }
          ctx.strokeStyle = `rgba(210,225,235,${0.35 * (1 - age)})`;
          ctx.beginPath();
          ctx.ellipse(r.x, r.y, 0.002 + age * 0.012, 0.0006 + age * 0.003, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    // Lit windows, chimney smoke and mist over the lake.
    {
      const ctx = villageLayer.ctx;
      clear(villageLayer);
      if (L.windows > 0) for (const [i, c] of cabins.entries()) {
        const a = L.windows * (0.85 + 0.15 * Math.sin(t * 2.3 + i * 1.9));
        const glow = ctx.createRadialGradient(c.x, c.y - c.w * 0.25, 0, c.x, c.y - c.w * 0.25, c.w * 1.6);
        glow.addColorStop(0, `rgba(255,200,120,${0.45 * a})`);
        glow.addColorStop(1, "rgba(255,190,110,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(c.x - c.w * 1.6, c.y - c.w * 1.9, c.w * 3.2, c.w * 3.2);
        ctx.fillStyle = `rgba(255,214,140,${0.95 * a})`;
        ctx.fillRect(c.x - c.w * 0.3, c.y - c.w * 0.38, c.w * 0.18, c.w * 0.16);
        ctx.fillRect(c.x + c.w * 0.08, c.y - c.w * 0.38, c.w * 0.18, c.w * 0.16);
        ctx.fillStyle = `rgba(255,200,120,${0.22 * a})`;
        ctx.fillRect(c.x - c.w * 0.25, c.y + 0.012, c.w * 0.5, 0.01 + 0.004 * Math.sin(t * 2 + i));
      }
      if (smoke) for (const [i, c] of cabins.entries()) {
        if (i % 2) continue;
        for (let k = 0; k < 6; k++) {
          const p = (t * 0.12 + k / 6 + i * 0.13) % 1;
          ctx.fillStyle = `rgba(220,226,232,${0.22 * (1 - p)})`;
          ctx.beginPath();
          ctx.arc(c.x + c.w * 0.28 + Math.sin(p * 5 + i) * 0.004 + p * 0.02, c.y - c.w - p * 0.07, 0.002 + p * 0.007, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      for (const m of mists) {
        if (m.y <= WATER - 0.04) continue;
        moveMist(m, dt);
        ctx.globalAlpha = m.alpha;
        ctx.drawImage(mistSprite, m.x, m.y - mistH / 2, 0.9, mistH);
      }
      ctx.globalAlpha = 1;
    }
    if (particleLayer) {
      const ctx = particleLayer.ctx;
      clear(particleLayer);
      for (const s of twinkles) {
        ctx.fillStyle = `rgba(232,240,255,${s.a * (0.55 + 0.45 * Math.sin(t * s.tw + s.ph))})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (L.stars && t > shooting.start) {
        const p = (t - shooting.start) / 0.9;
        if (shooting.x === 0) { shooting.x = view.x0 + rand() * area * 0.7; shooting.y = 0.04 + rand() * 0.12; }
        if (p >= 1) shooting = { start: t + 18 + rand() * 30, x: 0, y: 0 };
        else {
          const x = shooting.x + p * 0.28, y = shooting.y + p * 0.1;
          const g = ctx.createLinearGradient(x - 0.08, y - 0.03, x, y);
          g.addColorStop(0, "rgba(230,240,255,0)");
          g.addColorStop(1, `rgba(230,240,255,${0.8 * Math.sin(p * Math.PI)})`);
          ctx.strokeStyle = g;
          ctx.lineWidth = 0.0015;
          ctx.beginPath();
          ctx.moveTo(x - 0.08, y - 0.03);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }
      if (kind === "rain") {
        ctx.strokeStyle = "rgba(205,218,230,0.32)";
        ctx.lineWidth = 0.0009;
        ctx.beginPath();
        for (const p of particles) {
          p.y += p.vy * dt; p.x += p.vx * dt;
          if (p.y > 1.05) { p.y = -0.05; p.x = view.x0 + rand() * (area + 0.1); }
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * p.size * 0.6, p.y + p.size);
        }
        ctx.stroke();
      } else if (kind === "snow") {
        ctx.fillStyle = "rgba(245,249,255,0.85)";
        ctx.beginPath();
        for (const p of particles) {
          p.y += p.vy * dt * (0.6 + p.size * 300);
          p.x += (p.vx + Math.sin(t * 0.8 + p.phase) * 0.01) * dt;
          if (p.y > 1.03) { p.y = -0.03; p.x = view.x0 + rand() * area; }
          ctx.moveTo(p.x + p.size, p.y);
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        }
        ctx.fill();
      } else if (kind === "fireflies") {
        for (const p of particles) {
          const glow = Math.max(0, Math.sin(t * 0.9 + p.phase));
          if (glow < 0.02) continue;
          const x = p.x + Math.sin(t * 0.3 + p.phase) * 0.02, y = p.y + Math.cos(t * 0.25 + p.phase * 1.3) * 0.015;
          const g = ctx.createRadialGradient(x, y, 0, x, y, 0.008);
          g.addColorStop(0, `rgba(255,236,150,${0.9 * glow})`);
          g.addColorStop(1, "rgba(255,230,140,0)");
          ctx.fillStyle = g;
          ctx.fillRect(x - 0.008, y - 0.008, 0.016, 0.016);
        }
      } else if (kind === "leaves" || kind === "petals") {
        for (const p of particles) {
          p.y += p.vy * dt;
          p.x += (p.vx + Math.sin(t * 0.7 + p.phase) * 0.03) * dt;
          if (p.y > 1.03 || p.x > view.x1 + 0.03) { p.y = -0.03 + rand() * 0.3; p.x = view.x0 - 0.02 + rand() * area * 0.6; }
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(t * p.spin + p.phase);
          ctx.scale(1, Math.abs(Math.sin(t * 1.3 + p.phase)) * 0.8 + 0.2);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * (kind === "leaves" ? 0.55 : 0.7), 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }
  return {
    element: stack,
    tick,
    dispose() {
      stack.remove();
      for (const c of [sky, mountains, valley, front, reflection, mistSprite, ...clouds.map((c) => c.sprite), ...stack.querySelectorAll("canvas")]) { c.width = 1; c.height = 1; }
    },
  };
}
