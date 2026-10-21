"use client";
import { DisplaySettings, useDisplay, fullscreenElement, toggleFullscreen } from "./display";
import { useWindowDrag } from "./use-window-drag";
import { newId } from "./id";
import { LocalWeatherPicker, useLocalWeather } from "./local-weather";
import { Landscape } from "./landscape";
import { NoiseMixer, useNoiseMixer } from "./noise-mixer";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mountain,
  Headphones,
  Play,
  Pause,
  Maximize,
  Minimize,
  Sun,
  Sunrise,
  Moon,
  CloudRain,
  CloudFog,
  Volume2,
  SkipBack,
  SkipForward,
  Music2,
  Plus,
  X,
  Snowflake,
  Flower2,
  Leaf,
  EyeOff,
  Shuffle,
  Repeat,
  ArrowUp,
  ArrowDown,
  Trash2,
  Timer,
  ListTodo,
  AudioLines,
  ChevronRight,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Slider } from "./volume-slider";
import { TaskCard, useFocusTasks } from "./focus-task-ui";
import { PlaybackRequest } from "./playback-request";
import { initialState, builtins, type LibraryState } from "./library";
import {
  weatherOrder,
  nextWeather,
  scheduleWeather,
  validWeatherMinutes,
  validFocusMinutes,
  focusTime,
} from "./world";

type Track = { id: string; name: string; url?: string; subtitle?: string; group?: string };
const githubPages = import.meta.env.VITE_GITHUB_PAGES === "true";
const libraryStorageKey = "quiet-height-library";
function time(v: number) {
  return Math.floor(v / 60) + ":" + String(Math.floor(v % 60)).padStart(2, "0");
}
export default function Sanctuary() {
  const [autoWeather, setAutoWeather] = useState(false),
    [weatherMinutes, setWeatherMinutes] = useState(10),
    [prefsLoaded, setPrefsLoaded] = useState(false);
  const [weather, setWeather] = useState("sunset"),
    [zen, setZen] = useState(false),
    [full, setFull] = useState(false);
  const settingsBody = useRef<HTMLDivElement>(null);
  const [settingsSection, setSettingsSection] = useState("scene");
  const [panel, setPanel] = useState<"music" | "atmosphere" | null>(null);
  const [state, setState] = useState<LibraryState>(initialState),
    [revision, setRevision] = useState(0),
    [ready, setReady] = useState(false),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]),
    [playlist, setPlaylist] = useState("ambient"),
    [track, setTrack] = useState<Track>(builtins[0]),
    [playing, setPlaying] = useState(false),
    [volume, setVolume] = useState(55),
    [noiseStop, setNoiseStop] = useState(0),
    [elapsed, setElapsed] = useState(0),
    [duration, setDuration] = useState(0),
    [shuffle, setShuffle] = useState(true),
    [repeat, setRepeat] = useState(false);
  const [newList, setNewList] = useState(""),
    [remaining, setRemaining] = useState<number | null>(null),
    [timerLength, setTimerLength] = useState(25),
    [timerRunning, setTimerRunning] = useState(false);
  const playback = useRef(new PlaybackRequest());
  const audio = useRef<HTMLAudioElement>(null),
    timerEnd = useRef(0),
    busy = useRef(false);
  const allTracks: Track[] = [...builtins, ...tracks],
    currentList = state.playlists.find((p) => p.id === playlist),
    queue =
      playlist === "ambient"
        ? builtins
        : playlist === "mymusic" || playlist === "secret"
          ? tracks.filter(t => t.group === playlist)
        : (currentList?.tracks
            .map((id) => allTracks.find((t) => t.id === id))
            .filter(Boolean) as Track[]) || [];
  const notify = useCallback((s: string) => setMessage(s), []);
  const display = useDisplay();
  const localWeather = useLocalWeather(setWeather);
  const tasks = useFocusTasks();
  const [tasksVisible, setTasksVisible] = useState(true);
  const [tasksRequested, setTasksRequested] = useState(false);
  const [timerVisible, setTimerVisible] = useState(false);
  const { card: timerCard, handle: timerDragHandle } = useWindowDrag();
  const [timerClosing, setTimerClosing] = useState(false);
  const [timerExpanded, setTimerExpanded] = useState(false);
  const showTasks = tasksVisible && (tasksRequested || tasks.day.tasks.length > 0);
  function openTimer() { setTimerClosing(false); setTimerVisible(true); setTimerExpanded(true); }
  function openTasks() {
    setTasksVisible(true);
    setTasksRequested(true);
  }
  const focusWidgets = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const widgets = focusWidgets.current;
    if (!widgets) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = widgets.getBoundingClientRect();
        let bottom = window.innerHeight - 24;
        if (!zen) {
          for (const selector of [".lower-row", ".player", ".bottom-line", ".quiet-link"]) {
            const element = document.querySelector<HTMLElement>(selector);
            if (!element || getComputedStyle(element).display === "none") continue;
            const rect = element.getBoundingClientRect();
            if (rect.height && rect.top > box.top && rect.right > box.left && rect.left < box.right) bottom = Math.min(bottom, rect.top - 16);
          }
        }
        widgets.style.setProperty("--focus-space", `${Math.max(0, bottom - box.top)}px`);
      });
    };
    const observer = new ResizeObserver(measure);
    for (const selector of [".sanctuary", ".interface", ".lower-row", ".player", ".scene-caption", ".intro"]) {
      const element = document.querySelector(selector);
      if (element) observer.observe(element);
    }
    window.addEventListener("resize", measure);
    measure();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("resize", measure); };
  }, [zen, showTasks, timerVisible]);
  const mixer = useNoiseMixer({ stopSignal: noiseStop, notify });
  const load = useCallback(async () => {
    if (githubPages) {
      try {
        const saved = JSON.parse(localStorage.getItem(libraryStorageKey) || "null") as LibraryState | null;
        if (saved?.playlists) setState(saved);
      } catch { /* Use the default library when browser storage is unavailable. */ }
      setTracks([]);
      setReady(true);
      return;
    }
    try {
      const r = await fetch("/api/state");
      const d = (await r.json()) as {
        state: LibraryState;
        revision: number;
        error?: string;
      };
      if (!r.ok) throw Error(d.error);
      setState({ ...d.state, playlists: d.state.playlists.map(p => p.id === "personal" && p.name === "Мой горный плейлист" ? { ...p, name: "Мой плейлист" } : p) });
      setRevision(d.revision);
      const tr = await fetch("/api/tracks");
      const td = (await tr.json()) as Track[] & { error?: string };
      if (!tr.ok) throw Error(td.error);
      setTracks(td);
      setReady(true);
    } catch (e) {
      notify((e as Error).message);
    }
  }, [notify]);
  function chooseWeather(value: string) {
    localWeather.disable();
    localWeather.resetSeason();
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
          if (validWeatherMinutes(saved.minutes))
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
    if (!autoWeather || !prefsLoaded || localWeather.enabled) return;
    return scheduleWeather(weatherMinutes, () => {
      setWeather(current => nextWeather(current));
    });
  }, [autoWeather, weatherMinutes, prefsLoaded, localWeather.enabled]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 9000);
    return () => clearTimeout(t);
  }, [message]);
  async function save(next: LibraryState) {
    if (!ready) {
      notify("Дождись загрузки библиотеки, чтобы сохранить изменения.");
      return false;
    }
    if (busy.current) return false;
    if (githubPages) {
      try {
        localStorage.setItem(libraryStorageKey, JSON.stringify(next));
        setState(next);
        return true;
      } catch {
        notify("Не удалось сохранить библиотеку в этом браузере.");
        return false;
      }
    }
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
      const el = audio.current;
      await playback.current.run(() => el.play(), () => {
        setPlaying(false);
        notify("Не удалось воспроизвести трек. Попробуй ещё раз.");
      });
    },
    [volume, notify],
  );
  async function toggle() {
    const el = audio.current;
    if (!el) return;
    if (playing) {
      playback.current.cancel();
      el.pause();
      return;
    }
    if (!el.getAttribute("src")) {
      await playTrack(track);
      return;
    }
    await playback.current.run(() => el.play(), () => {
      notify("Браузер не воспроизвёл аудио. Попробуй другой трек.");
    });
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
    function fullChanged() {
      setFull(!!fullscreenElement());
    }
    const events = ["fullscreenchange", "webkitfullscreenchange", "MSFullscreenChange"];
    events.forEach((event) => document.addEventListener(event, fullChanged));
    return () => events.forEach((event) => document.removeEventListener(event, fullChanged));
  }, []);
  async function fullscreen() {
    try {
      await toggleFullscreen();
    } catch {
      setPanel(null);
      setZen(true);
    }
  }
  function enterZen() {
    setZen(true);
    setPanel(null);
    if (!fullscreenElement()) void fullscreen();
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
        playback.current.cancel();
        audio.current?.pause();
        setNoiseStop((v) => v + 1);
        notify("Сессия завершена. Время немного отдохнуть.");
      }
    }, 500);
    return () => clearInterval(tick);
  }, [timerRunning, notify]);
  function cancelTimer() {
    setTimerRunning(false);
    setRemaining(null);
    timerEnd.current = 0;
  }
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
      const target = e.target as HTMLElement;
      if (zen && !target.closest('.focus-widgets, [role="dialog"]')) {
        setZen(false);
        return;
      }
      if (target.closest(".task-grip")) return;
      const vertical = e.key === "ArrowUp" || e.key === "ArrowDown";
      const slider = target.closest('[role="slider"]');
      if (slider && !vertical) return;
      if (!slider && target.closest('input,textarea,[role="tablist"],[role="combobox"]')) return;
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
          el.getAttribute("aria-hidden") !== "true" &&
          !el.closest('[inert], [hidden]'),
      );
      const from = document.activeElement as HTMLElement;
      const box = from?.getBoundingClientRect();
      if (!box || !elements.includes(from)) {
        elements[0]?.focus();
        return;
      }
      // A remote must be able to leave a slider. In dialogs use document order
      // vertically, including controls below the scroll viewport; left/right
      // stay with the slider for changing its value.
      if (scope !== document && vertical) {
        const nav = from.closest(".settings-nav");
        const body = scope.querySelector(".panel-body");
        const bodyElements = elements.filter((el) => body?.contains(el));
        let next: HTMLElement | undefined;
        if (nav && e.key === "ArrowDown") next = bodyElements[0];
        else if (from === bodyElements[0] && e.key === "ArrowUp")
          next = scope.querySelector<HTMLElement>('.settings-nav [aria-pressed="true"]') || undefined;
        else next = elements[elements.indexOf(from) + (e.key === "ArrowDown" ? 1 : -1)];
        e.preventDefault();
        e.stopPropagation();
        if (next) {
          next.focus({ preventScroll: true });
          next.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
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
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [zen]);
  async function addPlaylist() {
    if (!newList.trim()) return;
    const id = newId();
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
    <main className={`sanctuary weather-${weather} ${zen ? "zen" : ""} ${timerVisible ? "has-session" : ""} ${showTasks ? "has-tasks" : ""}`}>
      <Landscape
        quality={display.quality}
        weather={weather}
        season={localWeather.season}
        automatic={autoWeather}
        onError={notify}
      />
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
          if (!audio.current?.error || audio.current.error.code === 1) return;
          setPlaying(false);
          notify(
            "Этот аудиофайл не удалось открыть. Выбери другой формат или трек.",
          );
        }}
      />
      <div className="interface" inert={zen}>
        <header>
          <button
            className="brand"
            onClick={() => setZen(false)}
            aria-label="Тихая высота — главная"
          >
            <Mountain />
            <span>
              тихая высота<small>МЕСТО ДЛЯ ТВОИХ МЫСЛЕЙ</small>
            </span>
          </button>

          <div className="header-actions">
            <button className={`sound-access ${mixer.running ? "sound-active" : ""}`} title="Белый шум и звуки природы" aria-label="Белый шум и звуки природы" onClick={() => { setSettingsSection("sound"); setPanel("atmosphere"); }}><AudioLines /><span>Белый шум</span></button>
            <button
              onClick={() => { setSettingsSection("scene"); setPanel("atmosphere"); }}
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
        {!ready && (
          <div className="connection">
            {message ? "Хранилище пока недоступно." : "Загружаю библиотеку…"}{" "}
            <button onClick={load}>Повторить</button>
          </div>
        )}
        {
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
              <p className="intro-description">
                Горы никуда не спешат.
                <br />
                Ты тоже можешь идти в своём ритме.
              </p>
              <button className="quiet-link" onClick={enterZen}>
                <EyeOff />
                Остаться с горами <ChevronRight />
              </button>
            </section>
            <div className="scene-caption">
              <span>АЛЬПИЙСКАЯ ДОЛИНА</span>
              <span>
                {weather === "sunset"
                  ? "Последний свет на вершинах"
                  : weather === "dawn"
                    ? "Первый свет над озером"
                    : weather === "day"
                      ? "Ясный день в долине"
                      : weather === "spring"
                        ? "Долина просыпается после зимы"
                        : weather === "autumn"
                          ? "Золотая тишина горного леса"
                          : weather === "winter"
                            ? "Тишина заснеженной долины"
                            : weather === "night"
                              ? "Звёзды и огни горного поселения"
                              : weather === "rain"
                                ? "Дождь в долине"
                                : "Туман над озером"}
              </span>
            </div>
            <div className="lower-row">
              <div className="weather-pills" aria-label="Атмосфера">
                <button
                  className="auto-weather-button"
                  aria-pressed={autoWeather || localWeather.enabled}
                  onClick={() => {
                    localWeather.disable();
                    setAutoWeather(localWeather.enabled ? false : !autoWeather);
                  }}
                >
                  <Repeat />
                  {localWeather.enabled
                    ? "По месту"
                    : autoWeather
                      ? `Авто · ${weatherMinutes} мин`
                      : "Авто"}
                </button>
                {[
                  ["dawn", "Рассвет", Sunrise],
                  ["day", "Лето", Sun],
                  ["sunset", "Закат", Sun],
                  ["fog", "Туман", CloudFog],
                  ["rain", "Дождь", CloudRain],
                  ["night", "Ночь", Moon],
                  ["winter", "Зима", Snowflake],
                  ["spring", "Весна", Flower2],
                  ["autumn", "Осень", Leaf],
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
            </div>
          </>
        }

        <footer className="player">
          <button className="track-info" onClick={() => setPanel("music")}>
            <span className="album-art">
              <Headphones />
            </span>
            <span>
              {track.name}
              <small>
                {builtins.some((t) => t.id === track.id)
                  ? "Горный плейлист"
                  : track.group === "mymusic" ? "Музыка для фокуса" : "Моя музыка"}{" "}
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
          <button onClick={openTimer}>
            <Timer />
            {remaining !== null
              ? `${focusTime(remaining)} ${timerRunning ? "· фокус" : "· пауза"}`
              : "Таймер фокуса"}
          </button>
          <button onClick={openTasks}><ListTodo />Задачи на сегодня</button>
          <span>СТРЕЛКИ — ВЫБОР · ENTER — ДЕЙСТВИЕ</span>
        </div>
      </div>
      <div ref={focusWidgets} className={`focus-widgets ${timerExpanded && timerVisible && !zen ? "is-configuring-timer" : ""}`}>
        {timerVisible && <section ref={timerCard} inert={timerClosing} onAnimationEnd={event => { if (event.target === event.currentTarget && event.animationName === "floating-depart") { setTimerVisible(false); setTimerClosing(false); } }} className={`timer-card floating-card ${timerClosing ? "is-closing" : ""}`} aria-label="Таймер фокуса" onKeyDown={event => { if (event.key === "Escape" && !zen) { event.stopPropagation(); setTimerClosing(true); } }}>
          <div className="task-card-heading window-drag-handle" {...timerDragHandle} title="Перетащи окно за заголовок · двойной щелчок возвращает на место"><span><Timer />Таймер фокуса</span><button className="floating-close" aria-label="Закрыть таймер" onClick={() => setTimerClosing(true)}><X /></button></div>
          <div className="timer-face">
            <button className="timer-display" onClick={() => setTimerExpanded(!timerExpanded)} aria-label="Настроить время таймера" aria-expanded={timerExpanded && !zen}>
              <strong role="timer">{focusTime(remaining ?? timerLength * 60)}</strong>
              <small>{remaining === 0 ? "Сессия завершена" : timerRunning ? "Время для себя" : remaining !== null ? "На паузе" : "В своём ритме"}</small>
            </button>
            <button className="timer-play" aria-label={timerRunning ? "Приостановить сессию" : "Начать сессию"} onClick={() => { startTimer(); setTimerExpanded(false); }}>{timerRunning ? <Pause /> : <Play />}</button>
          </div>
          {timerExpanded && !zen && <div className="timer-options">
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
              <form
                className="focus-duration"
                onSubmit={(event) => {
                  event.preventDefault();
                  const value = Number(
                    new FormData(event.currentTarget).get("focusMinutes"),
                  );
                  if (!validFocusMinutes(value)) return;
                  setTimerLength(value);
                  cancelTimer();
                }}
              >
                <label htmlFor="focus-minutes">Своё время, в минутах</label>
                <div>
                  <input
                    id="focus-minutes"
                    key={timerLength}
                    name="focusMinutes"
                    type="number"
                    min={5}
                    max={1440}
                    step={1}
                    required
                    defaultValue={timerLength}
                  />
                  <button type="submit">Выбрать</button>
                </div>
              </form>
              <button className="primary" onClick={() => { startTimer(); setTimerExpanded(false); }}>
                {timerRunning ? <Pause /> : <Play />}
                {timerRunning ? "Пауза" : "Начать сессию"}
              </button>
              {remaining !== null && (
                <button onClick={cancelTimer}>
                  <X />
                  Убрать сессию
                </button>
              )}
              <p className="small-copy">
                В конце музыка остановится. Можно слушать без таймера.
              </p>
          </div>}
        </section>}
        {showTasks && <TaskCard model={tasks} zen={zen} onClose={() => setTasksVisible(false)} />}
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
        <SheetContent className="detail-panel" showCloseButton={false}>
          <SheetHeader>
            <SheetClose className="settings-close" aria-label="Закрыть настройки"><X /></SheetClose>
            <div className="settings-heading-row">
              <SheetTitle>
                {panel === "music" ? "Твоя музыка" : "Настройки"}
              </SheetTitle>
              {panel !== "music" && <span className="settings-projects">Больше проектов: <a href="https://t.me/RiabchikoD" target="_blank" rel="noopener noreferrer">@RiabchikoD</a></span>}
            </div>
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
                  Горный плейлист <span>{builtins.length}</span>
                </button>
                <button className={playlist === "mymusic" ? "chosen" : ""} onClick={() => setPlaylist("mymusic")}><Music2 />Музыка для фокуса<span>{tracks.filter(t => t.group === "mymusic").length}</span></button>
                {tracks.some(t => t.group === "secret") && <button className={playlist === "secret" ? "chosen" : ""} onClick={() => setPlaylist("secret")}><Headphones />Expedition 33<span>{tracks.filter(t => t.group === "secret").length}</span></button>}
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
                {playlist === "ambient"
                  ? "Горный плейлист"
                  : playlist === "mymusic" ? "Музыка для фокуса" : playlist === "secret" ? "Expedition 33" : currentList?.name}
              </h3>
              <p className="small-copy">
                {playlist === "ambient"
                  ? "Девять оригинальных композиций без вокала: клавиши, мягкий ритм, эмбиент."
                  : currentList ? "Порядок треков можно менять стрелками. Плейлисты общие для устройств с одним IP." : "Выбери любую композицию. Плеер продолжит этот плейлист."}
              </p>
              {queue.length === 0 && (
                <div className="empty-state">
                  <Music2 />
                  <p>Пока тихо. Добавь треки из библиотеки ниже.</p>
                </div>
              )}
              {currentList && (
                <select
                  aria-label="Добавить трек в плейлист"
                  value=""
                  disabled={saving}
                  onChange={(event) => {
                    if (event.target.value)
                      void editList([
                        ...currentList.tracks,
                        event.target.value,
                      ]);
                  }}
                >
                  <option value="">Добавить трек в плейлист…</option>
                  {allTracks
                    .filter((t) => !currentList.tracks.includes(t.id))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              )}
              {queue.map((t, i) => (
                <div className="track-row" key={t.id}>
                  <button className="track-name" onClick={() => playTrack(t)}>
                    {playing && track.id === t.id ? <Volume2 /> : <Play />}
                    <span>
                      {t.name}
                      <small>{t.subtitle || "Музыка"}</small>
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
            </div>
          )}
          {panel === "atmosphere" && (
            <>
            <nav className="settings-nav" aria-label="Разделы настроек">
              {[["scene", "Пейзаж"], ["sound", "Белый шум"], ["screen", "Экран"]].map(([id, label]) => <button key={id} aria-pressed={settingsSection === id} onClick={() => setSettingsSection(id)}>{label}</button>)}
            </nav>
            <div ref={settingsBody} className="panel-body settings-body" key={settingsSection}>
              {settingsSection === "screen" && <DisplaySettings display={display} weather={weather} season={localWeather.season} zen={zen} />}
              {settingsSection === "sound" && <NoiseMixer mixer={mixer} />}
              <section hidden={settingsSection !== "scene"}>
              <h3>Как живёт пейзаж</h3>
              <div className="weather-behavior">
                <button
                  className={
                    !autoWeather && !localWeather.enabled ? "chosen" : ""
                  }
                  aria-pressed={!autoWeather && !localWeather.enabled}
                  onClick={() => {
                    localWeather.disable();
                    setAutoWeather(false);
                  }}
                >
                  <Sun />
                  <span>
                    Фиксированный<small>Выбранное условие остаётся</small>
                  </span>
                </button>
                <button
                  className={
                    autoWeather && !localWeather.enabled ? "chosen" : ""
                  }
                  aria-pressed={autoWeather && !localWeather.enabled}
                  onClick={() => {
                    localWeather.disable();
                    setAutoWeather(true);
                  }}
                >
                  <Repeat />
                  <span>
                    Меняется сам
                    <small>Пейзажи плавно сменяют друг друга</small>
                  </span>
                </button>
              </div>
              <form
                className="weather-interval"
                onSubmit={(event) => {
                  event.preventDefault();
                  const value = Number(
                    new FormData(event.currentTarget).get("weatherMinutes"),
                  );
                  if (!validWeatherMinutes(value)) return;
                  localWeather.disable();
                  setWeatherMinutes(value);
                  setAutoWeather(true);
                }}
              >
                <label htmlFor="weather-minutes">
                  Менять пейзаж каждые, мин
                </label>
                <div>
                  <input
                    key={weatherMinutes}
                    id="weather-minutes"
                    name="weatherMinutes"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="1440"
                    step="1"
                    required
                    defaultValue={weatherMinutes}
                  />
                  <button type="submit">Применить</button>
                </div>
                <small>Применение включает автосмену.</small>
              </form>
              <h3>
                {autoWeather || localWeather.enabled
                  ? "Сейчас в долине"
                  : "Оставить в долине"}
              </h3>
              <div className="atmosphere-grid">
                {[
                  ["dawn", "Рассвет", Sunrise],
                  ["day", "Лето", Sun],
                  ["sunset", "Закат", Sun],
                  ["fog", "Туман", CloudFog],
                  ["rain", "Дождь", CloudRain],
                  ["night", "Ночь", Moon],
                  ["winter", "Зима", Snowflake],
                  ["spring", "Весна", Flower2],
                  ["autumn", "Осень", Leaf],
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
              {!githubPages && <LocalWeatherPicker
                weather={localWeather}
                onActivate={() => setAutoWeather(false)}
              />}
              </section>
              {settingsSection === "scene" && <button
                className="settings-zen"
                onClick={() => {
                  enterZen();
                }}
              >
                <EyeOff />
                Скрыть весь интерфейс
              </button>}
              <p className="small-copy">
                Стрелки и Enter для пульта. Esc или кнопка «Назад» возвращает
                управление. Выбор света вручную включает фиксированный режим.
                Движение приглушено при системной настройке уменьшения анимации.
              </p>
            </div>
            <div className="settings-scroll" aria-label="Прокрутка настроек">
              <span>↑ ↓ выбор · ← → громкость</span>
              <button aria-label="Прокрутить настройки вверх" onClick={() => {
                if (settingsBody.current) settingsBody.current.scrollTop -= settingsBody.current.clientHeight * 0.75;
              }}><ArrowUp />Вверх</button>
              <button aria-label="Прокрутить настройки вниз" onClick={() => {
                if (settingsBody.current) settingsBody.current.scrollTop += settingsBody.current.clientHeight * 0.75;
              }}><ArrowDown />Вниз</button>
            </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}
