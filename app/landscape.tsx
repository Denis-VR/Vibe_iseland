"use client";
import { useEffect, useRef } from "react";
import { sceneResolution, type SceneQuality } from "./scene-quality";
import { sceneAsset, lightSeason } from "./season-light";
import { type Season } from "./world";

// A cancelled transition starts from its actual rendered frame, never a queued image.
export function Landscape({
  weather,
  quality,
  season = "summer",
  automatic,
  onError,
}: {
  weather: string;
  quality: SceneQuality;
  season?: Season;
  automatic: boolean;
  onError: (s: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const cache = useRef(new Map<string, Promise<HTMLImageElement>>());
  const visible = useRef(false);
  const previousQuality = useRef(quality);
  useEffect(() => {
    let cancelled = false,
      frame = 0;
    const qualityChanged = previousQuality.current !== quality;
    previousQuality.current = quality;
    const surface = canvas.current!;
    const initialBounds = surface.getBoundingClientRect();
    const requested = sceneResolution(initialBounds.width, initialBounds.height, devicePixelRatio, quality);
    const useUhd = quality === "uhd" || quality === "auto" && Math.max(requested.width, requested.height) > 1672;
    const ctx = surface.getContext("2d")!;
    const load = (scene: string) => {
      const key = `${scene}:${useUhd ? "uhd" : "hd"}`;
      if (!cache.current.has(key))
        cache.current.set(
          key,
          new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            let fallback = !useUhd;
            const standard = `/scenes/${scene}.webp?v=${scene === "day" ? 5 : scene === "dawn" ? 4 : 3}`;
            img.onerror = () => {
              if (!fallback) { fallback = true; img.src = standard; return; }
              cache.current.delete(key);
              reject(Error("image"));
            };
            img.src = useUhd ? `/scenes/uhd/${scene}.webp?v=1` : standard;
          }),
        );
      return cache.current.get(key)!;
    };
    const paint = (
      source: CanvasImageSource,
      w: number,
      h: number,
      alpha = 1,
    ) => {
      const scale = Math.max(surface.width / w, surface.height / h);
      surface.parentElement!.style.setProperty("--picture-width", `${w * scale / surface.width * 100}%`);
      surface.parentElement!.style.setProperty("--picture-height", `${h * scale / surface.height * 100}%`);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.globalAlpha = alpha;
      ctx.drawImage(
        source,
        (surface.width - w * scale) / 2,
        (surface.height - h * scale) / 2,
        w * scale,
        h * scale,
      );
      ctx.globalAlpha = 1;
    };
    const asset = sceneAsset(weather, season);
    void load(asset)
      .then((img) => {
        if (cancelled) return;
        const target = asset !== weather ? lightSeason(img, weather) : img;
        const snapshot = document.createElement("canvas");
        snapshot.width = surface.width;
        snapshot.height = surface.height;
        snapshot.getContext("2d")!.drawImage(surface, 0, 0);
        const bounds = surface.getBoundingClientRect();
        const resolution = sceneResolution(bounds.width, bounds.height, devicePixelRatio, quality);
        surface.width = resolution.width;
        surface.height = resolution.height;
        const duration = visible.current && !qualityChanged ? (automatic ? 12000 : 1800) : 0;
        const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
        const start = performance.now();
        const draw = (now: number) => {
          if (cancelled) return;
          const p =
            duration && !reduced ? Math.min(1, (now - start) / duration) : 1;
          ctx.clearRect(0, 0, surface.width, surface.height);
          if (p < 1) paint(snapshot, snapshot.width, snapshot.height);
          paint(
            target,
            img.naturalWidth,
            img.naturalHeight,
            p * p * (3 - 2 * p),
          );
          visible.current = true;
          if (p < 1) frame = requestAnimationFrame(draw);
          else {
            // The previous 4K frame is no longer needed after the crossfade.
            snapshot.width = 1;
            snapshot.height = 1;
            surface.dataset.displayedFit = "cover";
            surface.dataset.sourceResolution = `${img.naturalWidth}x${img.naturalHeight}`;
            surface.dataset.quality = quality;
            surface.dataset.displayedWeather = weather;
            surface.dataset.displayedSeason = asset;
          }
        };
        draw(start);
        const resize = () => {
          const b = surface.getBoundingClientRect();
          const resolution = sceneResolution(b.width, b.height, devicePixelRatio, quality);
          if (surface.width === resolution.width && surface.height === resolution.height) return;
          surface.width = resolution.width;
          surface.height = resolution.height;
          ctx.clearRect(0, 0, surface.width, surface.height);
          paint(target, img.naturalWidth, img.naturalHeight);
        };
        if (typeof ResizeObserver !== "undefined") {
          observer = new ResizeObserver(resize);
          observer.observe(surface);
        }
        resizeListener = resize;
        window.addEventListener("resize", resize);
        // Keep decoded images bounded on memory-constrained TV browsers.
        for (const key of cache.current.keys()) {
          if (cache.current.size <= 2) break;
          if (!key.startsWith(`${asset}:`)) cache.current.delete(key);
        }
      })
      .catch(() => {
        if (!cancelled)
          onError("Не удалось загрузить пейзаж. Обнови страницу.");
      });
    let observer: ResizeObserver | undefined;
    let resizeListener: (() => void) | undefined;
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      if (resizeListener) window.removeEventListener("resize", resizeListener);
    };
  }, [weather, season, automatic, onError, quality]);
  return (
    <div className="landscape-layers" aria-hidden="true">
      <canvas
        ref={canvas}
        className="landscape-canvas"
        data-selected-weather={weather}
        data-selected-season={sceneAsset(weather, season)}
      />
      <div className="cloud-sky">
        <div className="cloud-drift cloud-one" />
        <div className="cloud-drift cloud-two" />
      </div>
    </div>
  );
}
