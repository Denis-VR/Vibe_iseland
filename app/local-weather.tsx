import { newId } from "./id";
import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation } from "lucide-react";
import {
  weatherForPlace,
  seasonForPlace,
  seasonNames,
  type Season,
  type LocalWeather,
} from "./world";
type Place = {
  id: number;
  name: string;
  country: string;
  countryName: string;
  region: string;
  timezone: string;
};
let visitor = "",
  visitId = "";
function identity() {
  if (!visitor) {
    try {
      visitor = localStorage.getItem("quiet-height-visitor") || "";
    } catch {}
    if (!/^[0-9a-f-]{36}$/i.test(visitor)) {
      visitor = newId();
      try {
        localStorage.setItem("quiet-height-visitor", visitor);
      } catch {}
    }
  }
  return visitor;
}
async function request<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) throw Error(result.error || "Не удалось выполнить запрос");
  return result;
}
export function recordVisit() {
  // One event per document, including React StrictMode remounts; retries are deduplicated by SQLite.
  if (!visitId) visitId = newId();
  void request("/api/visit", { id: visitId, visitor: identity() }).catch(
    () => {},
  );
}
export function useLocalWeather(onWeather: (value: string) => void) {
  const [place, setPlace] = useState<Place | null>(null),
    [enabled, setEnabled] = useState(false),
    [loaded, setLoaded] = useState(false);
  const [season, setSeason] = useState<Season>("summer");
  const [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  const activeRequest = useRef(0),
    callback = useRef(onWeather);
  useEffect(() => {
    callback.current = onWeather;
  }, [onWeather]);
  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        const saved = JSON.parse(
          localStorage.getItem("quiet-height-place") || "null",
        );
        if (saved?.place && Number.isInteger(saved.place.id)) {
          setPlace(saved.place);
          setEnabled(saved.enabled === true);
          if (["spring", "summer", "autumn", "winter"].includes(saved.season))
            setSeason(saved.season);
        }
      } catch {}
      setLoaded(true);
      recordVisit();
    });
  }, []);
  useEffect(() => {
    if (loaded)
      try {
        localStorage.setItem(
          "quiet-height-place",
          JSON.stringify({ place, enabled, season }),
        );
      } catch {}
  }, [place, enabled, season, loaded]);
  useEffect(() => {
    if (!enabled || !place || !loaded) return;
    const controller = new AbortController();
    let snapshot: LocalWeather | null = null;
    const apply = () => {
      if (snapshot && Date.now() - snapshot.fetchedAt < 3600000) {
        setSeason(seasonForPlace(snapshot));
        callback.current(weatherForPlace(snapshot));
      }
    };
    const update = async () => {
      try {
        const weather = await request<LocalWeather>(
          "/api/local-weather?placeId=" + place.id,
          undefined,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        snapshot = weather;
        apply();
        setStatus(
          `${place.name} · ${seasonNames[seasonForPlace(weather)]} · ${Math.round(weather.temperature)} °C · реальный режим включён`,
        );
      } catch (error) {
        if (!controller.signal.aborted)
          setStatus((error as Error).message + " Текущий пейзаж сохранён.");
      }
    };
    void update();
    const refresh = setInterval(() => void update(), 900000),
      tick = setInterval(apply, 30000);
    return () => {
      controller.abort();
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, [enabled, place, loaded, revision]);
  async function choose(next: Place, source: "manual" | "geolocation") {
    activeRequest.current++;
    setBusy(false);
    setPlace(next);
    setEnabled(false);
    setStatus(
      `${next.name} выбран. Включи реальный режим, чтобы применить погоду и сезон.`,
    );
    setRevision((v) => v + 1);
    // Statistics do not delay or block the landscape.
    void request("/api/place-choice", {
      id: newId(),
      visitor: identity(),
      placeId: next.id,
      source,
    }).catch(() => {});
  }
  function locate() {
    if (!navigator.geolocation || !window.isSecureContext) {
      setStatus(
        "Геопозиция требует HTTPS или localhost. Выбери город вручную.",
      );
      return;
    }
    const token = ++activeRequest.current;
    setBusy(true);
    setStatus("Разреши доступ к геопозиции в браузере…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (token !== activeRequest.current) return;
        void request<Place>("/api/nearest-place", {
          latitude: Number(position.coords.latitude.toFixed(2)),
          longitude: Number(position.coords.longitude.toFixed(2)),
        })
          .then((next) => {
            if (token === activeRequest.current)
              void choose(next, "geolocation");
          })
          .catch((error) => {
            if (token === activeRequest.current) {
              setStatus(error.message);
              setBusy(false);
            }
          });
      },
      () => {
        if (token === activeRequest.current) {
          setBusy(false);
          setStatus("Геопозиция недоступна. Можно выбрать город вручную.");
        }
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  }
  function disable() {
    activeRequest.current++;
    setBusy(false);
    setEnabled(false);
    setStatus("");
  }
  return {
    place,
    season,
    enabled,
    status,
    busy,
    choose,
    locate,
    disable,
    resetSeason: () => setSeason("summer"),
    enable: () => {
      if (place) {
        setStatus("Получаю погоду и сезон…");
        setEnabled(true);
        setRevision((v) => v + 1);
      }
    },
    refresh: () => setRevision((v) => v + 1),
  };
}
export function LocalWeatherPicker({
  weather,
  onActivate,
}: {
  weather: ReturnType<typeof useLocalWeather>;
  onActivate: () => void;
}) {
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<Place[]>([]),
    [searchStatus, setSearchStatus] = useState("");
  const requestId = useRef(0);
  return (
    <section className="local-weather">
      <h3>
        <MapPin size={17} /> Погода там, где ты
      </h3>
      <p className="small-copy">
        Пейзаж следует времени и погоде выбранного города. Для геопозиции найдём
        ближайший город; точные координаты не сохраняются.
      </p>
      <div className="location-actions">
        <button
          disabled={weather.busy}
          onClick={() => {
            weather.locate();
          }}
        >
          <Navigation size={16} />
          {weather.busy ? "Определяю место…" : "Моё местоположение"}
        </button>
        {weather.place && (
          <button
            className={weather.enabled ? "chosen" : ""}
            onClick={() => {
              onActivate();
              if (weather.enabled) weather.disable();
              else weather.enable();
            }}
          >
            {weather.enabled
              ? "Выключить реальный режим"
              : "Включить реальный режим"}{" "}
            · {weather.place.name}
          </button>
        )}
      </div>
      <form
        className="place-search"
        onSubmit={async (event) => {
          event.preventDefault();
          const token = ++requestId.current;
          setSearchStatus("Ищу…");
          setResults([]);
          try {
            const found = await request<Place[]>(
              "/api/places?q=" + encodeURIComponent(query.trim()),
            );
            if (token === requestId.current) {
              setResults(found);
              setSearchStatus(
                found.length
                  ? "Выбери город"
                  : "Не нашёл. Попробуй название ближайшего крупного города.",
              );
            }
          } catch (error) {
            if (token === requestId.current)
              setSearchStatus((error as Error).message);
          }
        }}
      >
        <input
          aria-label="Город для погоды"
          placeholder="Город, например Москва"
          minLength={2}
          maxLength={100}
          required
          value={query}
          onChange={(e) => {
            requestId.current++;
            setQuery(e.target.value);
            setResults([]);
            setSearchStatus("");
          }}
        />
        <button type="submit">Найти</button>
      </form>
      <p className="small-copy" role="status">
        {searchStatus}
      </p>
      <div className="place-results">
        {results.map((place) => (
          <button
            key={place.id}
            onClick={() => {
              void weather.choose(place, "manual");
              setResults([]);
              setSearchStatus("");
            }}
          >
            {place.name}
            <small>
              {place.countryName} · {place.region}
            </small>
          </button>
        ))}
      </div>
      <p className="small-copy" role="status">
        {weather.status}
      </p>
      {weather.enabled && (
        <button onClick={weather.refresh}>Обновить погоду</button>
      )}
    </section>
  );
}
