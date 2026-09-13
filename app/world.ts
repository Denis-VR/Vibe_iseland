export const weatherOrder = ["sunset", "fog", "rain", "night"];
export function nextWeather(current: string) {
  return weatherOrder[
    (weatherOrder.indexOf(current) + 1) % weatherOrder.length
  ];
}
export const atlasStops = [
  {
    title: "Базовый лагерь",
    topics: "Hello, world · Переменные и типы",
    code: "func main()  ·  var  ·  :=  ·  const",
    x: 12,
    y: 68,
  },
  {
    title: "Зеркальное озеро",
    topics: "Форматирование · Строки и Unicode",
    code: 'fmt.Printf("%T")  ·  byte → rune',
    x: 23,
    y: 41,
  },
  {
    title: "Развилка решений",
    topics: "Операторы · Условия и циклы",
    code: "if / else  ·  for  ·  switch",
    x: 38,
    y: 59,
  },
  {
    title: "Мосты связей",
    topics: "Функции · Замыкания",
    code: "func()  ·  return x, y  ·  capture",
    x: 52,
    y: 32,
  },
  {
    title: "Горный приют",
    topics: "Defer · Освобождение ресурсов",
    code: "defer Close()  ·  LIFO",
    x: 65,
    y: 53,
  },
  {
    title: "Каменные шпили",
    topics: "Указатели · Структуры",
    code: "&value  ·  *T  ·  struct { }",
    x: 77,
    y: 24,
  },
  {
    title: "Своя вершина",
    topics: "Слайсы · Модули и пакеты",
    code: "len / cap  ·  append  ·  go.mod",
    x: 88,
    y: 50,
  },
];

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
  const id = clock.setInterval(advance, minutes * 60000);
  return () => clock.clearInterval(id);
}
