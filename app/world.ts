export const weatherOrder = [
  "dawn",
  "day",
  "fog",
  "rain",
  "sunset",
  "night",
  "winter",
  "spring",
  "autumn",
];
export function nextWeather(current: string) {
  return weatherOrder[
    (weatherOrder.indexOf(current) + 1) % weatherOrder.length
  ];
}
export function scheduleWeather(
  minutes: number,
  advance: () => void,
  clock: {
    setInterval: (fn: () => void, ms: number) => unknown;
    clearInterval: (id: unknown) => void;
  } = {
    setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
    clearInterval: (id) =>
      globalThis.clearInterval(id as ReturnType<typeof setInterval>),
  },
) {
  if (!validWeatherMinutes(minutes))
    throw new RangeError("Weather interval must be 1–1440 whole minutes");
  const id = clock.setInterval(advance, minutes * 60000);
  return () => clock.clearInterval(id);
}

export function validWeatherMinutes(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 1440
  );
}

export function validFocusMinutes(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 5 &&
    value <= 525600
  );
}
export function focusTime(seconds: number) {
  const days = Math.floor(seconds / 86400),
    hours = Math.floor((seconds % 86400) / 3600),
    minutes = Math.floor((seconds % 3600) / 60),
    s = Math.floor(seconds % 60);
  const clock =
    String(minutes).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  return (
    (days ? days + " д · " : "") +
    (hours || days ? String(hours).padStart(2, "0") + ":" : "") +
    clock
  );
}
export type LocalWeather = {
  code: number;
  isDay: number;
  temperature: number;
  sunrise: number[];
  sunset: number[];
  fetchedAt: number;
  timezone: string;
  latitude?: number;
};
export function weatherForPlace(data: LocalWeather, now = Date.now()) {
  const seconds = now / 1000;
  if (data.sunrise.some((t) => t > 0 && Math.abs(seconds - t) < 2700))
    return "dawn";
  if (data.sunset.some((t) => t > 0 && Math.abs(seconds - t) < 2700))
    return "sunset";
  const dayIndex = data.sunrise.findIndex(
    (rise, i) => rise > 0 && seconds >= rise && seconds < data.sunset[i],
  );
  const hasSun = data.sunrise.some((t) => t > 0);
  if (hasSun ? dayIndex === -1 : data.isDay === 0) return "night";
  if ([71, 73, 75, 77, 85, 86].includes(data.code)) return "winter";
  if ([45, 48].includes(data.code)) return "fog";
  if (data.code >= 51) return "rain";
  return "day";
}

export type Season = "spring" | "summer" | "autumn" | "winter";
export const seasonNames: Record<Season, string> = {
  spring: "Весна",
  summer: "Лето",
  autumn: "Осень",
  winter: "Зима",
};
export function seasonForPlace(
  data: Pick<LocalWeather, "timezone" | "latitude" | "code">,
  now = Date.now(),
): Season {
  if ([71, 73, 75, 77, 85, 86].includes(data.code)) return "winter";
  const month = Number(
    new Intl.DateTimeFormat("en", {
      timeZone: data.timezone,
      month: "numeric",
    }).format(now),
  );
  // Calendar seasons; a hemisphere shift prevents winter in Sydney in July's opposite season.
  const index =
    (Math.floor((month % 12) / 3) +
      (data.latitude !== undefined && data.latitude < 0 ? 2 : 0)) %
    4;
  return (["winter", "spring", "summer", "autumn"] as Season[])[index];
}
