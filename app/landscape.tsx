"use client";
import { useEffect, useRef } from "react";
import { sceneResolution, type SceneQuality } from "./scene-quality";
import { sceneAsset } from "./season-light";
import { type Season } from "./world";
import { buildScene, type Scene } from "./vector-landscape";

// The valley is painted by code at the screen's own resolution and animated softly.
// A new scene fades in over the frame that is actually on screen; the last choice wins.
export function Landscape({
  weather,
  quality,
  season = "summer",
  automatic,
}: {
  weather: string;
  quality: SceneQuality;
  season?: Season;
  automatic: boolean;
  onError?: (s: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const current = useRef<Scene | null>(null);
  // Every scene still on screen, oldest first, and the clean-up that removes the covered ones.
  const alive = useRef<Scene[]>([]);
  const cleanup = useRef(0);
  const previousQuality = useRef(quality);
  useEffect(() => {
    const root = host.current!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const qualityChanged = previousQuality.current !== quality;
    previousQuality.current = quality;
    const fade = current.current && !qualityChanged && !reduced.matches ? (automatic ? 12000 : 1800) : 0;
    let frame = 0, cancelled = false, lastPaint = -Infinity, size = "";
    const make = (duration: number) => {
      const b = root.getBoundingClientRect();
      const r = sceneResolution(b.width, b.height, devicePixelRatio, quality);
      size = `${r.width}x${r.height}`;
      const scene = buildScene(r.width, r.height, weather, season);
      const el = scene.element;
      el.style.opacity = duration ? "0" : "1";
      el.style.transition = `opacity ${duration}ms ease-in-out`;
      root.appendChild(el);
      scene.tick(performance.now());
      if (duration) {
        void el.offsetWidth;
        el.style.opacity = "1";
      }
      const below = alive.current;
      alive.current = [...below, scene];
      clearTimeout(cleanup.current);
      cleanup.current = window.setTimeout(() => {
        below.forEach((s) => s.dispose());
        alive.current = alive.current.filter((s) => !below.includes(s));
      }, duration + 50);
      current.current = scene;
      root.dataset.sourceResolution = size;
      root.dataset.quality = quality;
      root.dataset.displayedWeather = weather;
      root.dataset.displayedSeason = sceneAsset(weather, season);
    };
    make(fade);
    // About 30 frames a second is plenty for drifting clouds and keeps laptops and TVs cool.
    const paint = (now: number) => {
      if (cancelled) return;
      if (now - lastPaint >= 32) {
        lastPaint = now;
        current.current?.tick(now);
      }
      if (!reduced.matches) frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    let resizeTimer = 0;
    const resize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const b = root.getBoundingClientRect();
        const r = sceneResolution(b.width, b.height, devicePixelRatio, quality);
        if (`${r.width}x${r.height}` !== size) make(0);
      }, 150);
    };
    const motion = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(paint);
    };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : undefined;
    observer?.observe(root);
    window.addEventListener("resize", resize);
    reduced.addEventListener?.("change", motion);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(resizeTimer);
      // The pending clean-up still runs: a scene that is fading out is removed once it is covered.
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      reduced.removeEventListener?.("change", motion);
    };
  }, [weather, season, automatic, quality]);
  useEffect(() => () => {
    clearTimeout(cleanup.current);
    alive.current.forEach((s) => s.dispose());
    alive.current = [];
    current.current = null;
  }, []);
  return (
    <div
      ref={host}
      className="landscape-layers"
      aria-hidden="true"
      data-displayed-fit="cover"
      data-selected-weather={weather}
      data-selected-season={sceneAsset(weather, season)}
    />
  );
}
