"use client";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, AudioLines } from "lucide-react";
import { Slider } from "./volume-slider";
import { NoiseEngine, noiseChannels, type NoiseKind } from "./noise-engine";
export function useNoiseMixer({
  stopSignal,
  notify,
}: {
  stopSignal: number;
  notify: (s: string) => void;
}) {
  const engine = useRef<NoiseEngine | null>(null),
    [running, setRunning] = useState(false),
    [master, setMaster] = useState(60),
    [softness, setSoftness] = useState(40),
    [levels, setLevels] = useState<Record<NoiseKind, number>>({
      white: 25,
      pink: 0,
      brown: 0,
      rain: 0,
      downpour: 0,
      roof: 0,
      birds: 0,
      wind: 0,
      water: 0,
      fire: 0,
      stream: 0,
      village: 0,
      sea: 0,
      night: 0,
      crickets: 0,
      frogs: 0,
    }),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        const d = JSON.parse(
          localStorage.getItem("quiet-height-mixer") || "null",
        );
        if (d) {
          if (Number.isFinite(d.master))
            setMaster(Math.max(0, Math.min(100, d.master)));
          if (Number.isFinite(d.softness))
            setSoftness(Math.max(0, Math.min(100, d.softness)));
          setLevels(
            (previous) =>
              Object.fromEntries(
                noiseChannels.map((c) => [
                  c.id,
                  Number.isFinite(d.levels?.[c.id])
                    ? Math.max(0, Math.min(100, d.levels[c.id]))
                    : previous[c.id],
                ]),
              ) as Record<NoiseKind, number>,
          );
        }
      } catch {}
      setLoaded(true);
    });
  }, []);
  useEffect(() => {
    if (loaded)
      try {
        localStorage.setItem(
          "quiet-height-mixer",
          JSON.stringify({ master, softness, levels }),
        );
      } catch {}
  }, [master, softness, levels, loaded]);
  useEffect(() => {
    if (!engine.current) return;
    engine.current.setMaster(running ? master : 0);
    engine.current.setTone(softness);
    noiseChannels.forEach((c) => engine.current!.set(c.id, levels[c.id]));
  }, [running, master, softness, levels]);
  useEffect(() => {
    if (stopSignal) {
      engine.current?.setMaster(0);
      void Promise.resolve().then(() => setRunning(false));
    }
  }, [stopSignal]);
  useEffect(
    () => () => {
      void engine.current?.close();
      engine.current = null;
    },
    [],
  );
  async function toggle() {
    if (running) {
      setRunning(false);
      return;
    }
    try {
      engine.current ??= new NoiseEngine(notify);
      await engine.current.start();
      setRunning(true);
    } catch {
      notify("Браузер не разрешил звук. Нажми «Включить звуки» ещё раз.");
    }
  }
  async function solo(kind: NoiseKind) {
    try {
      engine.current ??= new NoiseEngine(notify);
      await engine.current.start();
      setLevels(
        Object.fromEntries(
          noiseChannels.map((c) => [c.id, c.id === kind ? 70 : 0]),
        ) as Record<NoiseKind, number>,
      );
      setRunning(true);
    } catch {
      notify("Не удалось включить звук. Попробуй ещё раз.");
    }
  }
  return {
    solo,
    running,
    master,
    softness,
    levels,
    setMaster,
    setSoftness,
    setLevels,
    toggle,
  };
}
export function NoiseMixer({
  mixer,
}: {
  mixer: ReturnType<typeof useNoiseMixer>;
}) {
  const {
    running,
    master,
    softness,
    levels,
    setMaster,
    setSoftness,
    setLevels,
    toggle,
    solo,
  } = mixer;
  return (
    <section className="noise-mixer">
      <div className="mixer-heading">
        <h3>
          <AudioLines />
          Звуковое пространство
        </h3>
        <button
          className={running ? "chosen" : ""}
          onClick={toggle}
          aria-label={
            running ? "Выключить фоновые звуки" : "Включить фоновые звуки"
          }
        >
          {running ? <Pause /> : <Play />}
          {running ? "Пауза" : "Включить"}
        </button>
      </div>
      <p className="small-copy">
        Смешивай звуки независимо от музыки и погоды.
      </p>
      <div className="mixer-control">
        <label>
          Общая громкость<span>{master}%</span>
        </label>
        <Slider
          aria-label="Общая громкость фоновых звуков"
          value={[master]}
          onValueChange={([v]) => setMaster(v)}
        />
      </div>
      <div className="mixer-control">
        <label>
          Мягкость шума<span>{softness}%</span>
        </label>
        <Slider
          aria-label="Мягкость шума"
          value={[softness]}
          onValueChange={([v]) => setSoftness(v)}
        />
        <small>Яркий, воздушный ↔ тёплый, приглушённый</small>
      </div>
      {noiseChannels.map((c) => (
        <div className="noise-channel" key={c.id}>
          <div>
            <strong>{c.name}</strong>
            <small>{c.hint}</small>
          </div>
          <button
            className="solo-sound"
            onClick={() => solo(c.id)}
            aria-label={"Слушать отдельно: " + c.name}
          >
            <Play />
            Отдельно
          </button>
          <span>{levels[c.id]}%</span>
          <Slider
            aria-label={"Громкость: " + c.name}
            value={[levels[c.id]]}
            onValueChange={([v]) => setLevels({ ...levels, [c.id]: v })}
          />
        </div>
      ))}
      <p className="small-copy">
        Море, летняя ночь, сверчки, пруд, костёр, ручеёк, мелкий дождь
        и деревенский двор — настоящие записи природы.
        «Отдельно» выключает остальные звуки микшера. Мягкость регулирует
        синтезированный шум. Настройки сохраняются; звук включается вручную.
      </p>
    </section>
  );
}
