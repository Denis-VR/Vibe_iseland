"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mountain,
  Headphones,
  Route,
  Play,
  Pause,
  Maximize,
  Minimize,
  Sun,
  Moon,
  CloudRain,
  CloudFog,
  Volume2,
  SkipBack,
  SkipForward,
  Music2,
  Plus,
  Check,
  ArrowUpRight,
  EyeOff,
  Shuffle,
  Repeat,
  Upload,
  ArrowUp,
  ArrowDown,
  Trash2,
  Timer,
  ChevronRight,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Slider } from "./volume-slider";
import { initialState, builtins, type StudyState } from "./course";
import {
  weatherOrder,
  nextWeather,
  atlasStops,
  scheduleWeather,
} from "./world";

type Track = { id: string; name: string; url?: string; subtitle?: string };
function time(v: number) {
  return Math.floor(v / 60) + ":" + String(Math.floor(v % 60)).padStart(2, "0");
}
export default function Sanctuary() {
  const [autoWeather, setAutoWeather] = useState(false),
    [weatherMinutes, setWeatherMinutes] = useState(10),
    [prefsLoaded, setPrefsLoaded] = useState(false);
  const [mode, setMode] = useState("landscape"),
    [weather, setWeather] = useState("sunset"),
    [zen, setZen] = useState(false),
    [full, setFull] = useState(false);
  const [panel, setPanel] = useState<"music" | "atmosphere" | null>(null);
  const [state, setState] = useState<StudyState>(initialState),
    [revision, setRevision] = useState(0),
    [ready, setReady] = useState(false),
    [saving, setSaving] = useState(false),
    [auth, setAuth] = useState(false),
    [message, setMessage] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]),
    [playlist, setPlaylist] = useState("ambient"),
    [track, setTrack] = useState<Track>(builtins[0]),
    [playing, setPlaying] = useState(false),
    [volume, setVolume] = useState(55),
    [nature, setNature] = useState(0),
    [elapsed, setElapsed] = useState(0),
    [duration, setDuration] = useState(0),
    [shuffle, setShuffle] = useState(false),
    [repeat, setRepeat] = useState(true);
  const [newList, setNewList] = useState(""),
    [uploading, setUploading] = useState(false),
    [remaining, setRemaining] = useState<number | null>(null),
    [timerLength, setTimerLength] = useState(25),
    [timerRunning, setTimerRunning] = useState(false);
  const audio = useRef<HTMLAudioElement>(null),
    rain = useRef<HTMLAudioElement>(null),
    timerEnd = useRef(0),
    busy = useRef(false);
  const allTracks = [...builtins, ...tracks],
    currentList = state.playlists.find((p) => p.id === playlist),
    queue =
      playlist === "ambient"
        ? builtins
        : (currentList?.tracks
            .map((id) => allTracks.find((t) => t.id === id))
            .filter(Boolean) as Track[]) || [];
  const notify = useCallback((s: string) => setMessage(s), []);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/state");
      if (r.status === 401) {
        setAuth(true);
        return;
      }
      const d = (await r.json()) as {
        state: StudyState;
        revision: number;
        error?: string;
      };
      if (!r.ok) throw Error(d.error);
      setState(d.state);
      setRevision(d.revision);
      const tr = await fetch("/api/tracks");
      const td = (await tr.json()) as Track[] & { error?: string };
      if (!tr.ok) throw Error(td.error);
      setTracks(td);
      setReady(true);
      setAuth(false);
    } catch (e) {
      notify((e as Error).message);
    }
  }, [notify]);
  function chooseWeather(value: string) {
    setWeather(value);
    setAutoWeather(false);
  }
  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        const saved = JSON.parse(
          localStorage.getItem("quiet-height-atmosphere") || "null",
        );
        if (saved) {
          if (weatherOrder.includes(saved.weather)) setWeather(saved.weather);
          setAutoWeather(saved.auto === true);
          if ([10, 20, 30].includes(saved.minutes))
            setWeatherMinutes(saved.minutes);
        }
      } catch {}
      setPrefsLoaded(true);
    });
  }, []);
  useEffect(() => {
    if (!prefsLoaded) return;
    try {
      localStorage.setItem(
        "quiet-height-atmosphere",
        JSON.stringify({ weather, auto: autoWeather, minutes: weatherMinutes }),
      );
    } catch {}
  }, [weather, autoWeather, weatherMinutes, prefsLoaded]);
  useEffect(() => {
    if (!autoWeather || !prefsLoaded) return;
    return scheduleWeather(weatherMinutes, () =>
      setWeather((current) => nextWeather(current)),
    );
  }, [autoWeather, weatherMinutes, prefsLoaded]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 9000);
    return () => clearTimeout(t);
  }, [message]);
  async function save(next: StudyState) {
    if (!ready) {
      notify("Войди и дождись загрузки, чтобы сохранить изменения.");
      return false;
    }
    if (busy.current) return false;
    busy.current = true;
    setSaving(true);
    try {
      const r = await fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: next, revision }),
      });
      const d = (await r.json()) as { revision: number; error?: string };
      if (!r.ok) throw Error(d.error);
      setState(next);
      setRevision(d.revision);
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const playTrack = useCallback(
    async (t: Track) => {
      if (!audio.current) return;
      setTrack(t);
      audio.current.src = t.url || "/api/tracks/" + t.id;
      audio.current.volume = volume / 100;
      setElapsed(0);
      try {
        await audio.current.play();
      } catch {
        setPlaying(false);
        notify(
          "Не удалось воспроизвести файл. Попробуй MP3 или нажми «Играть» ещё раз.",
        );
      }
    },
    [volume, notify],
  );
  async function toggle() {
    const el = audio.current;
    if (!el) return;
    if (playing) {
      el.pause();
      return;
    }
    if (!el.getAttribute("src")) {
      await playTrack(track);
      return;
    }
    try {
      await el.play();
    } catch {
      notify("Браузер не воспроизвёл аудио. Попробуй другой трек.");
    }
  }
  function nextTrack(direction = 1, ended = false) {
    if (!queue.length) return;
    const i = queue.findIndex((t) => t.id === track.id);
    if (ended && !repeat && !shuffle && i === queue.length - 1) {
      setPlaying(false);
      return;
    }
    let j = shuffle
      ? crypto.getRandomValues(new Uint32Array(1))[0] % queue.length
      : (i + direction + queue.length) % queue.length;
    if (shuffle && queue.length > 1 && j === i) j = (j + 1) % queue.length;
    void playTrack(queue[j]);
  }
  useEffect(() => {
    if (audio.current) audio.current.volume = volume / 100;
  }, [volume]);
  useEffect(() => {
    const el = rain.current;
    if (!el) return;
    el.volume = nature / 100;
    if (nature)
      void el.play().catch(() => {
        setNature(0);
        notify("Нажми на громкость природы ещё раз, чтобы разрешить звук.");
      });
    else el.pause();
  }, [nature, notify]);
  useEffect(() => {
    function fullChanged() {
      setFull(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", fullChanged);
    return () => document.removeEventListener("fullscreenchange", fullChanged);
  }, []);
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      notify(
        "Полный экран недоступен в этом браузере. Можно включить режим без интерфейса.",
      );
    }
  }
  useEffect(() => {
    const tick = setInterval(() => {
      if (!timerRunning) return;
      const left = Math.max(
        0,
        Math.ceil((timerEnd.current - Date.now()) / 1000),
      );
      setRemaining(left);
      if (left === 0) {
        setTimerRunning(false);
        setZen(false);
        audio.current?.pause();
        setNature(0);
        notify("Сессия завершена. Время немного отдохнуть.");
      }
    }, 500);
    return () => clearInterval(tick);
  }, [timerRunning, notify]);
  function startTimer() {
    if (timerRunning) {
      setTimerRunning(false);
      return;
    }
    const seconds = remaining && remaining > 0 ? remaining : timerLength * 60;
    timerEnd.current = Date.now() + seconds * 1000;
    setRemaining(seconds);
    setTimerRunning(true);
  }
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key === "Escape" ||
        e.key === "BrowserBack" ||
        e.key === "GoBack" ||
        e.keyCode === 10009
      ) {
        if (zen) {
          e.preventDefault();
          setZen(false);
        }
        return;
      }
      if (zen) {
        setZen(false);
        return;
      }
      const target = e.target as HTMLElement;
      if (
        target.closest(
          'input,textarea,[role="slider"],[role="tablist"],[role="combobox"]',
        )
      )
        return;
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key))
        return;
      const scope = document.querySelector('[role="dialog"]') || document;
      const elements = Array.from(
        scope.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],input,textarea,[tabindex="0"]',
        ),
      ).filter(
        (el) =>
          el.getBoundingClientRect().width > 0 &&
          el.getAttribute("aria-hidden") !== "true",
      );
      const from = document.activeElement as HTMLElement;
      const box = from?.getBoundingClientRect();
      if (!box || !elements.includes(from)) {
        elements[0]?.focus();
        return;
      }
      let best: HTMLElement | undefined,
        score = Infinity;
      for (const el of elements) {
        if (el === from) continue;
        const b = el.getBoundingClientRect(),
          dx = b.x + b.width / 2 - (box.x + box.width / 2),
          dy = b.y + b.height / 2 - (box.y + box.height / 2);
        const horizontal = e.key === "ArrowLeft" || e.key === "ArrowRight",
          primary = horizontal ? dx : dy,
          secondary = horizontal ? dy : dx,
          sign = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
        if (primary * sign <= 5) continue;
        const s = Math.abs(primary) + Math.abs(secondary) * 3;
        if (s < score) {
          score = s;
          best = el;
        }
      }
      if (best) {
        e.preventDefault();
        best.focus();
        best.scrollIntoView({ block: "nearest" });
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zen]);
  useEffect(() => {
    const mc = (
      document as Document & {
        modelContext?: {
          registerTool: (tool: unknown, options: unknown) => void;
        };
      }
    ).modelContext;
    if (!mc?.registerTool) return;
    const life = new AbortController();
    try {
      mc.registerTool(
        {
          name: "open_study_view",
          description: "Switch between landscape and Go progress map.",
          inputSchema: {
            type: "object",
            properties: { view: { enum: ["landscape", "path"] } },
            required: ["view"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute: (input: { view: string }) => {
            if (!input || !["landscape", "path"].includes(input.view))
              throw Error("Invalid view");
            setMode(input.view);
            return { view: input.view };
          },
        },
        { signal: life.signal },
      );
    } catch {}
    return () => life.abort();
  }, []);
  async function upload(files: FileList | null) {
    if (!files) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 25 * 1024 * 1024) throw Error("Максимум 25 МБ на трек");
        const r = await fetch("/api/tracks", {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-File-Name": encodeURIComponent(file.name),
          },
          body: file,
        });
        const d = (await r.json()) as Track & { error?: string };
        if (!r.ok) throw Error(d.error);
        setTracks((prev) => [d, ...prev]);
      }
      notify("Треки загружены. Добавь их в свой плейлист.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  async function addPlaylist() {
    if (!newList.trim()) return;
    const id = crypto.randomUUID();
    if (
      await save({
        ...state,
        playlists: [
          ...state.playlists,
          { id, name: newList.trim(), tracks: [] },
        ],
      })
    ) {
      setNewList("");
      setPlaylist(id);
    }
  }
  async function editList(ids: string[]) {
    if (!currentList) return;
    await save({
      ...state,
      playlists: state.playlists.map((p) =>
        p.id === playlist ? { ...p, tracks: ids } : p,
      ),
    });
  }
  return (
    <main
      className={`sanctuary weather-${weather} ${zen ? "zen" : ""} mode-${mode}`}
    >
      <div className="world" />
      <div className="atlas-world" />
      <div className="weather-wash" />
      <div className="mist" />
      <div className="shade" />
      <audio
        ref={audio}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => nextTrack(1, true)}
        onTimeUpdate={() => setElapsed(audio.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audio.current?.duration || 0)}
        onError={() => {
          setPlaying(false);
          notify(
            "Этот аудиофайл не удалось открыть. Выбери другой формат или трек.",
          );
        }}
      />
      <audio ref={rain} src="/audio/rain.mp3" loop preload="none" />
      <div className="interface" inert={zen}>
        <header>
          <Link className="brand" href="/" aria-label="Тихая высота — главная">
            <Mountain />
            <span>
              тихая высота<small>МЕСТО ДЛЯ ТВОИХ МЫСЛЕЙ</small>
            </span>
          </Link>
          <Tabs value={mode} onValueChange={setMode}>
            <TabsList aria-label="Режим">
              <TabsTrigger value="landscape">
                <Mountain />
                Пейзаж
              </TabsTrigger>
              <TabsTrigger value="path">
                <Route />
                Путь
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="header-actions">
            <button
              onClick={() => setPanel("atmosphere")}
              aria-label="Настроить атмосферу"
            >
              <Sun />
            </button>
            <button
              onClick={fullscreen}
              aria-label={full ? "Выйти из полного экрана" : "Полный экран"}
            >
              {full ? <Minimize /> : <Maximize />}
            </button>
          </div>
        </header>
        {auth && (
          <div className="connection">
            <span>
              Войди для доступа к своей музыке и прогрессу на всех устройствах.
            </span>
            <a href="/signin-with-chatgpt?return_to=/" target="_top">
              Войти <ArrowUpRight />
            </a>
          </div>
        )}
        {!ready && !auth && (
          <div className="connection">
            {message ? "Хранилище пока недоступно." : "Загружаю твой путь…"}{" "}
            <button onClick={load}>Повторить</button>
          </div>
        )}
        {mode === "landscape" ? (
          <>
            <section className="intro">
              <p className="eyebrow">
                <span /> ТВОЁ МЕСТО СИЛЫ
              </p>
              <h1>
                Выше шума.
                <br />
                <i>Ближе к себе.</i>
              </h1>
              <p>
                Горы никуда не спешат.
                <br />
                Ты тоже можешь идти в своём ритме.
              </p>
              <button className="quiet-link" onClick={() => setZen(true)}>
                <EyeOff />
                Остаться с горами <ChevronRight />
              </button>
            </section>
            <div className="scene-caption">
              <span>01 / АЛЬПИЙСКАЯ ДОЛИНА</span>
              <span>
                {weather === "sunset"
                  ? "Последний свет на вершинах"
                  : weather === "night"
                    ? "Синий час"
                    : weather === "rain"
                      ? "Дождь в долине"
                      : "Туман над озером"}
              </span>
            </div>
            <div className="lower-row">
              <div className="weather-pills" aria-label="Атмосфера">
                <button
                  className="auto-weather-button"
                  aria-pressed={autoWeather}
                  onClick={() => setAutoWeather(!autoWeather)}
                >
                  <Repeat />
                  {autoWeather ? `Авто · ${weatherMinutes} мин` : "Авто"}
                </button>
                {[
                  ["sunset", "Закат", Sun],
                  ["fog", "Туман", CloudFog],
                  ["rain", "Дождь", CloudRain],
                  ["night", "Ночь", Moon],
                ].map(([value, label, Icon]) => {
                  const I = Icon as typeof Sun;
                  return (
                    <button
                      key={String(value)}
                      aria-pressed={weather === value}
                      onClick={() => chooseWeather(String(value))}
                    >
                      <I />
                      {String(label)}
                    </button>
                  );
                })}
              </div>
              <button className="path-hint" onClick={() => setMode("path")}>
                <span className="go-badge">Go</span>
                <span>
                  Твоя следующая высота
                  <small>12 изученных тем · твой горный атлас</small>
                </span>
                <ArrowUpRight />
              </button>
            </div>
          </>
        ) : (
          <section className="atlas">
            <div className="atlas-heading">
              <p className="eyebrow">ТВОЯ ЭКСПЕДИЦИЯ</p>
              <h1>
                Атлас <i>Go</i>
              </h1>
              <p>12 знакомых тем. Один пройденный путь.</p>
            </div>
            <div
              className="atlas-points"
              aria-label="Горная карта изученных тем Go"
            >
              {atlasStops.map((stop, i) => (
                <article
                  className={"atlas-stop stop-" + i}
                  key={stop.title}
                  style={{ left: stop.x + "%", top: stop.y + "%" }}
                >
                  <span className="atlas-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h2>{stop.title}</h2>
                    <p>{stop.topics}</p>
                    <code>{stop.code}</code>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <footer className="player">
          <button className="track-info" onClick={() => setPanel("music")}>
            <span className="album-art">
              <Headphones />
            </span>
            <span>
              {track.name}
              <small>
                {builtins.some((t) => t.id === track.id)
                  ? "Горный эмбиент"
                  : "Моя музыка"}{" "}
                · {playing ? "играет" : "на паузе"}
              </small>
            </span>
          </button>
          <div className="transport">
            <div className="transport-buttons">
              <button
                aria-label="Перемешивать"
                aria-pressed={shuffle}
                onClick={() => setShuffle(!shuffle)}
              >
                <Shuffle />
              </button>
              <button
                aria-label="Предыдущий трек"
                onClick={() => nextTrack(-1)}
              >
                <SkipBack />
              </button>
              <button
                className="play-button"
                aria-label={playing ? "Пауза" : "Играть"}
                onClick={toggle}
              >
                {playing ? (
                  <Pause fill="currentColor" />
                ) : (
                  <Play fill="currentColor" />
                )}
              </button>
              <button aria-label="Следующий трек" onClick={() => nextTrack()}>
                <SkipForward />
              </button>
              <button
                aria-label="Повтор плейлиста"
                aria-pressed={repeat}
                onClick={() => setRepeat(!repeat)}
              >
                <Repeat />
              </button>
            </div>
            <div className="timeline">
              <span>{time(elapsed)}</span>
              <Slider
                aria-label="Позиция трека"
                min={0}
                max={duration || 240}
                step={1}
                value={[elapsed]}
                onValueChange={([v]) => {
                  if (audio.current && Number.isFinite(audio.current.duration))
                    audio.current.currentTime = v;
                }}
              />
              <span>{time(duration || 240)}</span>
            </div>
          </div>
          <div className="player-end">
            <div className="volume">
              <Volume2 />
              <Slider
                aria-label="Громкость музыки"
                value={[volume]}
                onValueChange={([v]) => setVolume(v)}
              />
            </div>
            <button
              className="library-button"
              onClick={() => setPanel("music")}
            >
              <Music2 />
              Плейлисты
            </button>
          </div>
        </footer>
        <div className="bottom-line">
          <span>Никуда не торопись. Просто продолжай.</span>
          <button onClick={() => setPanel("atmosphere")}>
            <Timer />
            {remaining !== null
              ? `${time(remaining)} ${timerRunning ? "· фокус" : "· пауза"}`
              : "Таймер фокуса"}
          </button>
          <span>СТРЕЛКИ — ВЫБОР · ENTER — ДЕЙСТВИЕ</span>
        </div>
      </div>
      {zen && (
        <button className="zen-return" onClick={() => setZen(false)}>
          <Mountain />
          Вернуть управление <small>Enter / Esc</small>
        </button>
      )}
      {message && (
        <div className="toast" role="status">
          {message}
          <button onClick={() => setMessage("")} aria-label="Закрыть сообщение">
            ×
          </button>
        </div>
      )}
      <Sheet
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <SheetContent className="detail-panel">
          <SheetHeader>
            <SheetTitle>
              {panel === "music" ? "Твоя музыка" : "Атмосфера"}
            </SheetTitle>
            <SheetDescription>
              {panel === "music"
                ? "Звук, с которым легче остаться в потоке."
                : "Настрой своё пространство."}
            </SheetDescription>
          </SheetHeader>
          {panel === "music" && (
            <div className="panel-body">
              <div className="playlist-list">
                <button
                  className={playlist === "ambient" ? "chosen" : ""}
                  onClick={() => setPlaylist("ambient")}
                >
                  <Headphones />
                  Горный эмбиент <span>3</span>
                </button>
                {state.playlists.map((p) => (
                  <button
                    key={p.id}
                    className={playlist === p.id ? "chosen" : ""}
                    onClick={() => setPlaylist(p.id)}
                  >
                    <Music2 />
                    {p.name}
                    <span>{p.tracks.length}</span>
                  </button>
                ))}
              </div>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void addPlaylist();
                }}
              >
                <input
                  aria-label="Название плейлиста"
                  placeholder="Новый плейлист"
                  value={newList}
                  maxLength={100}
                  onChange={(e) => setNewList(e.target.value)}
                />
                <button
                  aria-label="Создать плейлист"
                  disabled={!ready || saving || !newList.trim()}
                >
                  <Plus />
                </button>
              </form>
              <h3>
                {playlist === "ambient" ? "Горный эмбиент" : currentList?.name}
              </h3>
              <p className="small-copy">
                {playlist === "ambient"
                  ? "Три оригинальные синтезированные композиции без вокала."
                  : "Порядок треков можно менять стрелками."}
              </p>
              {queue.length === 0 && (
                <div className="empty-state">
                  <Music2 />
                  <p>Пока тихо. Добавь треки из библиотеки ниже.</p>
                </div>
              )}
              {queue.map((t, i) => (
                <div className="track-row" key={t.id}>
                  <button className="track-name" onClick={() => playTrack(t)}>
                    {playing && track.id === t.id ? <Volume2 /> : <Play />}
                    <span>
                      {t.name}
                      <small>{t.subtitle || "Твоя загрузка"}</small>
                    </span>
                  </button>
                  {currentList && (
                    <div className="track-tools">
                      <button
                        aria-label={"Выше: " + t.name}
                        disabled={i === 0 || saving}
                        onClick={() => {
                          const ids = [...currentList.tracks];
                          [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                          void editList(ids);
                        }}
                      >
                        <ArrowUp />
                      </button>
                      <button
                        aria-label={"Ниже: " + t.name}
                        disabled={i === queue.length - 1 || saving}
                        onClick={() => {
                          const ids = [...currentList.tracks];
                          [ids[i], ids[i + 1]] = [ids[i + 1], ids[i]];
                          void editList(ids);
                        }}
                      >
                        <ArrowDown />
                      </button>
                      <button
                        aria-label={"Убрать из плейлиста: " + t.name}
                        disabled={saving}
                        onClick={() =>
                          editList(
                            currentList.tracks.filter((id) => id !== t.id),
                          )
                        }
                      >
                        <Trash2 />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <h3>Библиотека</h3>
              <label className={`upload-button ${!ready ? "disabled" : ""}`}>
                <Upload />
                {uploading ? "Загружаю…" : "Загрузить музыку"}
                <input
                  type="file"
                  accept=".mp3,.m4a,.wav,.ogg,.flac,.aac"
                  multiple
                  disabled={!ready || uploading}
                  onChange={(e) => {
                    void upload(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
              <p className="small-copy">
                До 25 МБ на трек. MP3 — самый универсальный вариант для ТВ.
                Загрузки доступны на устройствах с тем же аккаунтом.
              </p>
              {allTracks.map((t) => (
                <div key={t.id} className="track-row">
                  <button className="track-name" onClick={() => playTrack(t)}>
                    <Play />
                    <span>{t.name}</span>
                  </button>
                  {currentList && (
                    <button
                      aria-label={"Добавить: " + t.name}
                      disabled={saving || currentList.tracks.includes(t.id)}
                      onClick={() => editList([...currentList.tracks, t.id])}
                    >
                      {currentList.tracks.includes(t.id) ? <Check /> : <Plus />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {panel === "atmosphere" && (
            <div className="panel-body">
              <h3>Как живёт пейзаж</h3>
              <div className="weather-behavior">
                <button
                  className={!autoWeather ? "chosen" : ""}
                  aria-pressed={!autoWeather}
                  onClick={() => setAutoWeather(false)}
                >
                  <Sun />
                  <span>
                    Фиксированный<small>Выбранное условие остаётся</small>
                  </span>
                </button>
                <button
                  className={autoWeather ? "chosen" : ""}
                  aria-pressed={autoWeather}
                  onClick={() => setAutoWeather(true)}
                >
                  <Repeat />
                  <span>
                    Меняется сам
                    <small>Свет и погода плавно сменяют друг друга</small>
                  </span>
                </button>
              </div>
              {autoWeather && (
                <>
                  <h3>Менять условия каждые</h3>
                  <div className="atmosphere-grid">
                    {[10, 20, 30].map((minutes) => (
                      <button
                        key={minutes}
                        className={weatherMinutes === minutes ? "chosen" : ""}
                        aria-pressed={weatherMinutes === minutes}
                        onClick={() => setWeatherMinutes(minutes)}
                      >
                        {minutes} мин
                      </button>
                    ))}
                  </div>
                </>
              )}
              <h3>{autoWeather ? "Сейчас в долине" : "Оставить в долине"}</h3>
              <div className="atmosphere-grid">
                {[
                  ["sunset", "Закат", Sun],
                  ["fog", "Туман", CloudFog],
                  ["rain", "Дождь", CloudRain],
                  ["night", "Ночь", Moon],
                ].map(([v, l, I]) => {
                  const Icon = I as typeof Sun;
                  return (
                    <button
                      key={String(v)}
                      className={weather === v ? "chosen" : ""}
                      onClick={() => chooseWeather(String(v))}
                    >
                      <Icon />
                      {String(l)}
                    </button>
                  );
                })}
              </div>
              <h3>
                Звук дождя <span>{nature}%</span>
              </h3>
              <Slider
                aria-label="Громкость дождя"
                value={[nature]}
                onValueChange={([v]) => setNature(v)}
              />
              <p className="small-copy">
                Мягкий синтезированный шум, независимо от музыки.
              </p>
              <h3>Сессия фокуса</h3>
              <div className="atmosphere-grid">
                {[25, 50, 90].map((n) => (
                  <button
                    key={n}
                    className={timerLength === n ? "chosen" : ""}
                    onClick={() => {
                      setTimerLength(n);
                      setRemaining(null);
                      setTimerRunning(false);
                    }}
                  >
                    {n} мин
                  </button>
                ))}
              </div>
              <div className="timer-number">
                {time(remaining ?? timerLength * 60)}
              </div>
              <button className="primary" onClick={startTimer}>
                {timerRunning ? <Pause /> : <Play />}
                {timerRunning ? "Пауза" : "Начать сессию"}
              </button>
              <p className="small-copy">
                В конце музыка остановится. Можно слушать без таймера.
              </p>
              <button
                onClick={() => {
                  setPanel(null);
                  setZen(true);
                }}
              >
                <EyeOff />
                Скрыть весь интерфейс
              </button>
              <p className="small-copy">
                Стрелки и Enter для пульта. Esc или кнопка «Назад» возвращает
                управление. Выбор света вручную включает фиксированный режим.
                Движение приглушено при системной настройке уменьшения анимации.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}
